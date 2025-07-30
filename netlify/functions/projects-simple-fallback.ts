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
const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  repositoryUrl: z.string().url().optional(),
});

// Simple in-memory store that persists during function warm-up
const projectsStore = new Map<string, any[]>();

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
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('Projects simple fallback function called:', {
      path: event.path,
      httpMethod: event.httpMethod,
    });

    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await getUserFromToken(authHeader);

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetProjects(user);
      case 'POST':
        return await handleCreateProject(event, user);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Projects simple fallback function error:', error);
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('token')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication failed' }),
      };
    }
    
    // Return more detailed error information
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
    };
  }
};

async function handleGetProjects(user: { userId: string; email: string }) {
  try {
    // Get projects for the authenticated user from in-memory store
    const userProjects = projectsStore.get(user.userId) || [];
    
    const formattedProjects = userProjects.map(project => ({
      ...project,
      repository: project.repositoryUrl || '',
      branch: 'main',
      retryEnabled: true,
      maxRetries: 3,
      flakyThreshold: 0.2,
      _count: {
        testRuns: 0,
        flakyTests: 0,
      },
      testCount: 0,
      flakyTestCount: 0,
      lastTestRun: null,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        projects: formattedProjects,
        total: formattedProjects.length,
      }),
    };
  } catch (error) {
    console.error('Error fetching projects:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch projects' }),
    };
  }
}

async function handleCreateProject(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validatedData = createProjectSchema.parse(body);
    
    // Create project in memory
    const projectId = 'project-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    
    const newProject = {
      id: projectId,
      name: validatedData.name,
      description: validatedData.description || '',
      repositoryUrl: validatedData.repositoryUrl || '',
      userId: user.userId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    // Store in memory
    const userProjects = projectsStore.get(user.userId) || [];
    userProjects.push(newProject);
    projectsStore.set(user.userId, userProjects);

    // Add mock stats and match frontend interface
    const projectWithStats = {
      ...newProject,
      repository: newProject.repositoryUrl || '',
      branch: 'main',
      retryEnabled: true,
      maxRetries: 3,
      flakyThreshold: 0.2,
      _count: {
        testRuns: 0,
        flakyTests: 0,
      },
      testCount: 0,
      flakyTestCount: 0,
      lastTestRun: null,
    };

    console.log('Project created successfully in fallback:', newProject.name);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Project created successfully',
        project: projectWithStats,
      }),
    };
  } catch (error) {
    console.error('Error creating project in fallback:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.issues,
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
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
    };
  }
}