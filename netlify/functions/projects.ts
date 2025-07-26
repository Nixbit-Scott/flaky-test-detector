import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';
import { getPrismaClient } from './db';

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
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function handleGetProjects(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    const prisma = getPrismaClient();
    
    // Get projects for the authenticated user
    const projects = await prisma.project.findMany({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        description: true,
        repositoryUrl: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        // Add test counts (will be calculated from test results later)
      },
      orderBy: { createdAt: 'desc' }
    });

    // For now, add mock test counts (will be replaced with real data later)
    const projectsWithStats = projects.map(project => ({
      ...project,
      testCount: 0,
      flakyTestCount: 0,
      lastTestRun: null,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        projects: projectsWithStats,
        total: projects.length,
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
    
    const prisma = getPrismaClient();
    
    // Create project in database
    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        repositoryUrl: validatedData.repositoryUrl || null,
        userId: user.userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        repositoryUrl: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
      }
    });

    // Add mock stats for now
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