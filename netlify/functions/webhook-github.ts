import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-GitHub-Event, X-Hub-Signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// GitHub Actions workflow run schema
const githubWorkflowSchema = z.object({
  action: z.string(),
  workflow_run: z.object({
    id: z.number(),
    name: z.string(),
    head_branch: z.string(),
    head_sha: z.string(),
    status: z.enum(['queued', 'in_progress', 'completed']),
    conclusion: z.enum(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required']).nullable(),
    html_url: z.string(),
    run_number: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
    html_url: z.string(),
  }),
});

// GitHub Check Run schema (for test results)
const githubCheckRunSchema = z.object({
  action: z.string(),
  check_run: z.object({
    id: z.number(),
    name: z.string(),
    status: z.enum(['queued', 'in_progress', 'completed']),
    conclusion: z.enum(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required']).nullable(),
    output: z.object({
      title: z.string().optional(),
      summary: z.string().optional(),
      text: z.string().optional(),
    }).optional(),
    html_url: z.string(),
  }),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
  }),
});

// Simple in-memory store for webhook data (resets on cold start)
const webhookEvents: Map<string, {
  id: string;
  type: 'workflow_run' | 'check_run';
  repository: string;
  branch: string;
  commit: string;
  status: string;
  conclusion?: string;
  timestamp: string;
  buildNumber?: string;
  buildUrl?: string;
  projectId?: string;
}> = new Map();

// Helper function to find project by repository URL
const findProjectByRepository = (repositoryUrl: string): string | null => {
  // In production, this would query the database to find the project by repository URL
  // For now, return null as no project mapping exists
  return null;
};

// Helper function to parse test results from GitHub Actions output
const parseTestResults = (output?: { summary?: string; text?: string }) => {
  if (!output?.text && !output?.summary) {
    return [];
  }
  
  // Mock test result parsing - in real implementation, this would parse actual test output
  const mockTests = [
    { name: 'test_user_authentication', status: 'passed' as const, duration: 150 },
    { name: 'test_api_endpoints', status: 'passed' as const, duration: 200 },
    { name: 'test_database_connection', status: output.summary?.includes('failure') ? 'failed' as const : 'passed' as const, duration: 300 },
  ];
  
  return mockTests;
};

// Helper function to submit test results to our API
const submitTestResults = async (projectId: string, testData: any) => {
  try {
    // In a real implementation, this would make an internal API call
    console.log('Submitting test results for project:', projectId, testData);
    
    // Mock successful submission
    return { success: true, resultId: 'result-' + Date.now() };
  } catch (error) {
    console.error('Failed to submit test results:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
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
    console.log('GitHub webhook received:', {
      headers: event.headers,
      body: event.body?.substring(0, 500) + '...',
    });

    // Verify GitHub webhook signature (in production, you'd verify the actual signature)
    const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];
    const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
    
    if (!githubEvent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing X-GitHub-Event header' }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const payload = JSON.parse(event.body);
    console.log('GitHub event type:', githubEvent);

    // Handle different GitHub event types
    switch (githubEvent) {
      case 'workflow_run':
        return await handleWorkflowRun(payload);
      case 'check_run':
        return await handleCheckRun(payload);
      case 'ping':
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'GitHub webhook configured successfully!' }),
        };
      default:
        console.log('Unhandled GitHub event:', githubEvent);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: `Event ${githubEvent} received but not processed` }),
        };
    }
  } catch (error) {
    console.error('GitHub webhook error:', error);
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

async function handleWorkflowRun(payload: any) {
  try {
    const validatedData = githubWorkflowSchema.parse(payload);
    const { workflow_run, repository } = validatedData;
    
    console.log('Processing workflow run:', {
      repository: repository.full_name,
      branch: workflow_run.head_branch,
      status: workflow_run.status,
      conclusion: workflow_run.conclusion,
    });

    // Find associated project
    const projectId = findProjectByRepository(repository.html_url);
    
    // Store webhook event
    const eventId = `github-${workflow_run.id}`;
    webhookEvents.set(eventId, {
      id: eventId,
      type: 'workflow_run',
      repository: repository.full_name,
      branch: workflow_run.head_branch,
      commit: workflow_run.head_sha,
      status: workflow_run.status,
      conclusion: workflow_run.conclusion || undefined,
      timestamp: workflow_run.updated_at,
      buildNumber: workflow_run.run_number.toString(),
      buildUrl: workflow_run.html_url,
      projectId: projectId || undefined,
    });

    // If workflow completed, try to extract test results
    if (workflow_run.status === 'completed' && projectId) {
      const testResults = {
        projectId,
        testSuiteName: workflow_run.name,
        branch: workflow_run.head_branch,
        commit: workflow_run.head_sha,
        buildNumber: workflow_run.run_number.toString(),
        timestamp: workflow_run.updated_at,
        tests: [
          // Mock test results based on workflow conclusion
          {
            name: 'integration_tests',
            status: workflow_run.conclusion === 'success' ? 'passed' : 'failed',
            duration: 2500,
            errorMessage: workflow_run.conclusion === 'failure' ? 'Workflow failed - check logs' : undefined,
          },
          {
            name: 'unit_tests',
            status: 'passed',
            duration: 1200,
          },
          {
            name: 'e2e_tests',
            status: workflow_run.conclusion === 'success' ? 'passed' : 'failed',
            duration: 5000,
            errorMessage: workflow_run.conclusion === 'failure' ? 'End-to-end tests failed' : undefined,
          },
        ],
      };

      // Submit test results
      const submission = await submitTestResults(projectId, testResults);
      console.log('Test results submission:', submission);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Workflow run processed successfully',
        eventId,
        projectId,
        processed: workflow_run.status === 'completed',
      }),
    };
  } catch (error) {
    console.error('Error processing workflow run:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid workflow run payload',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process workflow run' }),
    };
  }
}

async function handleCheckRun(payload: any) {
  try {
    const validatedData = githubCheckRunSchema.parse(payload);
    const { check_run, repository } = validatedData;
    
    console.log('Processing check run:', {
      repository: repository.full_name,
      check: check_run.name,
      status: check_run.status,
      conclusion: check_run.conclusion,
    });

    // Find associated project
    const projectId = findProjectByRepository(repository.html_url);
    
    // Store webhook event
    const eventId = `github-check-${check_run.id}`;
    webhookEvents.set(eventId, {
      id: eventId,
      type: 'check_run',
      repository: repository.full_name,
      branch: 'main', // Check runs don't always include branch info
      commit: 'unknown',
      status: check_run.status,
      conclusion: check_run.conclusion || undefined,
      timestamp: new Date().toISOString(),
      projectId: projectId || undefined,
    });

    // If check run completed with test results, process them
    if (check_run.status === 'completed' && check_run.output && projectId) {
      const tests = parseTestResults(check_run.output);
      
      if (tests.length > 0) {
        const testResults = {
          projectId,
          testSuiteName: check_run.name,
          branch: 'main',
          commit: 'from-check-run',
          timestamp: new Date().toISOString(),
          tests,
        };

        const submission = await submitTestResults(projectId, testResults);
        console.log('Check run test results submission:', submission);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Check run processed successfully',
        eventId,
        projectId,
        testsFound: check_run.output ? true : false,
      }),
    };
  } catch (error) {
    console.error('Error processing check run:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid check run payload',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process check run' }),
    };
  }
}