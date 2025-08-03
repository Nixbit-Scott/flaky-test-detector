import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-client';
const { Issuer, generators } = require('openid-client');
import * as crypto from 'crypto';
import { logger } from './logger';

/**
 * OIDC Security validation error
 */
export class OIDCSecurityError extends Error {
  constructor(message: string, public securityIssue: string) {
    super(message);
    this.name = 'OIDCSecurityError';
  }
}

/**
 * PKCE (Proof Key for Code Exchange) implementation
 */
export class PKCEManager {
  private static challenges = new Map<string, { codeVerifier: string; createdAt: Date }>();
  
  /**
   * Generate PKCE challenge pair
   */
  static generateChallenge(): { codeVerifier: string; codeChallenge: string; codeChallengeMethod: string } {
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }
  
  /**
   * Store PKCE challenge for later verification
   */
  static storeChallenge(sessionId: string, codeVerifier: string): void {
    this.challenges.set(sessionId, {
      codeVerifier,
      createdAt: new Date()
    });
    
    // Clean up old challenges (older than 10 minutes)
    this.cleanupExpiredChallenges();
  }
  
  /**
   * Retrieve and remove PKCE challenge
   */
  static retrieveChallenge(sessionId: string): string | null {
    const challenge = this.challenges.get(sessionId);
    if (challenge) {
      this.challenges.delete(sessionId);
      return challenge.codeVerifier;
    }
    return null;
  }
  
  /**
   * Clean up expired PKCE challenges
   */
  private static cleanupExpiredChallenges(): void {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    for (const [sessionId, challenge] of this.challenges.entries()) {
      if (challenge.createdAt < tenMinutesAgo) {
        this.challenges.delete(sessionId);
      }
    }
  }
}

/**
 * JWT Security validation
 */
export class JWTSecurity {
  private static jwksClients = new Map<string, JwksClient>();
  private static usedNonces = new Map<string, Date>();
  
  /**
   * Get JWKS client for issuer
   */
  private static getJwksClient(issuer: string): JwksClient {
    if (!this.jwksClients.has(issuer)) {
      const client = new JwksClient({
        jwksUri: `${issuer}/.well-known/jwks.json`,
        requestHeaders: {},
        timeout: 30000,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });
      
      this.jwksClients.set(issuer, client);
    }
    
    return this.jwksClients.get(issuer)!;
  }
  
