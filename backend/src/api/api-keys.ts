import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiKeyService } from '../services/api-key.service';

const router = Router();

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100, 'Name too long'),
  expiresAt: z.string().datetime().optional(),
  permissions: z.array(z.string()).optional(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100, 'Name too long').optional(),
});

// POST /api/api-keys - Create a new API key
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = createApiKeySchema.parse(req.body);
    
    const result = await ApiKeyService.createApiKey((req.user as any).id, {
      name: validatedData.name,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
      permissions: validatedData.permissions,
    });

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: result.apiKey,
      key: result.plainKey, // Only returned once!
      warning: 'Store this key securely - it will not be shown again',
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

// GET /api/api-keys - Get all API keys for user
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const apiKeys = await ApiKeyService.getUserApiKeys((req.user as any).id);

    res.json({
      apiKeys,
      total: apiKeys.length,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/api-keys/:keyId - Update API key
router.put('/:keyId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { keyId } = req.params;
    const validatedData = updateApiKeySchema.parse(req.body);

    const updatedKey = await ApiKeyService.updateApiKey((req.user as any).id, keyId, validatedData);

    res.json({
      message: 'API key updated successfully',
      apiKey: updatedKey,
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

// DELETE /api/api-keys/:keyId - Revoke API key
router.delete('/:keyId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { keyId } = req.params;

    await ApiKeyService.revokeApiKey((req.user as any).id, keyId);

    res.json({
      message: 'API key revoked successfully',
      keyId,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/api-keys/stats - Get API key usage statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const stats = await ApiKeyService.getApiKeyStats((req.user as any).id, days);

    res.json({
      stats,
      period: `${days} days`,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/api-keys/permissions - Get available permissions
router.get('/permissions', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const permissions = ApiKeyService.getAvailablePermissions();

    res.json({
      permissions,
      total: permissions.length,
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;