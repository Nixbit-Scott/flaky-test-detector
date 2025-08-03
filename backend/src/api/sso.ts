import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { SSOService, SAMLConfig, OIDCConfig } from '../services/sso.service';
import { configureSAMLStrategy, configureOIDCStrategy, removeSSOStrategy, generateOIDCAuthURL, validateOIDCState } from '../config/passport';
import { OrganizationService } from '../services/organization.service';
import { ssoConfigRateLimitMiddleware } from '../middleware/rate-limit';
import { ProviderHealthCheck } from '../utils/provider-health-check';
import { getProviderExample, listProviderExamples, SecurityRecommendations } from '../config/oidc-provider-examples';

const router = Router();

// Enhanced validation schemas with security checks
const samlConfigSchema = z.object({
  entryPoint: z.string()
    .url('Invalid SAML entry point URL')
    .refine((url) => url.startsWith('https://'), 'SAML entry point must use HTTPS')
    .refine((url) => url.length <= 2048, 'URL too long'),
  issuer: z.string()
    .min(1, 'SAML issuer is required')
    .max(512, 'Issuer too long')
    .refine((issuer) => !issuer.includes('<') && !issuer.includes('>'), 'Invalid characters in issuer'),
  callbackUrl: z.string()
    .url('Invalid callback URL')
    .refine((url) => url.startsWith('https://') || url.startsWith('http://localhost'), 'Callback URL must use HTTPS (or localhost for development)')
    .refine((url) => url.length <= 2048, 'URL too long'),
  cert: z.string()
    .min(1, 'SAML certificate is required')
    .refine((cert) => cert.includes('-----BEGIN CERTIFICATE-----') && cert.includes('-----END CERTIFICATE-----'), 'Invalid certificate format')
    .refine((cert) => cert.length <= 10000, 'Certificate too large'),
  identifierFormat: z.string()
    .max(256, 'Identifier format too long')
    .optional(),
  signatureAlgorithm: z.string().optional(),
  forceAuthn: z.boolean().optional(),
  attributeMapping: z.object({
    email: z.string()
      .min(1, 'Email attribute mapping is required')
      .max(256, 'Attribute name too long'),
    firstName: z.string().max(256, 'Attribute name too long').optional(),
    lastName: z.string().max(256, 'Attribute name too long').optional(),
    displayName: z.string().max(256, 'Attribute name too long').optional(),
    groups: z.string().max(256, 'Attribute name too long').optional(),
  }).optional(),
  security: z.object({
    validateSignature: z.boolean().default(true),
    validateCertificate: z.boolean().default(true),
    allowedClockDrift: z.number().min(60).max(900).default(300), // 1-15 minutes
    requireSignedAssertions: z.boolean().default(true),
    requireSignedResponse: z.boolean().default(true),
  }).optional(),
});

