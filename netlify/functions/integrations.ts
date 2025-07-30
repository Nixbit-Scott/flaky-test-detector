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

// Mock integrations data
const mockIntegrations = new Map<string, any[]>();

const mockAlertTypes = [
  {
    id: 'flaky_test_detected',
    name: 'Flaky Test Detected',
    description: 'Alert when a new flaky test is identified',
    category: 'detection',
  },
  {
    id: 'quarantine_applied',
    name: 'Test Quarantined',
    description: 'Alert when a test is quarantined',
    category: 'quarantine',
  },
  {
    id: 'stability_improved',
    name: 'Test Stability Improved',
    description: 'Alert when test stability improves significantly',
    category: 'improvement',
  },
];

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
    
    const path = event.path.replace('/.netlify/functions/integrations', '');
    const pathParts = path.split('/').filter(Boolean);
    
    switch (event.httpMethod) {
      case 'GET':
        if (pathParts.length === 2 && pathParts[0] === 'project') {
          // GET /project/:projectId - Get integrations for a project
          const projectId = pathParts[1];
          const integrations = mockIntegrations.get(projectId) || [];
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: integrations,
              total: integrations.length,
            }),
          };
        } else if (path === '/alert-types') {
          // GET /alert-types - Get available alert types
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: mockAlertTypes,
            }),
          };
        } else if (pathParts.length === 2 && pathParts[0] === 'setup-guide') {
          // GET /setup-guide/:type - Get setup guide for integration type
          const integrationType = pathParts[1];
          
          const setupGuides: Record<string, any> = {
            slack: {
              title: 'Slack Integration Setup',
              steps: [
                'Create a Slack App in your workspace',
                'Add the webhook URL to your app',
                'Configure the desired channels',
                'Test the integration',
              ],
              webhookUrl: 'https://hooks.slack.com/services/...',
            },
            teams: {
              title: 'Microsoft Teams Integration Setup',
              steps: [
                'Go to your Teams channel',
                'Add a webhook connector',
                'Copy the webhook URL',
                'Configure notification preferences',
              ],
              webhookUrl: 'https://outlook.office.com/webhook/...',
            },
          };
          
          const guide = setupGuides[integrationType];
          if (!guide) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'Setup guide not found for integration type',
              }),
            };
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: guide,
            }),
          };
        }
        break;
        
      case 'POST':
        if (pathParts.length === 2 && pathParts[0] === 'project') {
          // POST /project/:projectId - Create new integration
          const projectId = pathParts[1];
          
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
          const newIntegration = {
            id: `integration_${Date.now()}`,
            projectId,
            type: requestBody.type,
            name: requestBody.name,
            config: requestBody.config,
            isActive: true,
            createdAt: new Date().toISOString(),
            lastUsed: null,
          };
          
          const projectIntegrations = mockIntegrations.get(projectId) || [];
          projectIntegrations.push(newIntegration);
          mockIntegrations.set(projectId, projectIntegrations);
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              success: true,
              data: newIntegration,
              message: 'Integration created successfully',
            }),
          };
        } else if (path === '/test') {
          // POST /test - Test an integration
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
          
          // Mock test - always succeeds for demo
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Integration test successful',
              testResult: {
                status: 'success',
                responseTime: 234,
                timestamp: new Date().toISOString(),
              },
            }),
          };
        }
        break;
        
      case 'PUT':
        if (pathParts.length === 1) {
          // PUT /:integrationId - Update integration
          const integrationId = pathParts[0];
          
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
          
          // Mock update - always succeeds for demo
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Integration updated successfully',
              integrationId,
            }),
          };
        }
        break;
        
      case 'DELETE':
        if (pathParts.length === 1) {
          // DELETE /:integrationId - Delete integration
          const integrationId = pathParts[0];
          
          // Mock delete - always succeeds for demo
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Integration deleted successfully',
              integrationId,
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
    console.error('Integrations API error:', error);
    
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