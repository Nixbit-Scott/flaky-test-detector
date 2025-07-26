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

// Simple in-memory store for projects (resets on cold start)
const projects: Map<string, {
  id: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}> = new Map();

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
    console.log('Projects function called:', {
      path: event.path,
      httpMethod: event.httpMethod,
    });

    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await getUserFromToken(authHeader);

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetProjects(event, user);
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
    console.error('Projects function error:', error);
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Authentication failed' }),
    };
  }
};

async function handleGetProjects(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    // Get projects for the authenticated user
    const userProjects = Array.from(projects.values())
      .filter(project => project.userId === user.userId)
      .map(project => ({
        ...project,
        testCount: Math.floor(Math.random() * 200), // Mock data
        flakyTestCount: Math.floor(Math.random() * 10),
        lastTestRun: new Date().toISOString(),
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        projects: userProjects,
        total: userProjects.length,
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
    
    // Create project
    const projectId = 'project-' + Date.now();
    const now = new Date().toISOString();
    
    const project = {
      id: projectId,
      name: validatedData.name,
      description: validatedData.description || '',
      repositoryUrl: validatedData.repositoryUrl || '',
      userId: user.userId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    // Store project
    projects.set(projectId, project);

    // Add mock stats
    const projectWithStats = {
      ...project,
      testCount: 0,
      flakyTestCount: 0,
      lastTestRun: null,
    };

    console.log('Project created successfully:', project.name);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Project created successfully',
        project: projectWithStats,
      }),
    };
  } catch (error) {
    console.error('Error creating project:', error);
    
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
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create project' }),
    };
  }
}