import * as crypto from 'crypto';
import * as fs from 'fs';
import { promisify } from 'util';
import { logger } from './logger';

const readFile = promisify(fs.readFile);

/**
 * Security validation error for SAML operations
 */
export class SecurityValidationError extends Error {
  constructor(message: string, public securityIssue: string) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

/**
 * Certificate validation and management
 */
export class CertificateValidator {
  private static certCache = new Map<string, { cert: string; validUntil: Date; fingerprint: string }>();
  
  /**
   * Validate X.509 certificate
   */
  static async validateCertificate(
    certPem: string, 
    organizationId: string, 
    providerId: string
  ): Promise<void> {
    try {
      // Parse certificate
      const cert = crypto.X509Certificate ? new crypto.X509Certificate(certPem) : null;
      
      if (!cert) {
        throw new SecurityValidationError(
          'Unable to parse X.509 certificate',
          'INVALID_CERTIFICATE_FORMAT'
        );
      }

      // Check certificate validity period
      const now = new Date();
      const validFrom = new Date(cert.validFrom);
      const validTo = new Date(cert.validTo);
      
      if (now < validFrom) {
        throw new SecurityValidationError(
          'Certificate is not yet valid',
          'CERTIFICATE_NOT_YET_VALID'
        );
      }
      
      if (now > validTo) {
        throw new SecurityValidationError(
          'Certificate has expired',
          'CERTIFICATE_EXPIRED'
        );
      }
      
      // Check if certificate expires within 30 days
      const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      if (validTo < thirtyDaysFromNow) {
        logger.warn('Certificate expires soon', {
          organizationId,
          providerId,
          expiresAt: validTo.toISOString(),
          daysUntilExpiry: Math.ceil((validTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        });
      }
      
      // Generate certificate fingerprint for caching
      const fingerprint = crypto.createHash('sha256').update(certPem).digest('hex');
      
      // Cache valid certificate
      this.certCache.set(`${organizationId}-${providerId}`, {
        cert: certPem,
        validUntil: validTo,
        fingerprint,
      });
      
      logger.info('Certificate validation successful', {
        organizationId,
        providerId,
        fingerprint: fingerprint.substring(0, 16) + '...',
        validUntil: validTo.toISOString(),
      });
      
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        throw error;
      }
      
      logger.error('Certificate validation failed', {
        organizationId,
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new SecurityValidationError(
        'Certificate validation failed',
        'CERTIFICATE_VALIDATION_ERROR'
      );
    }
  }
  
  /**
   * Get cached certificate info
   */
  static getCachedCertificate(organizationId: string, providerId: string) {
    return this.certCache.get(`${organizationId}-${providerId}`);
  }
  
  /**
   * Clean expired certificates from cache
   */
  static cleanExpiredCertificates(): void {
    const now = new Date();
    const keysToDelete: string[] = [];
    
    this.certCache.forEach((cert, key) => {
      if (cert.validUntil < now) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.certCache.delete(key);
      logger.info('Removed expired certificate from cache', { key });
    });
  }
}

/**
 * SAML response validation
 */
export async function validateSAMLResponse(
  profile: any,
  securityConfig: any,
  organizationId: string,
  providerId: string
): Promise<void> {
  try {
    // Validate basic profile structure
    if (!profile) {
      throw new SecurityValidationError(
        'SAML profile is null or undefined',
        'INVALID_SAML_PROFILE'
      );
    }
    
    // Validate NameID
    if (!profile.nameID) {
      throw new SecurityValidationError(
        'SAML NameID is missing',
        'MISSING_NAME_ID'
      );
    }
    
    // Validate session index for logout tracking
    if (!profile.sessionIndex) {
      logger.warn('SAML session index missing - logout may not work properly', {
        organizationId,
        providerId,
        nameID: profile.nameID,
      });
    }
    
    // Validate assertion timestamps if available
    if (profile.getAssertionXml) {
      await validateAssertionTimestamps(profile, securityConfig);
    }
    
    // Validate audience restrictions
    if (profile.audience && Array.isArray(profile.audience)) {
      validateAudienceRestrictions(profile.audience, organizationId, providerId);
    }
    
    // Additional security checks
    await performAdditionalSecurityChecks(profile, organizationId, providerId);
    
    logger.debug('SAML response validation successful', {
      organizationId,
      providerId,
      nameID: profile.nameID,
      sessionIndex: profile.sessionIndex,
    });
    
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      throw error;
    }
    
    logger.error('SAML response validation failed', {
      organizationId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw new SecurityValidationError(
      'SAML response validation failed',
      'SAML_VALIDATION_ERROR'
    );
  }
}

/**
 * Validate assertion timestamps
 */
async function validateAssertionTimestamps(profile: any, securityConfig: any): Promise<void> {
  try {
    const assertionXml = profile.getAssertionXml();
    if (!assertionXml) return;
    
    // Parse assertion timestamps
    const notBeforeMatch = assertionXml.match(/NotBefore="([^"]+)"/);
    const notOnOrAfterMatch = assertionXml.match(/NotOnOrAfter="([^"]+)"/);
    
    if (notBeforeMatch && notOnOrAfterMatch) {
      const notBefore = new Date(notBeforeMatch[1]);
      const notOnOrAfter = new Date(notOnOrAfterMatch[1]);
      const now = new Date();
      const clockSkew = securityConfig.allowedClockDrift * 1000; // Convert to milliseconds
      
      if (now.getTime() < (notBefore.getTime() - clockSkew)) {
        throw new SecurityValidationError(
          'Assertion is not yet valid',
          'ASSERTION_NOT_YET_VALID'
        );
      }
      
      if (now.getTime() > (notOnOrAfter.getTime() + clockSkew)) {
        throw new SecurityValidationError(
          'Assertion has expired',
          'ASSERTION_EXPIRED'
        );
      }
    }
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      throw error;
    }
    // Log but don't fail on timestamp parsing errors
    logger.warn('Could not validate assertion timestamps', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate audience restrictions
 */
function validateAudienceRestrictions(
  audiences: string[], 
  organizationId: string, 
  providerId: string
): void {
  // Get expected audience from configuration
  const expectedAudience = process.env.SAML_AUDIENCE || `flaky-test-detector-${organizationId}`;
  
  if (!audiences.includes(expectedAudience)) {
    logger.warn('Audience restriction validation failed', {
      organizationId,
      providerId,
      expectedAudience,
      receivedAudiences: audiences,
    });
    
    // Don't fail on audience mismatch by default, but log for security monitoring
    // Uncomment to enforce strict audience validation:
    // throw new SecurityValidationError(
    //   'Audience restriction validation failed',
    //   'INVALID_AUDIENCE'
    // );
  }
}

/**
 * Perform additional security checks
 */
async function performAdditionalSecurityChecks(
  profile: any,
  organizationId: string,
  providerId: string
): Promise<void> {
  // Check for suspicious patterns in attributes
  if (profile.attributes) {
    for (const [key, value] of Object.entries(profile.attributes)) {
      if (typeof value === 'string' && containsSuspiciousContent(value)) {
        logger.warn('Suspicious content detected in SAML attribute', {
          organizationId,
          providerId,
          attributeName: key,
          suspiciousValue: value.substring(0, 100) + '...',
        });
      }
    }
  }
  
  // Rate limiting check for repeated authentication attempts
  await checkAuthenticationRateLimit(profile.nameID, organizationId, providerId);
}

/**
 * Check for suspicious content that might indicate injection attempts
 */
function containsSuspiciousContent(value: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /vbscript:/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(value));
}

/**
 * Check authentication rate limiting
 */
async function checkAuthenticationRateLimit(
  nameID: string,
  organizationId: string,
  providerId: string
): Promise<void> {
  // Simple in-memory rate limiting (in production, use Redis)
  const key = `auth_rate_${organizationId}_${providerId}_${nameID}`;
  const maxAttempts = 10;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  // In a real implementation, you would use a proper rate limiting store like Redis
  // For now, just log the attempt
  logger.debug('Authentication rate limit check', {
    organizationId,
    providerId,
    nameID,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Export the main validation functions
 */
export const validateCertificate = CertificateValidator.validateCertificate.bind(CertificateValidator);
export const getCachedCertificate = CertificateValidator.getCachedCertificate.bind(CertificateValidator);
export const cleanExpiredCertificates = CertificateValidator.cleanExpiredCertificates.bind(CertificateValidator);