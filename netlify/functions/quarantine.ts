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

// Mock data for quarantine functionality
const mockQuarantinedTests = [
  {
    id: '1',
    testName: 'test_user_authentication',
    testSuite: 'auth_tests',
    projectId: 'project1',
    reason: 'High failure rate detected',
    quarantinedAt: new Date().toISOString(),
    quarantinedBy: 'system',
    status: 'quarantined',
  },
  {
    id: '2', 
    testName: 'test_payment_processing',
    testSuite: 'payment_tests',
    projectId: 'project1',
    reason: 'Intermittent failures in CI',
    quarantinedAt: new Date().toISOString(),
    quarantinedBy: 'system',
    status: 'quarantined',
  }
];

const mockQuarantineStats = {
  totalQuarantined: 2,
  resolvedThisWeek: 5,
  avgQuarantineTime: 2.5,
  impactReduction: 85,
  testsSaved: 45,
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
    // Verify authentication for most endpoints
    const user = await getUserFromToken(event.headers.authorization);
    
    const path = event.path.replace('/.netlify/functions/quarantine', '');
    const pathParts = path.split('/').filter(Boolean);
    
    switch (event.httpMethod) {
      case 'GET':
        // Handle different GET endpoints
        if (pathParts.length === 1) {
          // GET /:projectId - Get quarantined tests for a project
          const projectId = pathParts[0];
          const quarantinedTests = mockQuarantinedTests.filter(test => test.projectId === projectId);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: quarantinedTests,
              total: quarantinedTests.length,
            }),
          };
        } else if (pathParts.length === 2 && pathParts[1] === 'stats') {
          // GET /stats/:projectId - Get quarantine stats
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: mockQuarantineStats,
            }),
          };
        } else if (pathParts.length === 2 && pathParts[1] === 'policies') {
          // GET /policies/:projectId - Get quarantine policies
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: [],
              message: 'No policies configured',
            }),
          };
        } else if (pathParts.length === 2 && pathParts[1] === 'analytics') {
          // GET /analytics/:projectId - Get quarantine analytics
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: {
                timeRange: '30d',
                metrics: {
                  totalQuarantined: 12,
                  resolved: 8,
                  pending: 4,
                  impactReduction: 78,
                },
                trends: [],
              },
            }),
          };
        }
        break;
        
      case 'POST':
        // Handle different POST endpoints
        if (pathParts[pathParts.length - 1] === 'auto-evaluate') {
          // POST /:projectId/auto-evaluate
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Auto-evaluation triggered',
              evaluatedTests: 0,
            }),
          };
        } else if (pathParts[pathParts.length - 1] === 'schedule-automation') {
          // POST /:projectId/schedule-automation
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Automation scheduled',
            }),
          };
        } else if (path === '/quarantine') {
          // POST /quarantine - Quarantine a test
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Test quarantined successfully',
            }),
          };
        } else if (path === '/unquarantine') {
          // POST /unquarantine - Unquarantine a test
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Test unquarantined successfully',
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
    console.error('Quarantine API error:', error);
    
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