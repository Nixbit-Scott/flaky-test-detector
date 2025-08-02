import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { SSOService, SAMLConfig, OIDCConfig } from '../services/sso.service';
// import { configureSAMLStrategy, configureOIDCStrategy, removeSSOStrategy } from '../config/passport';
import { OrganizationService } from '../services/organization.service';

const router = Router();

// Validation schemas
const samlConfigSchema = z.object({
  entryPoint: z.string().url('Invalid SAML entry point URL'),
  issuer: z.string().min(1, 'SAML issuer is required'),
  callbackUrl: z.string().url('Invalid callback URL'),
  cert: z.string().min(1, 'SAML certificate is required'),
  identifierFormat: z.string().optional(),
  signatureAlgorithm: z.enum(['sha1', 'sha256']).optional(),
  forceAuthn: z.boolean().optional(),
  attributeMapping: z.object({
    email: z.string().min(1, 'Email attribute mapping is required'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    displayName: z.string().optional(),
    groups: z.string().optional(),
  }).optional(),
});

const oidcConfigSchema = z.object({
  issuer: z.string().url('Invalid OIDC issuer URL'),
  clientID: z.string().min(1, 'OIDC client ID is required'),
  clientSecret: z.string().min(1, 'OIDC client secret is required'),
  callbackURL: z.string().url('Invalid callback URL'),
  scope: z.array(z.string()).min(1, 'At least one scope is required'),
  responseType: z.string().optional(),
  responseMode: z.string().optional(),
  attributeMapping: z.object({
    email: z.string().min(1, 'Email attribute mapping is required'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    displayName: z.string().optional(),
    groups: z.string().optional(),
  }).optional(),
});

const createSSOProviderSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Provider name is required'),
  type: z.enum(['saml', 'oidc'], { required_error: 'Provider type is required' }),
  config: z.union([samlConfigSchema, oidcConfigSchema]),
  domainRestriction: z.array(z.string()).optional(),
  groupMappings: z.array(z.object({
    ssoGroup: z.string().min(1, 'SSO group name is required'),
    organizationRole: z.enum(['owner', 'admin', 'member']),
    teamMappings: z.array(z.object({
      teamId: z.string().uuid('Invalid team ID'),
      role: z.enum(['admin', 'member']),
    })).optional(),
  })).optional(),
});

const updateSSOProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required').optional(),
  config: z.union([samlConfigSchema, oidcConfigSchema]).optional(),
  domainRestriction: z.array(z.string()).optional(),
  groupMappings: z.array(z.object({
    ssoGroup: z.string().min(1, 'SSO group name is required'),
    organizationRole: z.enum(['owner', 'admin', 'member']),
    teamMappings: z.array(z.object({
      teamId: z.string().uuid('Invalid team ID'),
      role: z.enum(['admin', 'member']),
    })).optional(),
  })).optional(),
  isActive: z.boolean().optional(),
});

