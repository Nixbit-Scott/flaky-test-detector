import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { SSOService } from '../services/sso.service';
import { UserService } from '../services/user.service';
import { getStrategyName } from '../config/passport';

// Extended Request interface for SSO
declare global {
  namespace Express {
    interface Request {
      ssoContext?: {
        organizationId: string;
        providerId: string;
        redirectUrl?: string;
      };
    }
    
    interface Session {
      ssoRedirectUrl?: string;
    }
  }
}

export interface SSOAuthOptions {
  requireSSO?: boolean;
  allowFallback?: boolean;
  organizationRequired?: boolean;
}

export const ssoAuthMiddleware = (options: SSOAuthOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if user is already authenticated via JWT
      const authHeader = req.headers.authorization;
      let jwtUser = null;

      if (authHeader) {
        try {
          const token = authHeader.split(' ')[1];
          if (token) {
            jwtUser = UserService.verifyToken(token);
          }
        } catch (error) {
          // Invalid JWT, continue with SSO flow
        }
      }

      // If user is authenticated via JWT and SSO is not required, continue
      if (jwtUser && !options.requireSSO) {
        req.user = jwtUser;
        return next();
      }

      // Check for SSO requirement
      if (options.requireSSO || req.query.sso === 'true') {
        const email = req.body?.email || req.query?.email as string;
        const organizationId = req.body?.organizationId || req.query?.organizationId as string;

        if (!email && !organizationId) {
          res.status(400).json({
            error: 'Email or organization ID required for SSO authentication',
          });
          return;
        }

        let ssoProvider = null;

        if (organizationId) {
          // Get SSO provider by organization
          const providers = await SSOService.getSSOProviderByOrganization(organizationId);
          ssoProvider = providers[0]; // Use first active provider
        } else if (email) {
          // Get SSO provider by domain
          ssoProvider = await SSOService.getSSOProviderByDomain(email);
        }

        if (!ssoProvider) {
          if (options.allowFallback) {
            // Allow fallback to regular authentication
            return next();
          } else {
            res.status(400).json({
              error: 'No SSO provider configured for this email domain or organization',
            });
            return;
          }
        }

        // Set SSO context for subsequent middleware
        req.ssoContext = {
          organizationId: ssoProvider.organizationId,
          providerId: ssoProvider.id,
          redirectUrl: req.body?.redirectUrl || req.query?.redirectUrl as string,
        };

        return next();
      }

      // Regular authentication flow
      if (options.organizationRequired && !jwtUser) {
        res.status(401).json({
          error: 'Authentication required',
        });
        return;
      }

      if (jwtUser) {
        req.user = jwtUser;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Authentication error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

export const ssoLoginHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.ssoContext) {
      res.status(400).json({ error: 'SSO context not found' });
      return;
    }

    const { organizationId, providerId } = req.ssoContext;
    const provider = await SSOService.getSSOProvider(providerId);

    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    const strategyName = getStrategyName(organizationId, providerId, provider.type);

    // Store redirect URL in session
    if (req.session && req.ssoContext.redirectUrl) {
      req.session.ssoRedirectUrl = req.ssoContext.redirectUrl;
    }

    // Authenticate using the specific SSO strategy
    passport.authenticate(strategyName, {
      successRedirect: '/api/auth/sso/callback/success',
      failureRedirect: '/api/auth/sso/callback/failure',
    })(req, res, next);
  } catch (error) {
    res.status(500).json({
      error: 'SSO login error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const ssoCallbackHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.ssoContext) {
      res.status(400).json({ error: 'SSO context not found' });
      return;
    }

    const { organizationId, providerId } = req.ssoContext;
    const provider = await SSOService.getSSOProvider(providerId);

    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    const strategyName = getStrategyName(organizationId, providerId, provider.type);

    passport.authenticate(strategyName, (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({
          error: 'SSO authentication failed',
          details: err.message,
        });
      }

      if (!user) {
        return res.status(401).json({
          error: 'SSO authentication failed',
          details: info?.message || 'User not found',
        });
      }

      // Generate JWT token for the authenticated user
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ error: 'JWT_SECRET not configured' });
      }

      const jwt = require('jsonwebtoken');
      const payload = {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        sso: true,
      };

      const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

      // Get redirect URL from session
      const redirectUrl = req.session?.ssoRedirectUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
      
      // Clear session redirect URL
      if (req.session) {
        delete req.session.ssoRedirectUrl;
      }

      // Redirect with token or return JSON response
      if (req.query.format === 'json') {
        res.json({
          message: 'SSO authentication successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
            isNewUser: user.isNewUser,
            organizationRole: user.organizationRole,
          },
          token,
        });
      } else {
        // Redirect to frontend with token
        const redirectWithToken = `${redirectUrl}?token=${token}&sso=success`;
        res.redirect(redirectWithToken);
      }
    })(req, res, next);
  } catch (error) {
    res.status(500).json({
      error: 'SSO callback error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const requireSSOAuth = ssoAuthMiddleware({ requireSSO: true });
export const optionalSSOAuth = ssoAuthMiddleware({ allowFallback: true });
export const organizationSSOAuth = ssoAuthMiddleware({ organizationRequired: true, allowFallback: true });