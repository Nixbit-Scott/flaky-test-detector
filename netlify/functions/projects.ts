import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';
import { 
  getProjectsByUserId, 
  createProject, 
  updateProject, 
  deleteProject,
  getUserById,
  createUser,
  Project 
} from './supabase-client';

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

// Simple in-memory store that persists during function warm-up
const projectsStore = new Map<string, any[]>();

async function handleGetProjects(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    console.log('Attempting to get projects for user:', user.userId);
    
    // Try Supabase first
    try {
      const userProjects = await getProjectsByUserId(user.userId);
      console.log('Successfully got projects from Supabase:', userProjects.length);
      
      if (userProjects.length > 0) {
        const formattedProjects = userProjects.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description,
          repositoryUrl: project.repository_url,
          userId: project.user_id,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
          isActive: project.is_active,
          repository: project.repository_url || '',
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
      }
    } catch (supabaseError) {
      console.warn('Supabase failed, using fallback:', supabaseError);
    }
    
    // Fallback to in-memory store
    const userProjects = projectsStore.get(user.userId) || [];
    console.log('Using fallback storage, found projects:', userProjects.length);
    
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
      body: JSON.stringify({ 
        error: 'Failed to fetch projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}

async function handleCreateProject(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    console.log('Attempting to create project for user:', user.userId);
    
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validatedData = createProjectSchema.parse(body);
    console.log('Validated project data:', validatedData);
    
    const projectId = 'project-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    
    // Try Supabase first
    let newProject;
    try {
      console.log('Attempting to create project in Supabase...');
      
      const projectData = {
        id: projectId,
        name: validatedData.name,
        description: validatedData.description,
        repository_url: validatedData.repositoryUrl,
        user_id: user.userId,
        is_active: true,
      };

      newProject = await createProject(projectData);
      console.log('Successfully created project in Supabase:', newProject.name);
      
    } catch (supabaseError) {
      console.warn('Supabase failed, using fallback storage:', supabaseError);
      
      // Fallback to in-memory storage
      newProject = {
        id: projectId,
        name: validatedData.name,
        description: validatedData.description,
        repository_url: validatedData.repositoryUrl,
        user_id: user.userId,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      
      // Store in memory
      const userProjects = projectsStore.get(user.userId) || [];
      userProjects.push({
        id: projectId,
        name: validatedData.name,
        description: validatedData.description || '',
        repositoryUrl: validatedData.repositoryUrl || '',
        userId: user.userId,
        createdAt: now,
        updatedAt: now,
        isActive: true,
      });
      projectsStore.set(user.userId, userProjects);
      console.log('Successfully created project in fallback storage:', newProject.name);
    }

    // Add mock stats and match frontend interface
    const projectWithStats = {
      id: newProject.id,
      name: newProject.name,
      description: newProject.description,
      repositoryUrl: newProject.repository_url,
      userId: newProject.user_id,
      createdAt: newProject.created_at,
      updatedAt: newProject.updated_at,
      isActive: newProject.is_active,
      repository: newProject.repository_url || '',
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

    console.log('Project creation completed successfully:', projectWithStats.name);

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