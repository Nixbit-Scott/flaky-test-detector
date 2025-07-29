import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CI-System, X-Webhook-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Flexible generic webhook schema
const genericWebhookSchema = z.object({
  // Basic build information
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  repositoryUrl: z.string().optional(),
  
  // Build details
  buildId: z.string().optional(),
  buildNumber: z.union([z.string(), z.number()]).optional(),
  buildUrl: z.string().optional(),
  buildStatus: z.string(),
  
  // Git information
  branch: z.string().optional(),
  commit: z.string().optional(),
  commitMessage: z.string().optional(),
  
  // Test results (flexible format)
  testResults: z.object({
    testSuiteName: z.string().optional(),
    totalTests: z.number().optional(),
    passedTests: z.number().optional(),
    failedTests: z.number().optional(),
    skippedTests: z.number().optional(),
    duration: z.number().optional(),
    tests: z.array(z.object({
      name: z.string(),
      status: z.enum(['passed', 'failed', 'skipped']),
      duration: z.number().optional(),
      errorMessage: z.string().optional(),
      stackTrace: z.string().optional(),
      retryCount: z.number().optional(),
    })).optional(),
  }).optional(),
  
  // Metadata
  timestamp: z.string().optional(),
  ciSystem: z.string().optional(),
  environment: z.string().optional(),
});

// Alternative simplified schema for minimal payloads
const simpleWebhookSchema = z.object({
  status: z.string(),
  project: z.string().optional(),
  branch: z.string().optional(),
  commit: z.string().optional(),
  tests: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    duration: z.number().optional(),
    error: z.string().optional(),
  })).optional(),
});

// Simple in-memory store for webhook data
const webhookEvents: Map<string, {
  id: string;
  ciSystem: string;
  projectId?: string;
  projectName?: string;
  buildStatus: string;
  branch?: string;
  commit?: string;
  timestamp: string;
  testCount?: number;
  passedTests?: number;
  failedTests?: number;
  buildUrl?: string;
}> = new Map();

// Helper function to find project by various identifiers
// TODO: In production, this should query the database to find the project
// based on projectId, project name, repository URL, or other identifiers
const findProject = (payload: any): string | null => {
  // Try explicit projectId first
  if (payload.projectId) {
    return payload.projectId;
  }
  
  // In production, implement database lookup:
  // const projectName = payload.projectName || payload.project || '';
  // const repositoryUrl = payload.repositoryUrl || payload.repository || '';
  // 
  // const project = await db.project.findFirst({
  //   where: {
  //     OR: [
  //       { name: { contains: projectName, mode: 'insensitive' } },
  //       { repositoryUrl: repositoryUrl },
  //       { slug: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-') }
  //     ]
  //   }
  // });
  // return project?.id || null;
  
  console.log('Project lookup needed for payload:', {
    projectName: payload.projectName || payload.project,
    repositoryUrl: payload.repositoryUrl || payload.repository
  });
  
  return null;
};

