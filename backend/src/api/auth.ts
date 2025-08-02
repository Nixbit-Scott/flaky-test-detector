import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { authMiddleware } from '../middleware/auth';
import { SSOService } from '../services/sso.service';
import { ssoAuthMiddleware, ssoLoginHandler, ssoCallbackHandler } from '../middleware/sso-auth';
// import { configureSAMLStrategy, configureOIDCStrategy } from '../config/passport';
import passport from 'passport';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const ssoLoginSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  organizationId: z.string().optional(),
  redirectUrl: z.string().url().optional(),
}).refine(data => data.email || data.organizationId, {
  message: 'Either email or organizationId is required',
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body) as any;
    
    const user = await UserService.createUser(validatedData);
    
    res.status(201).json({
      message: 'User created successfully',
      user,
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
      res.status(400).json({
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body) as any;
    
    const result = await UserService.authenticateUser(validatedData);
    
    res.json({
      message: 'Login successful',
      ...result,
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
      res.status(401).json({
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    const user = await UserService.getUserById((req.user as any).userId);
    
    res.json({ user });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // With JWT, logout is handled client-side by removing the token
  // For SSO, we could optionally redirect to the IdP logout endpoint
  res.json({ message: 'Logout successful' });
});

// SSO Routes

// POST /api/auth/sso/discover - Discover SSO provider for email/organization
router.post('/sso/discover', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, organizationId } = req.body;
    
    if (!email && !organizationId) {
      res.status(400).json({ error: 'Email or organization ID required' });
      return;
    }

    let ssoProvider = null;
    
    if (organizationId) {
      const providers = await SSOService.getSSOProviderByOrganization(organizationId);
      ssoProvider = providers[0] || null;
    } else if (email) {
      ssoProvider = await SSOService.getSSOProviderByDomain(email);
    }

    if (!ssoProvider) {
      res.json({ 
        hasSSOProvider: false,
        message: 'No SSO provider configured for this email domain or organization'
      });
      return;
    }

    res.json({
      hasSSOProvider: true,
      provider: {
        id: ssoProvider!.id,
        name: ssoProvider!.name,
        type: ssoProvider!.type,
        organizationId: ssoProvider!.organizationId,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to discover SSO provider',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/auth/sso/login - Initiate SSO login
router.post('/sso/login', ssoAuthMiddleware({ requireSSO: true }), ssoLoginHandler);

// GET /api/auth/sso/login/:organizationId/:providerId - Initiate SSO login with specific provider
router.get('/sso/login/:organizationId/:providerId', async (req: Request, res: Response, next): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    const redirectUrl = req.query.redirectUrl as string;

    // Set SSO context
    (req as any).ssoContext = {
      organizationId,
      providerId,
    };
    
    if (redirectUrl) {
      (req as any).session = (req as any).session || {};
      (req as any).session.ssoRedirectUrl = redirectUrl;
    }

    // Configure the strategy if not already configured
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    try {
      if (provider.type === 'saml') {
        // await configureSAMLStrategy(organizationId, providerId);
      } else if (provider.type === 'oidc') {
        // await configureOIDCStrategy(organizationId, providerId);
      }
    } catch (configError) {
      // Strategy might already be configured, continue
    }

    ssoLoginHandler(req, res, next);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to initiate SSO login',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/auth/sso/callback/:organizationId/:providerId - Handle SSO callback
router.post('/sso/callback/:organizationId/:providerId', async (req: Request, res: Response, next): Promise<void> => {
  const { organizationId, providerId } = req.params;
  
  (req as any).ssoContext = {
    organizationId,
    providerId,
  };
  
  ssoCallbackHandler(req, res, next);
});

// GET /api/auth/sso/callback/:organizationId/:providerId - Handle SSO callback (GET for SAML)
router.get('/sso/callback/:organizationId/:providerId', async (req: Request, res: Response, next): Promise<void> => {
  const { organizationId, providerId } = req.params;
  
  (req as any).ssoContext = {
    organizationId,
    providerId,
  };
  
  ssoCallbackHandler(req, res, next);
});

// GET /api/auth/sso/callback/success - SSO success page
router.get('/sso/callback/success', (_req: Request, res: Response) => {
  res.json({ message: 'SSO authentication successful' });
});

// GET /api/auth/sso/callback/failure - SSO failure page
router.get('/sso/callback/failure', (_req: Request, res: Response) => {
  res.status(401).json({ error: 'SSO authentication failed' });
});

// GET /api/auth/sso/metadata/:organizationId/:providerId - SAML metadata endpoint
router.get('/sso/metadata/:organizationId/:providerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    const provider = await SSOService.getSSOProvider(providerId);
    
    if (!provider || provider.type !== 'saml') {
      res.status(404).json({ error: 'SAML provider not found' });
      return;
    }

    // Configure SAML strategy to get metadata
    // await configureSAMLStrategy(organizationId, providerId);
    
    // Get the strategy and generate metadata
    const strategyName = `saml-${organizationId}-${providerId}`;
    const strategy = (passport as any)._strategy(strategyName) as any;
    
    if (strategy && strategy.generateServiceProviderMetadata) {
      const samlConfig = provider.config as any;
      const metadata = strategy.generateServiceProviderMetadata(
        samlConfig.cert,
        samlConfig.cert
      );
      
      res.set('Content-Type', 'application/xml');
      res.send(metadata);
    } else {
      res.status(500).json({ error: 'Unable to generate SAML metadata' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate SAML metadata',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;