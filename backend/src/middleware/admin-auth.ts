import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { logger } from '../utils/logger';

// Extend Request interface to include admin user
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        userId: string;
        email: string;
        isSystemAdmin: boolean;
      };
    }
  }
}

export const adminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'Token required' });
      return;
    }

    // Verify token
    const decoded = UserService.verifyToken(token);
    
    // Get full user details to check admin status
    const user = await UserService.getUserById(decoded.userId);
    
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check if user is system admin
    const fullUser = await UserService.getUserWithAdminStatus(decoded.userId);
    
    if (!fullUser?.isSystemAdmin) {
      logger.warn('Non-admin user attempted to access admin endpoint', {
        userId: decoded.userId,
        email: decoded.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      
      res.status(403).json({ 
        error: 'Insufficient permissions. System admin access required.',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
      return;
    }

    // Add admin user info to request
    req.adminUser = {
      userId: decoded.userId,
      email: decoded.email,
      isSystemAdmin: true
    };

    // Update last login time
    await UserService.updateLastLogin(decoded.userId);
    
    // Log admin access
    logger.info('Admin user authenticated', {
      userId: decoded.userId,
      email: decoded.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
    
    next();
  } catch (error) {
    logger.error('Admin authentication failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
    
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to create admin audit log entries
export const adminAuditMiddleware = (action: string, resourceType: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original send method
    const originalSend = res.send;
    
    // Override send method to capture response
    res.send = function(body: any) {
      // Log the admin action
      if (req.adminUser && res.statusCode < 400) {
        setImmediate(async () => {
          try {
            await UserService.createAdminAuditLog({
              userId: req.adminUser!.userId,
              action,
              resourceType,
              resourceId: req.params.id || req.body.id,
              details: {
                method: req.method,
                url: req.originalUrl,
                body: req.method !== 'GET' ? req.body : undefined,
                query: req.query,
                statusCode: res.statusCode
              },
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              category: 'admin_action',
              severity: res.statusCode >= 400 ? 'error' : 'info'
            });
          } catch (error) {
            logger.error('Failed to create audit log', { error });
          }
        });
      }
      
      // Call original send method
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// Rate limiting specifically for admin endpoints
export const adminRateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Admin users get higher rate limits
  // This is a placeholder - in production you'd use redis-based rate limiting
  
  const adminRateLimit = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Much higher limit for admin users
    message: {
      error: 'Too many admin requests, please try again later',
      code: 'ADMIN_RATE_LIMIT_EXCEEDED'
    }
  };
  
  // For now, just pass through - implement actual rate limiting with redis
  next();
};

// Middleware to check for specific admin permissions
export const requireAdminRole = (requiredPermissions: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.adminUser) {
      res.status(401).json({ error: 'Admin authentication required' });
      return;
    }

    // For now, all system admins have all permissions
    // In the future, you could implement granular permissions
    if (req.adminUser.isSystemAdmin) {
      next();
      return;
    }

    res.status(403).json({ 
      error: 'Insufficient admin permissions',
      code: 'INSUFFICIENT_ADMIN_PERMISSIONS',
      required: requiredPermissions
    });
  };
};

export default adminAuthMiddleware;