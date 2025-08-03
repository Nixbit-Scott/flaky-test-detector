import passport from 'passport';
import { Strategy as SamlStrategy, Profile as SamlProfile } from '@node-saml/passport-saml';
import { Strategy as OpenIDConnectStrategy, Profile as OIDCProfile } from 'passport-openidconnect';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { SSOService, SSOUserProfile } from '../services/sso.service';
import { UserService } from '../services/user.service';
import { logger } from '../utils/logger';
import { validateSAMLResponse, validateCertificate, SecurityValidationError } from '../utils/saml-security';
import { 
  PKCEManager, 
  JWTSecurity, 
  OIDCProviderValidator, 
  TokenRevocationHandler, 
  OIDCSecurityError 
} from '../utils/oidc-security';

// Type definitions are in src/types/express.d.ts

// Security configuration for SAML
interface SAMLSecurityConfig {
  validateSignature: boolean;
  validateCertificate: boolean;
  allowedClockDrift: number;
  disallowXMLExternalEntities: boolean;
  requireSignedAssertions: boolean;
  requireSignedResponse: boolean;
}

// Default security configuration
const DEFAULT_SAML_SECURITY: SAMLSecurityConfig = {
  validateSignature: true,
  validateCertificate: true,
  allowedClockDrift: 300, // 5 minutes
  disallowXMLExternalEntities: true,
  requireSignedAssertions: true,
  requireSignedResponse: true,
};


// Email validation helper
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Initialize Passport
export function initializePassport(): void {
  // Serialize user for session storage
  passport.serializeUser((user: any, done) => {
    done(null, {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
    });
  });

  // Deserialize user from session
  passport.deserializeUser(async (serializedUser: any, done) => {
    try {
      const user = await UserService.getUserById(serializedUser.id);
      done(null, { ...user, organizationId: serializedUser.organizationId });
    } catch (error) {
      done(error, null);
    }
  });

  // Configure SAML strategies dynamically
  configureSAMLStrategies();
  
  // Configure OIDC strategies dynamically
  configureOIDCStrategies();
}

async function configureSAMLStrategies(): Promise<void> {
  // We'll register SAML strategies dynamically based on organization SSO configs
  // This is called when setting up SSO for an organization
}

async function configureOIDCStrategies(): Promise<void> {
  // We'll register OIDC strategies dynamically based on organization SSO configs
  // This is called when setting up SSO for an organization
}

