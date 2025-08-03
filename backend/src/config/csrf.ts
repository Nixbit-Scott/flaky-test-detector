import { Request, Response, NextFunction } from 'express';
import csrf from 'csrf';
import { logger } from '../utils/logger';

const tokens = new csrf();

/**
 * CSRF token generator and validator
 */
export class CSRFProtection {
  private static secret: string;
  
  static initialize(): void {
    // Generate a secret for CSRF tokens
    this.secret = tokens.secretSync();
    logger.info('🛡️ CSRF protection initialized');
  }
  
  /**
   * Generate a CSRF token for a session
   */
  static generateToken(req: Request): string {
    if (!this.secret) {
      this.initialize();
    }
    
    // Store the secret in the session
    if (req.session) {
      (req.session as any)._csrfSecret = this.secret;
    }
    
    return tokens.create(this.secret);
  }
  
  /**
   * Verify a CSRF token
   */
  static verifyToken(req: Request, token: string): boolean {
    if (!req.session || !(req.session as any)._csrfSecret) {
      return false;
    }
    
    const secret = (req.session as any)._csrfSecret;
    return tokens.verify(secret, token);
  }
  
  /**
   * Express middleware for CSRF protection
   */
  static middleware(options: {
    ignoreMethods?: string[];
    headerName?: string;
    bodyName?: string;
    queryName?: string;
    skipRoutes?: string[];
  } = {}) {
    const {
      ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
      headerName = 'x-csrf-token',
      bodyName = '_csrf',
      queryName = '_csrf',
      skipRoutes = []
    } = options;
    
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Skip CSRF protection for certain routes
        if (skipRoutes.some(route => req.path.startsWith(route))) {
          return next();
        }
        
        // Skip for safe methods
        if (ignoreMethods.includes(req.method)) {
          return next();
        }
        
        // Skip for API key authenticated requests
        if (req.headers['x-api-key']) {
          return next();
        }
        
        // Skip for webhook endpoints
        if (req.path.startsWith('/api/webhooks')) {
          return next();
        }
        
        // Extract token from various sources
        const token = req.headers[headerName] as string ||
                     req.body?.[bodyName] ||
                     req.query?.[queryName] as string;
        
        if (!token) {
          logger.warn(`CSRF token missing for ${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });
          
          return res.status(403).json({
            error: 'CSRF token required',
            code: 'CSRF_TOKEN_MISSING',
          });
        }
        
        if (!this.verifyToken(req, token)) {
          logger.warn(`Invalid CSRF token for ${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            token: token.substring(0, 10) + '...',
          });
          
          return res.status(403).json({
            error: 'Invalid CSRF token',
            code: 'CSRF_TOKEN_INVALID',
          });
        }
        
        next();
      } catch (error) {
        logger.error('CSRF middleware error:', error);
        res.status(500).json({
          error: 'CSRF validation error',
          code: 'CSRF_VALIDATION_ERROR',
        });
      }
    };
  }
  
  /**
   * Endpoint to get CSRF token
   */
  static tokenEndpoint(req: Request, res: Response): void {
    try {
      const token = this.generateToken(req);
      res.json({ 
        csrfToken: token,
        headerName: 'x-csrf-token',
      });
    } catch (error) {
      logger.error('Error generating CSRF token:', error);
      res.status(500).json({
        error: 'Failed to generate CSRF token',
        code: 'CSRF_TOKEN_GENERATION_ERROR',
      });
    }
  }
}

/**
 * Initialize CSRF protection
 */
export function initializeCSRF(): void {
  CSRFProtection.initialize();
}

/**
 * CSRF middleware with default settings for SSO
 */
export const csrfMiddleware = CSRFProtection.middleware({
  skipRoutes: [
    '/api/auth/sso',      // SSO endpoints
    '/api/webhooks',      // Webhook endpoints
    '/api/health',        // Health checks
    '/api/auth/csrf-token', // CSRF token endpoint
  ],
});

/**
 * Get CSRF token endpoint
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  CSRFProtection.tokenEndpoint(req, res);
};