// Middleware to check organization admin access
const requireOrganizationAdmin = async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const organizationId = req.params.organizationId || req.body.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    // Check if user is admin or owner of the organization
    const isAdmin = await OrganizationService.isUserOrganizationAdmin((req.user as any).userId, organizationId);
    if (!isAdmin) {
      res.status(403).json({ error: 'Organization admin access required' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Failed to verify organization access',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// POST /api/sso/providers - Create SSO provider
router.post('/providers', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createSSOProviderSchema.parse(req.body);
    
    // Validate SSO configuration
    const validation = await SSOService.validateSSOConfig(validatedData.type, validatedData.config);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'Invalid SSO configuration',
        details: validation.errors,
      });
      return;
    }

    const provider = await SSOService.createSSOProvider(validatedData);

    // Configure the passport strategy
    try {
      if (provider.type === 'saml') {
        // await configureSAMLStrategy(provider.organizationId, provider.id);
      } else if (provider.type === 'oidc') {
        // await configureOIDCStrategy(provider.organizationId, provider.id);
      }
    } catch (strategyError) {
      // If strategy configuration fails, clean up the provider
      await SSOService.deleteSSOProvider(provider.id);
      throw strategyError;
    }

    res.status(201).json({
      message: 'SSO provider created successfully',
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        organizationId: provider.organizationId,
        isActive: provider.isActive,
        domainRestriction: provider.domainRestriction,
        createdAt: provider.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    
    res.status(500).json({
      error: 'Failed to create SSO provider',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/providers/:organizationId - Get SSO providers for organization
router.get('/providers/:organizationId', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const providers = await SSOService.getSSOProviderByOrganization(organizationId);

    const sanitizedProviders = providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      organizationId: provider.organizationId,
      isActive: provider.isActive,
      domainRestriction: provider.domainRestriction,
      groupMappings: provider.groupMappings,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      // Don't return sensitive config data
      configSummary: provider.type === 'saml' ? {
        entryPoint: (provider.config as SAMLConfig).entryPoint,
        issuer: (provider.config as SAMLConfig).issuer,
        callbackUrl: (provider.config as SAMLConfig).callbackUrl,
      } : {
        issuer: (provider.config as OIDCConfig).issuer,
        clientID: (provider.config as OIDCConfig).clientID,
        callbackURL: (provider.config as OIDCConfig).callbackURL,
        scope: (provider.config as OIDCConfig).scope,
      },
    }));

    res.json({ providers: sanitizedProviders });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch SSO providers',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/providers/:organizationId/:providerId - Get specific SSO provider
router.get('/providers/:organizationId/:providerId', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const provider = await SSOService.getSSOProvider(providerId);

    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    const sanitizedProvider = {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      organizationId: provider.organizationId,
      isActive: provider.isActive,
      domainRestriction: provider.domainRestriction,
      groupMappings: provider.groupMappings,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      config: provider.config, // Return full config for editing
    };

    res.json({ provider: sanitizedProvider });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch SSO provider',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/sso/providers/:organizationId/:providerId - Update SSO provider
router.put('/providers/:organizationId/:providerId', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const validatedData = updateSSOProviderSchema.parse(req.body);

    const existingProvider = await SSOService.getSSOProvider(providerId);
    if (!existingProvider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    // Validate configuration if provided
    if (validatedData.config) {
      const validation = await SSOService.validateSSOConfig(existingProvider.type, validatedData.config);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Invalid SSO configuration',
          details: validation.errors,
        });
        return;
      }
    }

    const updatedProvider = await SSOService.updateSSOProvider(providerId, validatedData);

    // Reconfigure passport strategy if config changed
    if (validatedData.config) {
      try {
        // Remove old strategy
        // await removeSSOStrategy(updatedProvider.organizationId, providerId, updatedProvider.type);
        
        // Configure new strategy
        if (updatedProvider.type === 'saml') {
          await configureSAMLStrategy(updatedProvider.organizationId, providerId);
        } else if (updatedProvider.type === 'oidc') {
          await configureOIDCStrategy(updatedProvider.organizationId, providerId);
        }
      } catch (strategyError) {
        console.error('Failed to reconfigure SSO strategy:', strategyError);
        // Continue - the update was successful, just log the strategy error
      }
    }

    res.json({
      message: 'SSO provider updated successfully',
      provider: {
        id: updatedProvider.id,
        name: updatedProvider.name,
        type: updatedProvider.type,
        organizationId: updatedProvider.organizationId,
        isActive: updatedProvider.isActive,
        domainRestriction: updatedProvider.domainRestriction,
        updatedAt: updatedProvider.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    
    res.status(500).json({
      error: 'Failed to update SSO provider',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/sso/providers/:organizationId/:providerId - Delete SSO provider
router.delete('/providers/:organizationId/:providerId', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    // Remove passport strategy
    try {
      // await removeSSOStrategy(organizationId, providerId, provider.type);
    } catch (strategyError) {
      console.error('Failed to remove SSO strategy:', strategyError);
      // Continue with deletion
    }

    await SSOService.deleteSSOProvider(providerId);

    res.json({ message: 'SSO provider deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete SSO provider',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sso/providers/:organizationId/:providerId/test - Test SSO connection
router.post('/providers/:organizationId/:providerId/test', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const result = await SSOService.testSSOConnection(providerId);

    if (result.success) {
      res.json({ message: 'SSO connection test successful' });
    } else {
      res.status(400).json({ 
        error: 'SSO connection test failed',
        details: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to test SSO connection',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;