export async function configureSAMLStrategy(organizationId: string, providerId: string): Promise<void> {
  const provider = await SSOService.getSSOProvider(providerId);
  
  if (!provider || provider.type !== 'saml') {
    throw new Error('SAML provider not found or invalid type');
  }

  const config = provider.config as any;
  const strategyName = `saml-${organizationId}-${providerId}`;

  // Validate certificate before creating strategy
  await validateCertificate(config.cert, organizationId, providerId);
  
  // Enhanced security configuration
  const securityConfig: SAMLSecurityConfig = {
    ...DEFAULT_SAML_SECURITY,
    ...config.security,
  };

  const samlStrategy = new SamlStrategy(
    {
      entryPoint: config.entryPoint,
      issuer: config.issuer,
      callbackUrl: config.callbackUrl,
      cert: config.cert,
      identifierFormat: config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      signatureAlgorithm: config.signatureAlgorithm || 'sha256',
      forceAuthn: config.forceAuthn || false,
      passReqToCallback: true,
      // Security enhancements
      validateInResponseTo: securityConfig.validateSignature,
      disableRequestedAuthnContext: false,
      acceptedClockSkewMs: securityConfig.allowedClockDrift * 1000,
      maxAssertionAgeMs: 300000, // 5 minutes
      // Anti-XSW protections
      wantAssertionsSigned: securityConfig.requireSignedAssertions,
      wantAuthnResponseSigned: securityConfig.requireSignedResponse,
    },
    async (req: any, profile: any, done: any) => {
      try {
        // Additional security validation
        await validateSAMLResponse(profile, securityConfig, organizationId, providerId);
        
        // Audit logging
        logger.info('SAML authentication attempt', {
          organizationId,
          providerId,
          userId: profile.nameID,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });

        const ssoProfile: SSOUserProfile = {
          email: extractSAMLAttribute(profile, config.attributeMapping?.email || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
          firstName: extractSAMLAttribute(profile, config.attributeMapping?.firstName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'),
          lastName: extractSAMLAttribute(profile, config.attributeMapping?.lastName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'),
          displayName: extractSAMLAttribute(profile, config.attributeMapping?.displayName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'),
          groups: extractSAMLGroups(profile, config.attributeMapping?.groups || 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'),
          provider: 'saml',
          providerId: providerId,
        };

        if (!ssoProfile.email) {
          logger.warn('SAML authentication failed - no email', {
            organizationId,
            providerId,
            profile: profile.nameID,
          });
          return done(new Error('Email not provided by SAML provider'), null);
        }
        
        // Additional email validation
        if (!isValidEmail(ssoProfile.email)) {
          logger.warn('SAML authentication failed - invalid email format', {
            organizationId,
            providerId,
            email: ssoProfile.email,
          });
          return done(new Error('Invalid email format from SAML provider'), null);
        }

        const result = await SSOService.processUserFromSSO(ssoProfile, organizationId);
        
        done(null, {
          ...result.user,
          organizationId,
          isNewUser: result.isNewUser,
          organizationRole: result.organizationRole,
          teamMemberships: result.teamMemberships,
        });
      } catch (error) {
        // Enhanced error logging for SAML
        if (error instanceof SecurityValidationError) {
          logger.error('SAML security validation failed', {
            organizationId,
            providerId,
            error: error.message,
            securityIssue: error.securityIssue,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });
        } else {
          logger.error('SAML authentication error', {
            organizationId,
            providerId,
            error: error instanceof Error ? error.message : 'Unknown error',
            ip: req.ip,
          });
        }
        done(error, null);
      }
    }
  );

  passport.use(strategyName, samlStrategy);
}

export async function configureOIDCStrategy(organizationId: string, providerId: string): Promise<void> {
  const provider = await SSOService.getSSOProvider(providerId);
  
  if (!provider || provider.type !== 'oidc') {
    throw new Error('OIDC provider not found or invalid type');
  }

  const config = provider.config as any;
  const strategyName = `oidc-${organizationId}-${providerId}`;

  // Validate OIDC configuration
  const configValidation = OIDCProviderValidator.validateOIDCConfiguration(config);
  if (!configValidation.isValid) {
    throw new Error(`OIDC configuration validation failed: ${configValidation.errors.join(', ')}`);
  }

  // Discover and validate OIDC provider
  const issuer = await OIDCProviderValidator.discoverProvider(config.issuer);
  
  const oidcStrategy = new OpenIDConnectStrategy(
    {
      issuer: config.issuer,
      clientID: config.clientID,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackURL,
      scope: (config.scope || ['openid', 'profile', 'email']).join(' '),
      responseType: 'code', // Force authorization code flow for security
      responseMode: config.responseMode || 'query',
      passReqToCallback: true,
      // Enhanced security parameters
      usePKCE: true, // Enable PKCE support
      state: true, // Enable state parameter
      nonce: true, // Enable nonce for replay protection
    },
    async (req: any, iss: string, sub: string, profile: OIDCProfile, accessToken: string, refreshToken: string, params: any, done: any) => {
      try {
        // Audit logging for OIDC authentication
        logger.info('OIDC authentication attempt', {
          organizationId,
          providerId,
          userId: sub,
          issuer: iss,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });

        // Validate ID token if present
        if (params.id_token) {
          const expectedNonce = req.session?.oidcNonce;
          await JWTSecurity.validateJWT(
            params.id_token,
            iss,
            config.clientID,
            expectedNonce
          );
          
          // Clear nonce after use
          if (req.session) {
            delete req.session.oidcNonce;
          }
        }

        // Check for token revocation
        if (params.id_token) {
          const decoded = require('jsonwebtoken').decode(params.id_token, { complete: true });
          if (decoded && decoded.payload.jti && TokenRevocationHandler.isTokenRevoked(decoded.payload.jti)) {
            throw new OIDCSecurityError('Token has been revoked', 'TOKEN_REVOKED');
          }
        }

        // Verify PKCE challenge if present
        const sessionId = req.sessionID;
        const codeVerifier = PKCEManager.retrieveChallenge(sessionId);
        if (config.usePKCE && !codeVerifier) {
          logger.warn('OIDC PKCE challenge missing or expired', {
            organizationId,
            providerId,
            sessionId: sessionId.substring(0, 10) + '...',
          });
          // Continue without failing - some providers may not use PKCE
        }

        const ssoProfile: SSOUserProfile = {
          email: extractOIDCClaim(profile, config.attributeMapping?.email || 'email'),
          firstName: extractOIDCClaim(profile, config.attributeMapping?.firstName || 'given_name'),
          lastName: extractOIDCClaim(profile, config.attributeMapping?.lastName || 'family_name'),
          displayName: extractOIDCClaim(profile, config.attributeMapping?.displayName || 'name'),
          groups: extractOIDCGroups(profile, config.attributeMapping?.groups || 'groups'),
          provider: 'oidc',
          providerId: providerId,
        };

        if (!ssoProfile.email) {
          logger.warn('OIDC authentication failed - no email', {
            organizationId,
            providerId,
            subject: sub,
          });
          return done(new Error('Email not provided by OIDC provider'), null);
        }
        
        // Additional email validation
        if (!isValidEmail(ssoProfile.email)) {
          logger.warn('OIDC authentication failed - invalid email format', {
            organizationId,
            providerId,
            email: ssoProfile.email,
          });
          return done(new Error('Invalid email format from OIDC provider'), null);
        }

        const result = await SSOService.processUserFromSSO(ssoProfile, organizationId);
        
        // Store tokens securely if needed for future API calls
        const user = {
          ...result.user,
          organizationId,
          isNewUser: result.isNewUser,
          organizationRole: result.organizationRole,
          teamMemberships: result.teamMemberships,
          // Store access token hash for revocation tracking if needed
          accessTokenHash: accessToken ? crypto.createHash('sha256').update(accessToken).digest('hex').substring(0, 16) : undefined,
        };

        logger.info('OIDC authentication successful', {
          organizationId,
          providerId,
          userId: result.user.id,
          email: ssoProfile.email,
          isNewUser: result.isNewUser,
        });
        
        done(null, user);
      } catch (error) {
        // Enhanced error logging for OIDC
        if (error instanceof OIDCSecurityError) {
          logger.error('OIDC security validation failed', {
            organizationId,
            providerId,
            error: error.message,
            securityIssue: error.securityIssue,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });
        } else {
          logger.error('OIDC authentication error', {
            organizationId,
            providerId,
            error: error instanceof Error ? error.message : 'Unknown error',
            ip: req.ip,
          });
        }
        done(error, null);
      }
    }
  );

  passport.use(strategyName, oidcStrategy);
}

function extractSAMLAttribute(profile: SamlProfile, attributeName: string): string | undefined {
  if (!profile.attributes) return undefined;
  
  const attribute = profile.attributes[attributeName];
  if (Array.isArray(attribute)) {
    return attribute[0];
  }
  return attribute;
}

function extractSAMLGroups(profile: SamlProfile, attributeName: string): string[] {
  if (!profile.attributes) return [];
  
  const groups = profile.attributes[attributeName];
  if (Array.isArray(groups)) {
    return groups;
  }
  if (typeof groups === 'string') {
    return [groups];
  }
  return [];
}

function extractOIDCClaim(profile: OIDCProfile, claimName: string): string | undefined {
  const claims = profile._json || profile;
  return claims[claimName];
}

function extractOIDCGroups(profile: OIDCProfile, claimName: string): string[] {
  const claims = profile._json || profile;
  const groups = claims[claimName];
  
  if (Array.isArray(groups)) {
    return groups;
  }
  if (typeof groups === 'string') {
    // Handle comma-separated or space-separated groups
    return groups.split(/[,\s]+/).filter(g => g.trim());
  }
  return [];
}

export function getStrategyName(organizationId: string, providerId: string, type: 'saml' | 'oidc'): string {
  return `${type}-${organizationId}-${providerId}`;
}

export async function removeSSOStrategy(organizationId: string, providerId: string, type: 'saml' | 'oidc'): Promise<void> {
  const strategyName = getStrategyName(organizationId, providerId, type);
  passport.unuse(strategyName);
}

/**
 * Generate OIDC authorization URL with PKCE and security parameters
 */
export async function generateOIDCAuthURL(
  organizationId: string, 
  providerId: string, 
  sessionId: string,
  req: any
): Promise<string> {
  const provider = await SSOService.getSSOProvider(providerId);
  
  if (!provider || provider.type !== 'oidc') {
    throw new Error('OIDC provider not found or invalid type');
  }

  const config = provider.config as any;
  
  // Discover OIDC provider
  const issuer = await OIDCProviderValidator.discoverProvider(config.issuer);
  
  // Generate PKCE challenge
  const pkceChallenge = PKCEManager.generateChallenge();
  PKCEManager.storeChallenge(sessionId, pkceChallenge.codeVerifier);
  
  // Generate nonce and state for security
  const nonce = JWTSecurity.generateNonce();
  const state = JWTSecurity.generateState();
  
  // Store nonce and state in session for later verification
  if (req.session) {
    req.session.oidcNonce = nonce;
    req.session.oidcState = state;
  }
  
  // Build authorization URL
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientID,
    redirect_uri: config.callbackURL,
    scope: (config.scope || ['openid', 'profile', 'email']).join(' '),
    state: state,
    nonce: nonce,
    code_challenge: pkceChallenge.codeChallenge,
    code_challenge_method: pkceChallenge.codeChallengeMethod,
    // Additional security parameters
    prompt: 'select_account', // Force account selection
    max_age: '3600', // Maximum authentication age
  });
  
  const authUrl = `${issuer.metadata.authorization_endpoint}?${authParams.toString()}`;
  
  logger.info('Generated OIDC authorization URL', {
    organizationId,
    providerId,
    sessionId: sessionId.substring(0, 10) + '...',
    hasPKCE: true,
    hasNonce: true,
    hasState: true,
  });
  
  return authUrl;
}

/**
 * Validate OIDC callback state parameter
 */
export function validateOIDCState(req: any, receivedState: string): boolean {
  const expectedState = req.session?.oidcState;
  
  if (!expectedState) {
    logger.warn('OIDC state validation failed - no state in session', {
      sessionId: req.sessionID?.substring(0, 10) + '...',
    });
    return false;
  }
  
  if (expectedState !== receivedState) {
    logger.warn('OIDC state validation failed - state mismatch', {
      sessionId: req.sessionID?.substring(0, 10) + '...',
      expected: expectedState.substring(0, 10) + '...',
      received: receivedState?.substring(0, 10) + '...',
    });
    return false;
  }
  
  // Clear state after use
  delete req.session.oidcState;
  return true;
}