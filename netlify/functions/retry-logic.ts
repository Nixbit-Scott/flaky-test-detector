import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import * as jwt from 'jsonwebtoken';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Helper function to verify JWT and get user
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid token provided');
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Mock retry configuration data
const mockRetryConfigs = new Map<string, any>();

// Default retry configuration
const defaultRetryConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelay: 30,
  flakyThreshold: 0.3,
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Verify authentication
    const user = await getUserFromToken(event.headers.authorization);
    
    const path = event.path.replace('/.netlify/functions/retry-logic', '');
    const pathParts = path.split('/').filter(Boolean);
    
    switch (event.httpMethod) {
      case 'GET':
        if (pathParts.length === 2 && pathParts[1] === 'config') {
          // GET /:projectId/config - Get retry configuration
          const projectId = pathParts[0];
          const config = mockRetryConfigs.get(projectId) || defaultRetryConfig;
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              config: {
                enabled: config.enabled,
                maxRetries: config.maxRetries,
                retryDelay: config.retryDelay,
                flakyThreshold: config.flakyThreshold,
              },
              projectId,
            }),
          };
        } else if (pathParts.length === 2 && pathParts[1] === 'stats') {
          // GET /:projectId/stats - Get retry statistics
          const projectId = pathParts[0];
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: {
                totalRetries: 156,
                successfulRetries: 134,
                failedRetries: 22,
                averageRetryTime: 45,
                timesSaved: 289,
                impactReduction: 72,
              },
            }),
          };
        }
        break;
        
      case 'PUT':
        if (pathParts.length === 2 && pathParts[1] === 'config') {
          // PUT /:projectId/config - Update retry configuration
          const projectId = pathParts[0];
          
          if (!event.body) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'Request body is required',
              }),
            };
          }
          
          const requestBody = JSON.parse(event.body);
          const newConfig = {
            enabled: requestBody.config?.enabled ?? defaultRetryConfig.enabled,
            maxRetries: requestBody.config?.maxRetries ?? defaultRetryConfig.maxRetries,
            retryDelay: requestBody.config?.retryDelay ?? defaultRetryConfig.retryDelay,
            flakyThreshold: requestBody.config?.flakyThreshold ?? defaultRetryConfig.flakyThreshold,
          };
          
          // Store the configuration
          mockRetryConfigs.set(projectId, newConfig);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Retry configuration updated successfully',
              config: newConfig,
            }),
          };
        }
        break;
        
      case 'POST':
        if (path === '/should-retry') {
          // POST /should-retry - Check if a test should be retried
          if (!event.body) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'Request body is required',
              }),
            };
          }
          
          const requestBody = JSON.parse(event.body);
          const shouldRetry = Math.random() > 0.3; // Mock logic
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              shouldRetry,
              reason: shouldRetry ? 'Test identified as flaky' : 'Test failure appears deterministic',
              maxRetries: 3,
              delay: 30,
            }),
          };
        } else if (path === '/process-failures') {
          // POST /process-failures - Process test failures for retry analysis
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Test failures processed',
              processed: 12,
              flaggedForRetry: 8,
            }),
          };
        }
        break;
    }

    // Default 404 response
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        path: event.path,
        method: event.httpMethod,
      }),
    };

  } catch (error) {
    console.error('Retry logic API error:', error);
    
    if (error instanceof Error && error.message.includes('token')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Authentication required',
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
    };
  }
};