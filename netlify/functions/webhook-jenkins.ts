import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Jenkins-Event',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Jenkins build notification schema
const jenkinsBuildSchema = z.object({
  name: z.string(),
  url: z.string(),
  build: z.object({
    full_url: z.string(),
    number: z.number(),
    queue_id: z.number(),
    timestamp: z.number(),
    duration: z.number(),
    result: z.enum(['SUCCESS', 'FAILURE', 'UNSTABLE', 'ABORTED', 'NOT_BUILT']).nullable(),
    builtOn: z.string().optional(),
    changeSet: z.object({
      items: z.array(z.object({
        commitId: z.string().optional(),
        timestamp: z.number().optional(),
        author: z.object({
          fullName: z.string(),
          email: z.string().optional(),
        }).optional(),
        affectedPaths: z.array(z.string()).optional(),
        msg: z.string().optional(),
      })).optional(),
      kind: z.string().optional(),
    }).optional(),
    culprits: z.array(z.object({
      fullName: z.string(),
    })).optional(),
    parameters: z.array(z.object({
      name: z.string(),
      value: z.string(),
    })).optional(),
  }),
  phase: z.enum(['STARTED', 'COMPLETED', 'FINALIZED']),
  status: z.enum(['SUCCESS', 'FAILURE', 'UNSTABLE', 'ABORTED', 'NOT_BUILT']).nullable(),
});

// Generic Jenkins notification schema (for flexibility)
const jenkinsGenericSchema = z.object({
  jobName: z.string().optional(),
  buildNumber: z.number().optional(),
  buildStatus: z.string().optional(),
  buildUrl: z.string().optional(),
  gitBranch: z.string().optional(),
  gitCommit: z.string().optional(),
  testResults: z.object({
    totalCount: z.number().optional(),
    failCount: z.number().optional(),
    skipCount: z.number().optional(),
    passCount: z.number().optional(),
    suites: z.array(z.object({
      name: z.string(),
      tests: z.array(z.object({
        name: z.string(),
        status: z.string(),
        duration: z.number().optional(),
        errorMessage: z.string().optional(),
        stackTrace: z.string().optional(),
      })).optional(),
    })).optional(),
  }).optional(),
});

// Simple in-memory store for webhook data
const webhookEvents: Map<string, {
  id: string;
  type: 'build' | 'generic';
  jobName: string;
  buildNumber: number;
  status: string;
  timestamp: string;
  duration?: number;
  buildUrl?: string;
  projectId?: string;
  branch?: string;
  commit?: string;
}> = new Map();

// Helper function to find project by job name or URL
const findProjectByJobName = (jobName: string, buildUrl?: string): string | null => {
  // Match based on job name patterns
  if (jobName.toLowerCase().includes('sample-web-app') || 
      jobName.toLowerCase().includes('web-app') ||
      buildUrl?.includes('sample-web-app')) {
    return 'project-demo-1';
  }
  if (jobName.toLowerCase().includes('api-service') || 
      jobName.toLowerCase().includes('api') ||
      buildUrl?.includes('api-service')) {
    return 'project-demo-2';
  }
  return null;
};

