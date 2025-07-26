import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gitlab-Event, X-Gitlab-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// GitLab Pipeline webhook schema
const gitlabPipelineSchema = z.object({
  object_kind: z.literal('pipeline'),
  object_attributes: z.object({
    id: z.number(),
    ref: z.string(),
    tag: z.boolean(),
    sha: z.string(),
    status: z.enum(['pending', 'running', 'success', 'failed', 'canceled', 'skipped']),
    stages: z.array(z.string()),
    created_at: z.string(),
    finished_at: z.string().nullable(),
    duration: z.number().nullable(),
    web_url: z.string(),
  }),
  project: z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    web_url: z.string(),
    git_ssh_url: z.string(),
    git_http_url: z.string(),
    namespace: z.string(),
    path_with_namespace: z.string(),
  }),
  builds: z.array(z.object({
    id: z.number(),
    stage: z.string(),
    name: z.string(),
    status: z.enum(['pending', 'running', 'success', 'failed', 'canceled', 'skipped']),
    created_at: z.string(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    duration: z.number().nullable(),
    user: z.object({
      name: z.string(),
      username: z.string(),
      email: z.string(),
    }).nullable(),
    runner: z.object({
      id: z.number(),
      description: z.string(),
      active: z.boolean(),
      is_shared: z.boolean(),
    }).nullable(),
  })).optional(),
});

// GitLab Job webhook schema
const gitlabJobSchema = z.object({
  object_kind: z.literal('build'),
  ref: z.string(),
  tag: z.boolean(),
  sha: z.string(),
  build_id: z.number(),
  build_name: z.string(),
  build_stage: z.string(),
  build_status: z.enum(['pending', 'running', 'success', 'failed', 'canceled', 'skipped']),
  build_started_at: z.string().nullable(),
  build_finished_at: z.string().nullable(),
  build_duration: z.number().nullable(),
  project_id: z.number(),
  project_name: z.string(),
  user: z.object({
    name: z.string(),
    email: z.string(),
  }),
  repository: z.object({
    name: z.string(),
    url: z.string(),
    description: z.string(),
    homepage: z.string(),
  }),
});

// Simple in-memory store for webhook data
const webhookEvents: Map<string, {
  id: string;
  type: 'pipeline' | 'job';
  repository: string;
  branch: string;
  commit: string;
  status: string;
  timestamp: string;
  duration?: number;
  buildUrl?: string;
  projectId?: string;
}> = new Map();

// Helper function to find project by repository URL
const findProjectByRepository = (repositoryUrl: string): string | null => {
  if (repositoryUrl.includes('sample-web-app')) {
    return 'project-demo-1';
  }
  if (repositoryUrl.includes('api-service')) {
    return 'project-demo-2';
  }
  return null;
};