  /**
   * Validate JWT with comprehensive security checks
   */
  static async validateJWT(
    token: string, 
    issuer: string, 
    audience: string,
    nonce?: string
  ): Promise<any> {
    try {
      // Decode JWT header to get kid
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) {
        throw new OIDCSecurityError('JWT missing key ID', 'INVALID_JWT_HEADER');
      }
      
      // Validate algorithm
      const allowedAlgorithms = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
      if (!allowedAlgorithms.includes(decoded.header.alg)) {
        throw new OIDCSecurityError(
          `Unsupported JWT algorithm: ${decoded.header.alg}`,
          'UNSUPPORTED_ALGORITHM'
        );
      }
      
      // Get signing key from JWKS
      const jwksClient = this.getJwksClient(issuer);
      const key = await jwksClient.getSigningKey(decoded.header.kid);
      const signingKey = key.getPublicKey();
      
      // Verify JWT signature and claims
      const payload = jwt.verify(token, signingKey, {
        issuer: issuer,
        audience: audience,
        algorithms: allowedAlgorithms as jwt.Algorithm[],
        maxAge: '1h', // Token must be less than 1 hour old
        clockTolerance: 30, // 30 seconds clock skew tolerance
      });
      
      if (typeof payload === 'string') {
        throw new OIDCSecurityError('Invalid JWT payload format', 'INVALID_PAYLOAD');
      }
      
      // Additional security validations
      await this.validateJWTClaims(payload, nonce);
      
      logger.info('JWT validation successful', {
        issuer,
        subject: payload.sub,
        audience: payload.aud,
      });
      
      return payload;
    } catch (error) {
      if (error instanceof OIDCSecurityError) {
        throw error;
      }
      
      logger.error('JWT validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        issuer,
      });
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new OIDCSecurityError(`JWT validation failed: ${error.message}`, 'JWT_VALIDATION_FAILED');
      }
      
      throw new OIDCSecurityError('JWT validation error', 'JWT_VALIDATION_ERROR');
    }
  }
  
  /**
   * Validate JWT claims for security
   */
  private static async validateJWTClaims(payload: any, expectedNonce?: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    
    // Validate required claims
    if (!payload.sub) {
      throw new OIDCSecurityError('JWT missing subject claim', 'MISSING_SUBJECT');
    }
    
    if (!payload.iat) {
      throw new OIDCSecurityError('JWT missing issued at claim', 'MISSING_ISSUED_AT');
    }
    
    if (!payload.exp) {
      throw new OIDCSecurityError('JWT missing expiration claim', 'MISSING_EXPIRATION');
    }
    
    // Validate timing claims
    if (payload.iat > now + 30) { // Allow 30 seconds for clock skew
      throw new OIDCSecurityError('JWT issued in the future', 'FUTURE_ISSUED_AT');
    }
    
    if (payload.exp <= now) {
      throw new OIDCSecurityError('JWT has expired', 'TOKEN_EXPIRED');
    }
    
    // Validate not before claim if present
    if (payload.nbf && payload.nbf > now + 30) {
      throw new OIDCSecurityError('JWT not yet valid', 'TOKEN_NOT_YET_VALID');
    }
    
    // Validate nonce if provided (replay attack prevention)
    if (expectedNonce) {
      if (!payload.nonce) {
        throw new OIDCSecurityError('JWT missing nonce claim', 'MISSING_NONCE');
      }
      
      if (payload.nonce !== expectedNonce) {
        throw new OIDCSecurityError('JWT nonce mismatch', 'NONCE_MISMATCH');
      }
      
      // Check for nonce replay
      if (this.usedNonces.has(payload.nonce)) {
        throw new OIDCSecurityError('JWT nonce already used', 'NONCE_REPLAY');
      }
      
      // Store nonce to prevent replay
      this.usedNonces.set(payload.nonce, new Date());
    }
    
    // Clean up old nonces
    this.cleanupExpiredNonces();
  }
  
  /**
   * Clean up expired nonces (older than 1 hour)
   */
  private static cleanupExpiredNonces(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [nonce, createdAt] of this.usedNonces.entries()) {
      if (createdAt < oneHourAgo) {
        this.usedNonces.delete(nonce);
      }
    }
  }
  
  /**
   * Generate secure nonce
   */
  static generateNonce(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
  
  /**
   * Generate secure state parameter
   */
  static generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

/**
 * OIDC Provider Discovery and Validation
 */
export class OIDCProviderValidator {
  private static discoveryCache = new Map<string, { issuer: any; cachedAt: Date }>();
  
  /**
   * Discover and validate OIDC provider
   */
  static async discoverProvider(issuerUrl: string): Promise<any> {
    try {
      // Check cache first
      const cached = this.discoveryCache.get(issuerUrl);
      if (cached && (Date.now() - cached.cachedAt.getTime()) < 24 * 60 * 60 * 1000) {
        return cached.issuer;
      }
      
      // Discover provider
      const issuer = await Issuer.discover(issuerUrl);
      
      // Validate provider metadata
      this.validateProviderMetadata(issuer.metadata);
      
      // Cache the result
      this.discoveryCache.set(issuerUrl, {
        issuer,
        cachedAt: new Date()
      });
      
      logger.info('OIDC provider discovery successful', {
        issuer: issuerUrl,
        authorizationEndpoint: issuer.metadata.authorization_endpoint,
        tokenEndpoint: issuer.metadata.token_endpoint,
      });
      
      return issuer;
    } catch (error) {
      logger.error('OIDC provider discovery failed', {
        issuer: issuerUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new OIDCSecurityError(
        `OIDC provider discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_DISCOVERY_FAILED'
      );
    }
  }
  
  /**
   * Validate OIDC provider metadata for security
   */
  private static validateProviderMetadata(metadata: any): void {
    // Validate required endpoints
    if (!metadata.authorization_endpoint) {
      throw new OIDCSecurityError('Provider missing authorization endpoint', 'MISSING_AUTH_ENDPOINT');
    }
    
    if (!metadata.token_endpoint) {
      throw new OIDCSecurityError('Provider missing token endpoint', 'MISSING_TOKEN_ENDPOINT');
    }
    
    if (!metadata.jwks_uri) {
      throw new OIDCSecurityError('Provider missing JWKS URI', 'MISSING_JWKS_URI');
    }
    
    // Validate HTTPS endpoints
    const endpoints = [
      metadata.authorization_endpoint,
      metadata.token_endpoint,
      metadata.jwks_uri,
      metadata.userinfo_endpoint,
      metadata.end_session_endpoint
    ].filter(Boolean);
    
    for (const endpoint of endpoints) {
      if (!endpoint.startsWith('https://')) {
        throw new OIDCSecurityError(
          `Provider endpoint must use HTTPS: ${endpoint}`,
          'INSECURE_ENDPOINT'
        );
      }
    }
    
    // Validate supported response types
    if (!metadata.response_types_supported || 
        !metadata.response_types_supported.includes('code')) {
      throw new OIDCSecurityError(
        'Provider must support authorization code flow',
        'UNSUPPORTED_RESPONSE_TYPE'
      );
    }
    
    // Validate supported signing algorithms
    const supportedAlgorithms = metadata.id_token_signing_alg_values_supported || [];
    const secureAlgorithms = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
    
    if (!supportedAlgorithms.some((alg: string) => secureAlgorithms.includes(alg))) {
      throw new OIDCSecurityError(
        'Provider must support secure signing algorithms',
        'UNSUPPORTED_SIGNING_ALGORITHM'
      );
    }
    
    logger.debug('OIDC provider metadata validated', {
      issuer: metadata.issuer,
      supportedAlgorithms,
    });
  }
  
  /**
   * Validate OIDC configuration for security
   */
  static validateOIDCConfiguration(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Validate issuer URL
      if (!config.issuer) {
        errors.push('Issuer URL is required');
      } else if (!config.issuer.startsWith('https://')) {
        errors.push('Issuer URL must use HTTPS');
      }
      
      // Validate client credentials
      if (!config.clientID) {
        errors.push('Client ID is required');
      } else if (config.clientID.length < 8) {
        errors.push('Client ID should be at least 8 characters');
      }
      
      if (!config.clientSecret) {
        errors.push('Client secret is required');
      } else if (config.clientSecret.length < 16) {
        errors.push('Client secret should be at least 16 characters for security');
      }
      
      // Validate callback URL
      if (!config.callbackURL) {
        errors.push('Callback URL is required');
      } else if (!config.callbackURL.startsWith('https://') && 
                 !config.callbackURL.startsWith('http://localhost')) {
        errors.push('Callback URL must use HTTPS (except localhost for development)');
      }
      
      // Validate scopes
      if (!config.scope || !Array.isArray(config.scope)) {
        errors.push('Scopes must be an array');
      } else if (!config.scope.includes('openid')) {
        errors.push('OpenID scope is required for OIDC');
      }
      
      // Validate response type
      if (config.responseType && config.responseType !== 'code') {
        errors.push('Only authorization code flow is supported for security');
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      errors.push(`Configuration validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors
      };
    }
  }
}

/**
 * Token Revocation Handler
 */
export class TokenRevocationHandler {
  private static revokedTokens = new Map<string, Date>();
  
  /**
   * Revoke a token (add to blacklist)
   */
  static revokeToken(tokenId: string): void {
    this.revokedTokens.set(tokenId, new Date());
    
    // Clean up old revoked tokens
    this.cleanupRevokedTokens();
    
    logger.info('Token revoked', { tokenId: tokenId.substring(0, 10) + '...' });
  }
  
  /**
   * Check if token is revoked
   */
  static isTokenRevoked(tokenId: string): boolean {
    return this.revokedTokens.has(tokenId);
  }
  
  /**
   * Clean up old revoked tokens (older than 24 hours)
   */
  private static cleanupRevokedTokens(): void {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [tokenId, revokedAt] of this.revokedTokens.entries()) {
      if (revokedAt < twentyFourHoursAgo) {
        this.revokedTokens.delete(tokenId);
      }
    }
  }
  
  /**
   * Revoke token via provider endpoint
   */
  static async revokeTokenAtProvider(
    token: string,
    tokenTypeHint: 'access_token' | 'refresh_token',
    clientId: string,
    clientSecret: string,
    revocationEndpoint: string
  ): Promise<void> {
    try {
      const response = await fetch(revocationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          token: token,
          token_type_hint: tokenTypeHint
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.status} ${response.statusText}`);
      }
      
      logger.info('Token revoked at provider', {
        tokenType: tokenTypeHint,
        endpoint: revocationEndpoint
      });
    } catch (error) {
      logger.error('Token revocation at provider failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: revocationEndpoint
      });
      
      throw new OIDCSecurityError(
        'Token revocation failed',
        'TOKEN_REVOCATION_FAILED'
      );
    }
  }
}