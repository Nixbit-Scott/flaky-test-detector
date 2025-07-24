import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/api-key.service';

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        user: any;
      };
    }
  }
}

/**
 * Middleware for API key authentication
 * Used for webhook endpoints and public API access
 */
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.api_key as string;

    if (!apiKey) {
      res.status(401).json({ 
        error: 'API key required',
        message: 'Please provide an API key via X-API-Key header, Authorization header, or api_key query parameter'
      });
      return;
    }

    // Validate API key
    const result = await ApiKeyService.validateApiKey(apiKey);

    if (!result) {
      res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is invalid, expired, or has been revoked'
      });
      return;
    }

    // Attach user and API key info to request
    req.user = result.user;
    req.apiKey = {
      id: result.keyId,
      user: result.user,
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred while validating the API key'
    });
  }
};

/**
 * Optional API key authentication - allows both JWT and API key
 */
export const optionalApiKeyAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // If user is already authenticated via JWT, skip API key check
  if (req.user) {
    return next();
  }

  // Try API key authentication
  try {
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.api_key as string;

    if (apiKey) {
      const result = await ApiKeyService.validateApiKey(apiKey);
      
      if (result) {
        req.user = result.user;
        req.apiKey = {
          id: result.keyId,
          user: result.user,
        };
      }
    }
  } catch (error) {
    console.error('Optional API key authentication error:', error);
    // Don't fail the request, just continue without API key auth
  }

  next();
};