import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Validation schemas
const testResultSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  testSuiteName: z.string().min(1, 'Test suite name is required'),
  branch: z.string().min(1, 'Branch is required'),
  commit: z.string().min(1, 'Commit hash is required'),
  buildNumber: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  tests: z.array(z.object({
    name: z.string().min(1, 'Test name is required'),
    status: z.enum(['passed', 'failed', 'skipped']),
    duration: z.number().min(0).optional(),
    errorMessage: z.string().optional(),
    stackTrace: z.string().optional(),
    retryCount: z.number().min(0).optional(),
  })),
});

// Simple in-memory store for test results (resets on cold start)
const testResults: Map<string, {
  id: string;
  projectId: string;
  testSuiteName: string;
  branch: string;
  commit: string;
  buildNumber?: string;
  timestamp: string;
  userId: string;
  tests: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration?: number;
    errorMessage?: string;
    stackTrace?: string;
    retryCount?: number;
  }>;
  createdAt: string;
}> = new Map();

// Pre-seed some demo test results
const initializeDemoTestResults = () => {
  if (testResults.size === 0) {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    
    // Sample test results for the demo projects
    const sampleResults = [
      {
        id: 'result-1',
        projectId: 'project-demo-1',
        testSuiteName: 'Unit Tests',
        branch: 'main',
        commit: 'abc123',
        buildNumber: '42',
        timestamp: now,
        userId: 'user-demo',
        tests: [
          { name: 'test_user_login', status: 'passed' as const, duration: 150 },
          { name: 'test_user_registration', status: 'passed' as const, duration: 200 },
          { name: 'test_api_endpoint', status: 'failed' as const, duration: 100, errorMessage: 'Connection timeout' },
          { name: 'test_flaky_network_call', status: 'failed' as const, duration: 5000, errorMessage: 'Network unreliable' },
        ],
        createdAt: now,
      },
      {
        id: 'result-2',
        projectId: 'project-demo-1',
        testSuiteName: 'Unit Tests',
        branch: 'main',
        commit: 'def456',
        buildNumber: '43',
        timestamp: yesterday,
        userId: 'user-demo',
        tests: [
          { name: 'test_user_login', status: 'passed' as const, duration: 145 },
          { name: 'test_user_registration', status: 'passed' as const, duration: 180 },
          { name: 'test_api_endpoint', status: 'passed' as const, duration: 120 },
          { name: 'test_flaky_network_call', status: 'passed' as const, duration: 300 },
        ],
        createdAt: yesterday,
      },
      {
        id: 'result-3',
        projectId: 'project-demo-2',
        testSuiteName: 'Integration Tests',
        branch: 'main',
        commit: 'ghi789',
        buildNumber: '15',
        timestamp: twoDaysAgo,
        userId: 'user-demo',
        tests: [
          { name: 'test_database_connection', status: 'passed' as const, duration: 500 },
          { name: 'test_external_api', status: 'failed' as const, duration: 2000, errorMessage: 'Rate limit exceeded' },
          { name: 'test_cache_performance', status: 'passed' as const, duration: 100 },
        ],
        createdAt: twoDaysAgo,
      },
    ];
    
    sampleResults.forEach(result => {
      testResults.set(result.id, result);
    });
  }
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

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Initialize demo test results on each function call
  initializeDemoTestResults();
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('Test results function called:', {
      path: event.path,
      httpMethod: event.httpMethod,
    });

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetTestResults(event);
      case 'POST':
        return await handleSubmitTestResults(event);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Test results function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function handleGetTestResults(event: HandlerEvent) {
  try {
    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await getUserFromToken(authHeader);

    // Get query parameters
    const projectId = event.queryStringParameters?.projectId;
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    
    // Filter test results
    let results = Array.from(testResults.values());
    
    if (projectId) {
      results = results.filter(result => result.projectId === projectId);
    }
    
    // Only return results for the authenticated user's projects
    results = results.filter(result => result.userId === user.userId);
    
    // Sort by timestamp (newest first) and limit
    results = results
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        testResults: results,
        total: results.length,
      }),
    };
  } catch (error) {
    console.error('Error fetching test results:', error);
    return {
      statusCode: error instanceof Error && error.message.includes('token') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch test results' 
      }),
    };
  }
}

async function handleSubmitTestResults(event: HandlerEvent) {
  try {
    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await getUserFromToken(authHeader);

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validatedData = testResultSchema.parse(body);
    
    // Create test result record
    const resultId = 'result-' + Date.now();
    const now = new Date().toISOString();
    
    const testResult = {
      id: resultId,
      projectId: validatedData.projectId,
      testSuiteName: validatedData.testSuiteName,
      branch: validatedData.branch,
      commit: validatedData.commit,
      buildNumber: validatedData.buildNumber,
      timestamp: validatedData.timestamp || now,
      userId: user.userId,
      tests: validatedData.tests,
      createdAt: now,
    };

    // Store test result
    testResults.set(resultId, testResult);

    console.log('Test result submitted successfully:', {
      projectId: testResult.projectId,
      testCount: testResult.tests.length,
      failedTests: testResult.tests.filter(t => t.status === 'failed').length,
    });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Test results submitted successfully',
        resultId: resultId,
        summary: {
          totalTests: testResult.tests.length,
          passed: testResult.tests.filter(t => t.status === 'passed').length,
          failed: testResult.tests.filter(t => t.status === 'failed').length,
          skipped: testResult.tests.filter(t => t.status === 'skipped').length,
        },
      }),
    };
  } catch (error) {
    console.error('Error submitting test results:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.errors,
        }),
      };
    }

    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    return {
      statusCode: error instanceof Error && error.message.includes('token') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to submit test results' 
      }),
    };
  }
}