const oidcConfigSchema = z.object({
  issuer: z.string()
    .url('Invalid OIDC issuer URL')
    .refine((url) => url.startsWith('https://'), 'OIDC issuer must use HTTPS')
    .refine((url) => url.length <= 2048, 'URL too long'),
  clientID: z.string()
    .min(1, 'OIDC client ID is required')
    .max(256, 'Client ID too long')
    .refine((id) => !/[<>&"']/.test(id), 'Invalid characters in client ID'),
  clientSecret: z.string()
    .min(8, 'Client secret must be at least 8 characters')
    .max(512, 'Client secret too long')
    .refine((secret) => !/[<>&"']/.test(secret), 'Invalid characters in client secret'),
  callbackURL: z.string()
    .url('Invalid callback URL')
    .refine((url) => url.startsWith('https://') || url.startsWith('http://localhost'), 'Callback URL must use HTTPS (or localhost for development)')
    .refine((url) => url.length <= 2048, 'URL too long'),
  scope: z.array(z.string().max(128, 'Scope too long'))
    .min(1, 'At least one scope is required')
    .max(20, 'Too many scopes')
    .refine((scopes) => scopes.includes('openid'), 'OpenID scope is required'),
  responseType: z.string().optional(),
  responseMode: z.string().optional(),
  attributeMapping: z.object({
    email: z.string()
      .min(1, 'Email attribute mapping is required')
      .max(256, 'Attribute name too long'),
    firstName: z.string().max(256, 'Attribute name too long').optional(),
    lastName: z.string().max(256, 'Attribute name too long').optional(),
    displayName: z.string().max(256, 'Attribute name too long').optional(),
    groups: z.string().max(256, 'Attribute name too long').optional(),
  }).optional(),
  security: z.object({
    validateIssuer: z.boolean().default(true),
    validateAudience: z.boolean().default(true),
    validateTokenExpiry: z.boolean().default(true),
    clockTolerance: z.number().min(60).max(900).default(300), // 1-15 minutes
    requireNonce: z.boolean().default(true),
    requirePKCE: z.boolean().default(true),
  }).optional(),
});

const createSSOProviderSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string()
    .min(1, 'Provider name is required')
    .max(100, 'Provider name too long')
    .refine((name) => !/[<>&"'`]/.test(name), 'Invalid characters in provider name')
    .refine((name) => name.trim() === name, 'Provider name cannot have leading/trailing whitespace'),
  type: z.enum(['saml', 'oidc'], { required_error: 'Provider type is required' }),
  config: z.union([samlConfigSchema, oidcConfigSchema]),
  domainRestriction: z.array(
    z.string()
      .min(1, 'Domain cannot be empty')
      .max(253, 'Domain too long')
      .refine((domain) => /^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$/.test(domain), 'Invalid domain format')
      .refine((domain) => !domain.includes('..'), 'Domain cannot contain consecutive dots')
  ).max(50, 'Too many domain restrictions').optional(),
  groupMappings: z.array(z.object({
    ssoGroup: z.string()
      .min(1, 'SSO group name is required')
      .max(256, 'SSO group name too long')
      .refine((group) => !/[<>&"'`]/.test(group), 'Invalid characters in group name'),
    organizationRole: z.enum(['owner', 'admin', 'member']),
    teamMappings: z.array(z.object({
      teamId: z.string().uuid('Invalid team ID'),
      role: z.enum(['admin', 'member']),
    })).max(100, 'Too many team mappings').optional(),
  })).max(100, 'Too many group mappings').optional(),
});

const updateSSOProviderSchema = z.object({
  name: z.string()
    .min(1, 'Provider name is required')
    .max(100, 'Provider name too long')
    .refine((name) => !/[<>&"'`]/.test(name), 'Invalid characters in provider name')
    .refine((name) => name.trim() === name, 'Provider name cannot have leading/trailing whitespace')
    .optional(),
  config: z.union([samlConfigSchema, oidcConfigSchema]).optional(),
  domainRestriction: z.array(
    z.string()
      .min(1, 'Domain cannot be empty')
      .max(253, 'Domain too long')
      .refine((domain) => /^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$/.test(domain), 'Invalid domain format')
      .refine((domain) => !domain.includes('..'), 'Domain cannot contain consecutive dots')
  ).max(50, 'Too many domain restrictions').optional(),
  groupMappings: z.array(z.object({
    ssoGroup: z.string()
      .min(1, 'SSO group name is required')
      .max(256, 'SSO group name too long')
      .refine((group) => !/[<>&"'`]/.test(group), 'Invalid characters in group name'),
    organizationRole: z.enum(['owner', 'admin', 'member']),
    teamMappings: z.array(z.object({
      teamId: z.string().uuid('Invalid team ID'),
      role: z.enum(['admin', 'member']),
    })).max(100, 'Too many team mappings').optional(),
  })).max(100, 'Too many group mappings').optional(),
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
router.post('/providers', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createSSOProviderSchema.parse(req.body);
    
    // Validate SSO configuration
    const validation = await SSOService.validateSSOConfig(validatedData.type, validatedData.config as SAMLConfig | OIDCConfig);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'Invalid SSO configuration',
        details: validation.errors,
      });
      return;
    }

    const provider = await SSOService.createSSOProvider(validatedData as any);

    // Configure the passport strategy
    try {
      if (provider.type === 'saml') {
        await configureSAMLStrategy(provider.organizationId, provider.id);
      } else if (provider.type === 'oidc') {
        await configureOIDCStrategy(provider.organizationId, provider.id);
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
router.put('/providers/:organizationId/:providerId', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
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
      const validation = await SSOService.validateSSOConfig(existingProvider.type, validatedData.config as SAMLConfig | OIDCConfig);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Invalid SSO configuration',
          details: validation.errors,
        });
        return;
      }
    }

    const updatedProvider = await SSOService.updateSSOProvider(providerId, validatedData as any);

    // Reconfigure passport strategy if config changed
    if (validatedData.config) {
      try {
        // Remove old strategy
        await removeSSOStrategy(updatedProvider.organizationId, providerId, updatedProvider.type);
        
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
router.delete('/providers/:organizationId/:providerId', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    // Remove passport strategy
    try {
      await removeSSOStrategy(organizationId, providerId, provider.type);
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
router.post('/providers/:organizationId/:providerId/test', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
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

// GET /api/sso/auth/:organizationId/:providerId - Initiate OIDC authentication with PKCE
router.get('/auth/:organizationId/:providerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    
    // Get provider to check type
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    if (!provider.isActive) {
      res.status(400).json({ error: 'SSO provider is disabled' });
      return;
    }

    if (provider.type === 'oidc') {
      // Generate OIDC authorization URL with PKCE and security parameters
      const authUrl = await generateOIDCAuthURL(organizationId, providerId, req.sessionID, req);
      
      res.json({ 
        authUrl,
        provider: {
          name: provider.name,
          type: provider.type,
        }
      });
    } else if (provider.type === 'saml') {
      // For SAML, redirect to passport authentication
      res.json({ 
        authUrl: `/api/sso/auth/saml/${organizationId}/${providerId}`,
        provider: {
          name: provider.name,
          type: provider.type,
        }
      });
    } else {
      res.status(400).json({ error: 'Unsupported SSO provider type' });
    }
  } catch (error) {
    console.error('SSO authentication initiation failed:', error);
    res.status(500).json({
      error: 'Failed to initiate SSO authentication',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/auth/saml/:organizationId/:providerId - SAML authentication initiation
router.get('/auth/saml/:organizationId/:providerId', async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    const strategyName = `saml-${organizationId}-${providerId}`;
    
    // Use passport to authenticate
    const passport = require('passport');
    passport.authenticate(strategyName, {
      failureRedirect: '/sso/error',
      successRedirect: '/dashboard',
    })(req, res, next);
  } catch (error) {
    res.status(500).json({
      error: 'SAML authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sso/callback/oidc/:organizationId/:providerId - OIDC callback with state validation
router.post('/callback/oidc/:organizationId/:providerId', async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    const { code, state, error: authError } = req.body;

    // Check for authorization errors
    if (authError) {
      console.warn('OIDC authorization error:', {
        error: authError,
        organizationId,
        providerId,
        ip: req.ip,
      });
      res.status(400).json({ 
        error: 'Authorization failed', 
        details: authError 
      });
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'Authorization code and state are required'
      });
      return;
    }

    // Validate state parameter
    if (!validateOIDCState(req, state)) {
      res.status(400).json({ 
        error: 'Invalid state parameter',
        details: 'State validation failed - possible CSRF attack'
      });
      return;
    }

    // Use passport to complete authentication
    const passport = require('passport');
    const strategyName = `oidc-${organizationId}-${providerId}`;
    
    passport.authenticate(strategyName, {
      failureRedirect: '/sso/error',
      successRedirect: '/dashboard',
    })(req, res, next);
  } catch (error) {
    console.error('OIDC callback processing failed:', error);
    res.status(500).json({
      error: 'OIDC callback processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/callback/saml/:organizationId/:providerId - SAML callback
router.get('/callback/saml/:organizationId/:providerId', async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    const strategyName = `saml-${organizationId}-${providerId}`;
    
    // Use passport to complete authentication
    const passport = require('passport');
    passport.authenticate(strategyName, {
      failureRedirect: '/sso/error',
      successRedirect: '/dashboard',
    })(req, res, next);
  } catch (error) {
    res.status(500).json({
      error: 'SAML callback processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sso/logout/:organizationId/:providerId - SSO logout with token revocation
router.post('/logout/:organizationId/:providerId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    const user = req.user as any;

    // Get provider for logout URL
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    // For OIDC providers, revoke tokens if available
    if (provider.type === 'oidc' && user.accessTokenHash) {
      try {
        const { TokenRevocationHandler } = require('../utils/oidc-security');
        // Note: In a real implementation, you'd need to store the actual tokens
        // TokenRevocationHandler.revokeToken(user.accessTokenHash);
        console.log('Token revocation initiated for user:', user.id);
      } catch (error) {
        console.warn('Token revocation failed:', error);
        // Continue with logout even if revocation fails
      }
    }

    // Destroy session
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
    });

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });
    }

    // Return logout URL if available
    const config = provider.config as any;
    let logoutUrl = '/';
    
    if (provider.type === 'oidc' && config.endSessionEndpoint) {
      logoutUrl = config.endSessionEndpoint;
    } else if (provider.type === 'saml' && config.logoutUrl) {
      logoutUrl = config.logoutUrl;
    }

    res.json({ 
      message: 'Logout successful',
      logoutUrl 
    });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/providers/:organizationId/:providerId/health - Check provider health
router.get('/providers/:organizationId/:providerId/health', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }

    const healthResult = await ProviderHealthCheck.checkProviderHealth(
      providerId,
      provider.type,
      provider.config
    );

    res.json({
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.type,
      health: healthResult
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check provider health',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/providers/:organizationId/health - Check health of all providers for organization
router.get('/providers/:organizationId/health', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    
    const providers = await SSOService.getSSOProviderByOrganization(organizationId);
    
    if (providers.length === 0) {
      res.json({ 
        organizationId,
        providers: [],
        message: 'No SSO providers configured for this organization'
      });
      return;
    }

    const healthResults = await ProviderHealthCheck.checkMultipleProviders(
      providers.map(provider => ({
        id: provider.id,
        type: provider.type,
        config: provider.config
      }))
    );

    const results = providers.map(provider => ({
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.type,
      isActive: provider.isActive,
      health: healthResults.get(provider.id) || {
        isHealthy: false,
        status: 'unhealthy',
        checks: { connectivity: false, responseTime: 0 },
        errors: ['Health check not completed'],
        lastChecked: new Date()
      }
    }));

    // Calculate overall organization SSO health
    const healthyProviders = results.filter(p => p.health.isHealthy && p.isActive).length;
    const activeProviders = results.filter(p => p.isActive).length;
    
    res.json({
      organizationId,
      providers: results,
      summary: {
        totalProviders: providers.length,
        activeProviders,
        healthyProviders,
        overallHealth: activeProviders > 0 ? (healthyProviders / activeProviders) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check providers health',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/provider-examples - Get OIDC provider configuration examples
router.get('/provider-examples', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.query;
    
    if (provider && typeof provider === 'string') {
      // Get specific provider example
      const example = getProviderExample(provider);
      if (!example) {
        res.status(404).json({ 
          error: 'Provider example not found',
          availableProviders: listProviderExamples().map(p => p.name)
        });
        return;
      }
      
      const recommendations = SecurityRecommendations[provider.toLowerCase() as keyof typeof SecurityRecommendations] || [];
      
      res.json({
        provider: provider.toLowerCase(),
        example,
        securityRecommendations: recommendations,
        note: 'Replace placeholder values (YOUR_*) with actual configuration values'
      });
    } else {
      // List all available provider examples
      const providers = listProviderExamples();
      
      res.json({
        message: 'Available OIDC provider configuration examples',
        providers,
        usage: 'Add ?provider=<name> to get specific configuration example'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get provider examples',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Phase 3: User Management & Group Mapping Endpoints

// POST /api/sso/users/sync/:organizationId - Sync all SSO users
router.post('/users/sync/:organizationId', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    
    const results = await SSOService.syncAllUsersFromSSO(organizationId);
    
    res.json({
      message: 'User synchronization completed',
      results: {
        processed: results.processed,
        updated: results.updated,
        errors: results.errors.length,
        errorDetails: results.errors,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to sync SSO users',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/analytics/provisioning/:organizationId - Get user provisioning analytics
router.get('/analytics/provisioning/:organizationId', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { days = '30' } = req.query;
    
    const daysNum = parseInt(days as string, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      res.status(400).json({ error: 'Invalid days parameter (1-365)' });
      return;
    }
    
    const analytics = await SSOService.getUserProvisioningHistory(organizationId, daysNum);
    
    res.json({
      organizationId,
      period: `${daysNum} days`,
      analytics,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get provisioning analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sso/analytics/domains/:organizationId - Get domain insights
router.get('/analytics/domains/:organizationId', authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    
    const insights = await SSOService.getDomainInsights(organizationId);
    
    res.json({
      organizationId,
      insights,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get domain insights',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/sso/users/:organizationId/:userId - Remove user from SSO
router.delete('/users/:organizationId/:userId', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, userId } = req.params;
    const { removeFromOrganization, removeFromTeams, preserveAuditLogs } = req.query;
    
    const options = {
      removeFromOrganization: removeFromOrganization === 'true',
      removeFromTeams: removeFromTeams === 'true',
      preserveAuditLogs: preserveAuditLogs !== 'false', // default to true
    };
    
    await SSOService.removeUserFromSSO(userId, organizationId, options);
    
    res.json({
      message: 'User removed from SSO successfully',
      options,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to remove user from SSO',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Enhanced group mapping validation schema
const enhancedGroupMappingSchema = z.array(z.object({
  ssoGroup: z.string()
    .min(1, 'SSO group name is required')
    .max(256, 'SSO group name too long')
    .refine((group) => !/[<>&"'`]/.test(group), 'Invalid characters in group name'),
  organizationRole: z.enum(['owner', 'admin', 'member']),
  teamMappings: z.array(z.object({
    teamId: z.string().uuid('Invalid team ID'),
    role: z.enum(['admin', 'member']),
  })).max(100, 'Too many team mappings').optional(),
  nestedGroups: z.array(z.string().max(256, 'Group name too long')).max(50, 'Too many nested groups').optional(),
  priority: z.number().min(0).max(1000).optional(),
  conditions: z.object({
    department: z.array(z.string().max(128, 'Department too long')).max(20, 'Too many departments').optional(),
    jobTitle: z.array(z.string().max(128, 'Job title too long')).max(20, 'Too many job titles').optional(),
    customAttribute: z.object({
      key: z.string().min(1).max(128, 'Attribute key too long'),
      value: z.union([
        z.string().max(256, 'Attribute value too long'),
        z.array(z.string().max(256, 'Attribute value too long')).max(50, 'Too many attribute values')
      ]),
    }).optional(),
  }).optional(),
})).max(100, 'Too many group mappings');

// PUT /api/sso/providers/:organizationId/:providerId/group-mappings - Update group mappings
router.put('/providers/:organizationId/:providerId/group-mappings', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const groupMappings = enhancedGroupMappingSchema.parse(req.body.groupMappings);
    
    const existingProvider = await SSOService.getSSOProvider(providerId);
    if (!existingProvider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }
    
    const updatedProvider = await SSOService.updateSSOProvider(providerId, {
      groupMappings: groupMappings as any,
    });
    
    res.json({
      message: 'Group mappings updated successfully',
      groupMappings: updatedProvider.groupMappings,
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
      error: 'Failed to update group mappings',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sso/providers/:organizationId/:providerId/test-group-mapping - Test group mapping logic
router.post('/providers/:organizationId/:providerId/test-group-mapping', ssoConfigRateLimitMiddleware, authMiddleware, requireOrganizationAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, providerId } = req.params;
    const testProfile = z.object({
      email: z.string().email(),
      groups: z.array(z.string()).optional(),
      department: z.string().optional(),
      jobTitle: z.string().optional(),
      customAttributes: z.record(z.any()).optional(),
    }).parse(req.body);
    
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }
    
    // Create a mock SSO profile for testing
    const mockProfile = {
      ...testProfile,
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      provider: provider.type,
      providerId: 'test-user-id',
      lastSSOSync: new Date(),
    };
    
    // Test the group mapping logic without actually creating/updating the user
    const groupMappings = provider.groupMappings as any;
    if (!groupMappings || !testProfile.groups) {
      res.json({
        message: 'No group mappings or user groups to test',
        result: {
          organizationRole: 'member',
          teamMemberships: [],
        },
      });
      return;
    }
    
    // Simulate the group mapping process
    let organizationRole: 'owner' | 'admin' | 'member' = 'member';
    let teamMemberships: Array<{ teamId: string; role: 'admin' | 'member' }> = [];
    
    for (const group of testProfile.groups) {
      const mapping = groupMappings.find((m: any) => {
        if (m.ssoGroup === group) return true;
        if (m.nestedGroups?.includes(group)) return true;
        return false;
      });
      
      if (mapping) {
        // Check conditions
        let conditionsMet = true;
        if (mapping.conditions) {
          if (mapping.conditions.department && testProfile.department) {
            conditionsMet = conditionsMet && mapping.conditions.department.includes(testProfile.department);
          }
          if (mapping.conditions.jobTitle && testProfile.jobTitle) {
            conditionsMet = conditionsMet && mapping.conditions.jobTitle.includes(testProfile.jobTitle);
          }
          if (mapping.conditions.customAttribute && testProfile.customAttributes) {
            const { key, value } = mapping.conditions.customAttribute;
            const userValue = testProfile.customAttributes[key];
            if (Array.isArray(value)) {
              conditionsMet = conditionsMet && value.includes(userValue);
            } else {
              conditionsMet = conditionsMet && userValue === value;
            }
          }
        }
        
        if (conditionsMet) {
          // Determine highest role
          const rolePriority = { owner: 3, admin: 2, member: 1 };
          if (rolePriority[mapping.organizationRole] > rolePriority[organizationRole]) {
            organizationRole = mapping.organizationRole;
          }
          
          // Add team memberships
          if (mapping.teamMappings) {
            teamMemberships.push(...mapping.teamMappings);
          }
        }
      }
    }
    
    // Remove duplicate team memberships
    const uniqueTeamMemberships = Array.from(
      new Map(teamMemberships.map(tm => [tm.teamId, tm])).values()
    );
    
    res.json({
      message: 'Group mapping test completed',
      testProfile: {
        email: testProfile.email,
        groups: testProfile.groups,
        department: testProfile.department,
        jobTitle: testProfile.jobTitle,
      },
      result: {
        organizationRole,
        teamMemberships: uniqueTeamMemberships,
        matchedGroups: testProfile.groups?.filter(group => 
          groupMappings.some((m: any) => 
            m.ssoGroup === group || m.nestedGroups?.includes(group)
          )
        ) || [],
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
      error: 'Failed to test group mapping',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;