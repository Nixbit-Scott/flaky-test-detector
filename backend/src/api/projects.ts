import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ProjectService } from '../services/project.service';

const router = Router();

// Validation schemas
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

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long').optional(),
  repository: z.string().min(1, 'Repository is required').max(200, 'Repository URL too long').optional(),
  branch: z.string().max(100, 'Branch name too long').optional(),
  githubInstallationId: z.string().optional(),
  gitlabProjectId: z.string().optional(),
  jenkinsJobUrl: z.string().url('Invalid Jenkins URL').optional(),
  retryEnabled: z.boolean().optional(),
  maxRetries: z.number().min(1).max(10).optional(),
  retryDelay: z.number().min(1).max(300).optional(),
  flakyThreshold: z.number().min(0).max(1).optional(),
});

const generateApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(50, 'API key name too long'),
});

// GET /api/projects - Get all projects for authenticated user
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const projects = await ProjectService.getProjectsByUser((req.user as any).userId);
    res.json({ projects });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - Create new project
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = createProjectSchema.parse(req.body);
    
    const project = await ProjectService.createProject({
      ...validatedData,
      userId: (req.user as any).userId,
    } as any);

    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id - Get specific project
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const project = await ProjectService.getProjectById(req.params.id, (req.user as any).userId);
    res.json({ project });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = updateProjectSchema.parse(req.body);
    
    const project = await ProjectService.updateProject(req.params.id, (req.user as any).userId, validatedData);

    res.json({
      message: 'Project updated successfully',
      project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const result = await ProjectService.deleteProject(req.params.id, (req.user as any).userId);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/api-keys - Generate API key for project
router.post('/:id/api-keys', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = generateApiKeySchema.parse(req.body);
    
    const apiKey = await ProjectService.generateApiKey(req.params.id, (req.user as any).userId, validatedData.name);

    res.status(201).json({
      message: 'API key generated successfully',
      apiKey,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/api-keys - Get API keys for project
router.get('/:id/api-keys', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const apiKeys = await ProjectService.getProjectApiKeys(req.params.id, (req.user as any).userId);
    res.json({ apiKeys });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;