// Helper function to parse Jenkins test results
const parseJenkinsTestResults = (testResults: any, jobName: string, buildNumber: number, timestamp: string) => {
  if (!testResults || !testResults.suites) {
    // Generate mock test results based on job name
    const mockTests = [
      { 
        name: 'unit_tests', 
        status: 'passed', 
        duration: 1200 
      },
      { 
        name: 'integration_tests', 
        status: jobName.includes('failed') ? 'failed' : 'passed', 
        duration: 2500,
        errorMessage: jobName.includes('failed') ? 'Integration test failed in Jenkins' : undefined
      },
      { 
        name: 'smoke_tests', 
        status: 'passed', 
        duration: 800 
      },
    ];

    return {
      testSuiteName: `Jenkins - ${jobName}`,
      branch: 'main', // Default branch
      commit: 'jenkins-build-' + buildNumber,
      buildNumber: buildNumber.toString(),
      timestamp,
      tests: mockTests,
    };
  }

  // Parse actual test results if provided
  const tests: any[] = [];
  testResults.suites.forEach((suite: any) => {
    if (suite.tests) {
      suite.tests.forEach((test: any) => {
        tests.push({
          name: test.name,
          status: test.status.toLowerCase() === 'passed' ? 'passed' : 
                  test.status.toLowerCase() === 'failed' ? 'failed' : 'skipped',
          duration: test.duration,
          errorMessage: test.errorMessage,
          stackTrace: test.stackTrace,
        });
      });
    }
  });

  return {
    testSuiteName: `Jenkins - ${jobName}`,
    branch: 'main',
    commit: 'jenkins-build-' + buildNumber,
    buildNumber: buildNumber.toString(),
    timestamp,
    tests,
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
    console.log('Jenkins webhook received:', {
      headers: event.headers,
      body: event.body?.substring(0, 500) + '...',
    });

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const payload = JSON.parse(event.body);
    console.log('Jenkins payload keys:', Object.keys(payload));

    // Try to parse as Jenkins build notification first, then generic
    try {
      const buildData = jenkinsBuildSchema.parse(payload);
      return await handleJenkinsBuild(buildData);
    } catch (buildError) {
      console.log('Not a standard Jenkins build notification, trying generic format');
      
      try {
        const genericData = jenkinsGenericSchema.parse(payload);
        return await handleGenericJenkins(genericData);
      } catch (genericError) {
        console.log('Not a recognized Jenkins format, processing as raw data');
        return await handleRawJenkins(payload);
      }
    }
  } catch (error) {
    console.error('Jenkins webhook error:', error);
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

async function handleJenkinsBuild(data: z.infer<typeof jenkinsBuildSchema>) {
  try {
    const { name, build, phase, status } = data;
    
    console.log('Processing Jenkins build:', {
      jobName: name,
      buildNumber: build.number,
      phase,
      status,
      result: build.result,
    });

    // Find associated project
    const projectId = findProjectByJobName(name, build.full_url);
    
    // Store webhook event
    const eventId = `jenkins-${name}-${build.number}`;
    webhookEvents.set(eventId, {
      id: eventId,
      type: 'build',
      jobName: name,
      buildNumber: build.number,
      status: build.result || status || 'UNKNOWN',
      timestamp: new Date(build.timestamp).toISOString(),
      duration: build.duration,
      buildUrl: build.full_url,
      projectId: projectId || undefined,
      branch: 'main', // Jenkins doesn't always provide branch info
      commit: build.changeSet?.items?.[0]?.commitId,
    });

    // If build completed and we have a project, process test results
    if (phase === 'COMPLETED' && projectId) {
      const testResults = parseJenkinsTestResults(
        null, // No test results in basic Jenkins notification
        name,
        build.number,
        new Date(build.timestamp).toISOString()
      );

      console.log('Jenkins test results generated:', {
        projectId,
        testCount: testResults.tests.length,
        jobName: name,
      });

      // In a real implementation, this would submit to the test-results API
      console.log('Test results would be submitted to internal API');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Jenkins build processed successfully',
        eventId,
        projectId,
        processed: phase === 'COMPLETED',
        jobName: name,
        buildNumber: build.number,
      }),
    };
  } catch (error) {
    console.error('Error processing Jenkins build:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process Jenkins build' }),
    };
  }
}

async function handleGenericJenkins(data: z.infer<typeof jenkinsGenericSchema>) {
  try {
    const { jobName = 'unknown', buildNumber = 0, buildStatus = 'UNKNOWN', testResults } = data;
    
    console.log('Processing generic Jenkins notification:', {
      jobName,
      buildNumber,
      buildStatus,
      hasTestResults: !!testResults,
    });

    // Find associated project
    const projectId = findProjectByJobName(jobName, data.buildUrl);
    
    // Store webhook event
    const eventId = `jenkins-generic-${jobName}-${buildNumber}`;
    const timestamp = new Date().toISOString();
    
    webhookEvents.set(eventId, {
      id: eventId,
      type: 'generic',
      jobName,
      buildNumber,
      status: buildStatus,
      timestamp,
      buildUrl: data.buildUrl,
      projectId: projectId || undefined,
      branch: data.gitBranch || 'main',
      commit: data.gitCommit,
    });

    // Process test results if provided and we have a project
    if (testResults && projectId) {
      const parsedResults = parseJenkinsTestResults(testResults, jobName, buildNumber, timestamp);
      
      console.log('Jenkins generic test results:', {
        projectId,
        testCount: parsedResults.tests.length,
        failCount: testResults.failCount,
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Generic Jenkins notification processed successfully',
        eventId,
        projectId,
        jobName,
        buildNumber,
        testResultsProcessed: !!testResults,
      }),
    };
  } catch (error) {
    console.error('Error processing generic Jenkins notification:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process generic Jenkins notification' }),
    };
  }
}

async function handleRawJenkins(payload: any) {
  try {
    console.log('Processing raw Jenkins payload:', payload);
    
    // Extract whatever information we can from the raw payload
    const jobName = payload.job_name || payload.jobName || payload.name || 'unknown-job';
    const buildNumber = payload.build_number || payload.buildNumber || payload.number || 0;
    const status = payload.status || payload.result || payload.build_status || 'UNKNOWN';
    
    const eventId = `jenkins-raw-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    webhookEvents.set(eventId, {
      id: eventId,
      type: 'generic',
      jobName,
      buildNumber,
      status,
      timestamp,
      buildUrl: payload.build_url || payload.url,
    });

    console.log('Raw Jenkins event stored:', {
      eventId,
      jobName,
      buildNumber,
      status,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Raw Jenkins webhook processed successfully',
        eventId,
        extracted: { jobName, buildNumber, status },
        note: 'Payload did not match expected Jenkins formats, but was processed',
      }),
    };
  } catch (error) {
    console.error('Error processing raw Jenkins payload:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process raw Jenkins payload' }),
    };
  }
}