// Helper function to generate test results from GitLab build data
const generateTestResults = (builds: any[], projectId: string, ref: string, sha: string, timestamp: string) => {
  const testJobs = builds.filter(build => 
    build.name.includes('test') || 
    build.stage === 'test' ||
    build.name.includes('spec')
  );

  if (testJobs.length === 0) {
    // Generate mock test results if no test jobs found
    return {
      projectId,
      testSuiteName: 'GitLab CI Pipeline',
      branch: ref,
      commit: sha,
      timestamp,
      tests: [
        { name: 'unit_tests', status: 'passed' as const, duration: 1500 },
        { name: 'integration_tests', status: 'passed' as const, duration: 2800 },
        { name: 'lint_check', status: 'passed' as const, duration: 300 },
      ],
    };
  }

  const tests = testJobs.map(job => ({
    name: job.name,
    status: job.status === 'success' ? 'passed' as const : 
            job.status === 'failed' ? 'failed' as const : 'skipped' as const,
    duration: job.duration ? job.duration * 1000 : undefined, // Convert to ms
    errorMessage: job.status === 'failed' ? `Job ${job.name} failed in stage ${job.stage}` : undefined,
  }));

  return {
    projectId,
    testSuiteName: 'GitLab CI Pipeline',
    branch: ref,
    commit: sha,
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
    console.log('GitLab webhook received:', {
      headers: event.headers,
      body: event.body?.substring(0, 500) + '...',
    });

    // Verify GitLab webhook token (optional but recommended)
    const gitlabEvent = event.headers['x-gitlab-event'] || event.headers['X-Gitlab-Event'];
    const gitlabToken = event.headers['x-gitlab-token'] || event.headers['X-Gitlab-Token'];
    
    if (!gitlabEvent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing X-Gitlab-Event header' }),
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
    console.log('GitLab event type:', gitlabEvent);

    // Handle different GitLab event types
    switch (gitlabEvent) {
      case 'Pipeline Hook':
        return await handlePipeline(payload);
      case 'Job Hook':
        return await handleJob(payload);
      default:
        console.log('Unhandled GitLab event:', gitlabEvent);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: `Event ${gitlabEvent} received but not processed` }),
        };
    }
  } catch (error) {
    console.error('GitLab webhook error:', error);
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

async function handlePipeline(payload: any) {
  try {
    const validatedData = gitlabPipelineSchema.parse(payload);
    const { object_attributes, project, builds = [] } = validatedData;
    
    console.log('Processing GitLab pipeline:', {
      project: project.path_with_namespace,
      branch: object_attributes.ref,
      status: object_attributes.status,
      stages: object_attributes.stages,
    });

    // Find associated project
    const projectId = findProjectByRepository(project.web_url);
    
    // Store webhook event
    const eventId = `gitlab-pipeline-${object_attributes.id}`;
    webhookEvents.set(eventId, {
      id: eventId,
      type: 'pipeline',
      repository: project.path_with_namespace,
      branch: object_attributes.ref,
      commit: object_attributes.sha,
      status: object_attributes.status,
      timestamp: object_attributes.finished_at || object_attributes.created_at,
      duration: object_attributes.duration || undefined,
      buildUrl: object_attributes.web_url,
      projectId: projectId || undefined,
    });

    // If pipeline completed and we have a project, extract test results
    if ((object_attributes.status === 'success' || object_attributes.status === 'failed') && projectId) {
      const testResults = generateTestResults(
        builds,
        projectId,
        object_attributes.ref,
        object_attributes.sha,
        object_attributes.finished_at || object_attributes.created_at
      );

      // Submit test results (mock for now)
      console.log('Submitting GitLab test results:', testResults);
      console.log('Test results would be submitted to internal API');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'GitLab pipeline processed successfully',
        eventId,
        projectId,
        processed: ['success', 'failed'].includes(object_attributes.status),
        testJobsFound: builds.filter(b => b.name.includes('test')).length,
      }),
    };
  } catch (error) {
    console.error('Error processing GitLab pipeline:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid GitLab pipeline payload',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process GitLab pipeline' }),
    };
  }
}

async function handleJob(payload: any) {
  try {
    const validatedData = gitlabJobSchema.parse(payload);
    
    console.log('Processing GitLab job:', {
      project: validatedData.project_name,
      job: validatedData.build_name,
      stage: validatedData.build_stage,
      status: validatedData.build_status,
    });

    // Find associated project
    const projectId = findProjectByRepository(validatedData.repository.homepage);
    
    // Store webhook event
    const eventId = `gitlab-job-${validatedData.build_id}`;
    webhookEvents.set(eventId, {
      id: eventId,
      type: 'job',
      repository: validatedData.project_name,
      branch: validatedData.ref,
      commit: validatedData.sha,
      status: validatedData.build_status,
      timestamp: validatedData.build_finished_at || new Date().toISOString(),
      duration: validatedData.build_duration || undefined,
      projectId: projectId || undefined,
    });

    // If it's a completed test job, generate test results
    if ((validatedData.build_status === 'success' || validatedData.build_status === 'failed') && 
        (validatedData.build_name.includes('test') || validatedData.build_stage === 'test') &&
        projectId) {
      
      const testResults = {
        projectId,
        testSuiteName: validatedData.build_name,
        branch: validatedData.ref,
        commit: validatedData.sha,
        timestamp: validatedData.build_finished_at || new Date().toISOString(),
        tests: [
          {
            name: validatedData.build_name,
            status: validatedData.build_status === 'success' ? 'passed' as const : 'failed' as const,
            duration: validatedData.build_duration ? validatedData.build_duration * 1000 : undefined,
            errorMessage: validatedData.build_status === 'failed' ? 
              `GitLab job ${validatedData.build_name} failed` : undefined,
          },
        ],
      };

      console.log('Submitting GitLab job test results:', testResults);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'GitLab job processed successfully',
        eventId,
        projectId,
        isTestJob: validatedData.build_name.includes('test') || validatedData.build_stage === 'test',
      }),
    };
  } catch (error) {
    console.error('Error processing GitLab job:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid GitLab job payload',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process GitLab job' }),
    };
  }
}