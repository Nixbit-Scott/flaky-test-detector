import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
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

  try {
    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No valid token provided' }),
      };
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetProjects(event);
      case 'POST':
        return await handleCreateProject(event);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Projects function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function handleGetProjects(event: HandlerEvent) {
  // TODO: Replace with actual database query
  const mockProjects = [
    {
      id: 'project-1',
      name: 'Sample Project',
      description: 'A sample project for testing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      testCount: 150,
      flakyTestCount: 5,
    },
    {
      id: 'project-2',
      name: 'Frontend Tests',
      description: 'Frontend test suite',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      testCount: 89,
      flakyTestCount: 2,
    },
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      projects: mockProjects,
      total: mockProjects.length,
    }),
  };
}

async function handleCreateProject(event: HandlerEvent) {
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Basic validation
    if (!body.name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Project name is required' }),
      };
    }

    // TODO: Replace with actual database creation
    const mockProject = {
      id: 'new-project-' + Date.now(),
      name: body.name,
      description: body.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      testCount: 0,
      flakyTestCount: 0,
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Project created successfully',
        project: mockProject,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Invalid request body',
      }),
    };
  }
}