// Helper function to normalize test results
const normalizeTestResults = (payload: any) => {
  if (payload.testResults) {
    return payload.testResults;
  }
  
  // Handle simplified test format
  if (payload.tests) {
    const tests = payload.tests.map((test: any) => ({
      name: test.name,
      status: test.passed ? 'passed' : 'failed',
      duration: test.duration,
      errorMessage: test.error,
    }));
    
    return {
      testSuiteName: 'Generic CI Tests',
      tests,
      totalTests: tests.length,
      passedTests: tests.filter((t: any) => t.status === 'passed').length,
      failedTests: tests.filter((t: any) => t.status === 'failed').length,
      skippedTests: tests.filter((t: any) => t.status === 'skipped').length,
    };
  }
  
  // Generate basic test result structure when no detailed results are available
  // In production, CI systems should provide actual test results in the webhook payload
  const mockTests = [
    {
      name: 'ci_pipeline_check',
      status: payload.buildStatus === 'success' ? 'passed' : 'failed',
      duration: 1500,
      errorMessage: payload.buildStatus !== 'success' ? 'CI pipeline failed' : undefined,
    },
  ];
  
  return {
    testSuiteName: 'Generic CI Pipeline',
    tests: mockTests,
    totalTests: mockTests.length,
    passedTests: mockTests.filter(t => t.status === 'passed').length,
    failedTests: mockTests.filter(t => t.status === 'failed').length,
    skippedTests: mockTests.filter(t => t.status === 'skipped').length,
  };
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
    };
  }

  try {
    console.log('Generic webhook received:', {
      headers: event.headers,
      body: event.body?.substring(0, 500) + '...',
    });

    // Check for CI system identifier
    const ciSystem = event.headers['x-ci-system'] || 
                    event.headers['X-CI-System'] || 
                    event.headers['user-agent'] || 
                    'unknown';

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const payload = JSON.parse(event.body);
    console.log('Generic webhook payload keys:', Object.keys(payload));

    // Try to parse with different schemas
    let validatedData;
    let schemaUsed = 'unknown';
    
    try {
      validatedData = genericWebhookSchema.parse(payload);
      schemaUsed = 'generic';
    } catch (genericError) {
      try {
        validatedData = simpleWebhookSchema.parse(payload);
        schemaUsed = 'simple';
      } catch (simpleError) {
        // If neither schema works, process as raw data
        validatedData = payload;
        schemaUsed = 'raw';
      }
    }

    return await processGenericWebhook(validatedData, ciSystem, schemaUsed);
  } catch (error) {
    console.error('Generic webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

async function processGenericWebhook(data: any, ciSystem: string, schemaUsed: string) {
  try {
    // Extract core information with fallbacks
    const buildStatus = data.buildStatus || data.status || 'unknown';
    const projectName = data.projectName || data.project || 'unknown-project';
    const branch = data.branch || 'main';
    const commit = data.commit || 'unknown-commit';
    const timestamp = data.timestamp || new Date().toISOString();
    
    console.log('Processing generic webhook:', {
      ciSystem,
      schemaUsed,
      buildStatus,
      projectName,
      branch,
    });

    // Find associated project
    const projectId = findProject(data);
    
    // Normalize test results
    const testResults = normalizeTestResults(data);
    
    // Store webhook event
    const eventId = `generic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    webhookEvents.set(eventId, {
      id: eventId,
      ciSystem,
      projectId: projectId || undefined,
      projectName,
      buildStatus,
      branch,
      commit,
      timestamp,
      testCount: testResults.totalTests,
      passedTests: testResults.passedTests,
      failedTests: testResults.failedTests,
      buildUrl: data.buildUrl,
    });

    // If we have test results and a project, prepare for submission
    if (testResults.tests && testResults.tests.length > 0 && projectId) {
      const testSubmission = {
        projectId,
        testSuiteName: testResults.testSuiteName || 'Generic CI Tests',
        branch,
        commit,
        buildNumber: data.buildNumber?.toString(),
        timestamp,
        tests: testResults.tests,
      };

      console.log('Generic webhook test results prepared:', {
        projectId,
        testCount: testResults.tests.length,
        passedTests: testResults.passedTests,
        failedTests: testResults.failedTests,
      });

      // In a real implementation, this would submit to the test-results API
      console.log('Test results would be submitted to internal API');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Generic webhook processed successfully',
        eventId,
        ciSystem,
        schemaUsed,
        projectId,
        projectName,
        buildStatus,
        testResultsFound: testResults.tests ? testResults.tests.length : 0,
        recommendations: generateRecommendations(data, ciSystem),
      }),
    };
  } catch (error) {
    console.error('Error processing generic webhook:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process generic webhook' }),
    };
  }
}

function generateRecommendations(data: any, ciSystem: string): string[] {
  const recommendations: string[] = [];
  
  // Check for missing fields and provide recommendations
  if (!data.projectId && !data.projectName) {
    recommendations.push('Include projectId or projectName for automatic project mapping');
  }
  
  if (!data.testResults && !data.tests) {
    recommendations.push('Include test results in the webhook payload for flaky test detection');
  }
  
  if (!data.branch) {
    recommendations.push('Include branch information for better test result organization');
  }
  
  if (!data.commit) {
    recommendations.push('Include commit SHA for traceability');
  }
  
  // CI system specific recommendations
  if (ciSystem.toLowerCase().includes('circle')) {
    recommendations.push('Consider using CircleCI orb for better integration');
  } else if (ciSystem.toLowerCase().includes('travis')) {
    recommendations.push('Use Travis CI webhook notifications for real-time updates');
  } else if (ciSystem.toLowerCase().includes('azure')) {
    recommendations.push('Azure DevOps service hooks can provide richer payload data');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Webhook integration looks good! Monitor the dashboard for test results.');
  }
  
  return recommendations;
}