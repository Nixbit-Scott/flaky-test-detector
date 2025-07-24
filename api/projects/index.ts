import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ProjectService } from '../../backend/src/services/project.service';
import { UserService } from '../../backend/src/services/user.service';
import { corsHandler } from '../../backend/src/utils/cors';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  repository: z.string().min(1, 'Repository is required').max(200, 'Repository URL too long'),
  branch: z.string().max(100, 'Branch name too long').optional(),
  teamId: z.string().optional(),
  githubInstallationId: z.string().optional(),
  gitlabProjectId: z.string().optional(),
  jenkinsJobUrl: z.string().url('Invalid Jenkins URL').optional(),
  retryEnabled: z.boolean().optional(),
  maxRetries: z.number().min(1).max(10).optional(),
  retryDelay: z.number().min(1).max(300).optional(),
  flakyThreshold: z.number().min(0).max(1).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  corsHandler(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract and verify token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = UserService.verifyToken(token);

    if (req.method === 'GET') {
      // Get all projects for authenticated user
      const projects = await ProjectService.getProjectsByUser(decoded.userId);
      return res.json({ projects });
    }

    if (req.method === 'POST') {
      // Create new project
      const validatedData = createProjectSchema.parse(req.body);
      
      const project = await ProjectService.createProject({
        ...validatedData,
        userId: decoded.userId,
      });
      
      return res.status(201).json({
        message: 'Project created successfully',
        project,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    if (error instanceof Error) {
      return res.status(400).json({
        error: error.message,
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}