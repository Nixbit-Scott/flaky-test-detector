import * as crypto from 'crypto';
import { logger } from './logger';

/**
 * Simple secure storage utility for sensitive SSO configuration data
 * Uses AES-256-CBC encryption with HMAC for authentication
 */
export class SecureStorage {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  
  private static encryptionKey: Buffer | null = null;
  private static hmacKey: Buffer | null = null;
  
  /**
   * Initialize the encryption keys from environment
   */
  private static getEncryptionKeys(): { encryptionKey: Buffer; hmacKey: Buffer } {
    if (!this.encryptionKey || !this.hmacKey) {
      const keyMaterial = process.env.SSO_ENCRYPTION_KEY;
      if (!keyMaterial) {
        throw new Error('SSO_ENCRYPTION_KEY environment variable is required for secure storage');
      }
      
      if (keyMaterial.length < 32) {
        throw new Error('SSO_ENCRYPTION_KEY must be at least 32 characters long');
      }
      
      // Derive keys for encryption and HMAC
      this.encryptionKey = crypto.scryptSync(keyMaterial, 'sso-encrypt-salt', this.KEY_LENGTH);
      this.hmacKey = crypto.scryptSync(keyMaterial, 'sso-hmac-salt', this.KEY_LENGTH);
    }
    
    return { encryptionKey: this.encryptionKey, hmacKey: this.hmacKey };
  }
  
  /**
   * Encrypt sensitive data
   */
  static encrypt(plaintext: string): string {
    try {
      const { encryptionKey, hmacKey } = this.getEncryptionKeys();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, encryptionKey, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Create HMAC for authentication
      const hmac = crypto.createHmac('sha256', hmacKey);
      hmac.update(iv.toString('hex') + encrypted);
      const authTag = hmac.digest('hex');
      
      // Combine IV, encrypted data, and auth tag
      const result = iv.toString('hex') + encrypted + authTag;
      
      logger.debug('Successfully encrypted sensitive data', {
        originalLength: plaintext.length,
        encryptedLength: result.length,
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to encrypt sensitive data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Encryption failed');
    }
  }
  
  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string): string {
    try {
      const { encryptionKey, hmacKey } = this.getEncryptionKeys();
      
      // Extract IV, encrypted data, and auth tag
      const iv = Buffer.from(encryptedData.slice(0, this.IV_LENGTH * 2), 'hex');
      const authTag = encryptedData.slice(-64); // Last 64 chars (32 bytes hex)
      const encrypted = encryptedData.slice(this.IV_LENGTH * 2, -64);
      
      // Verify HMAC
      const hmac = crypto.createHmac('sha256', hmacKey);
      hmac.update(iv.toString('hex') + encrypted);
      const expectedTag = hmac.digest('hex');
      
      if (!crypto.timingSafeEqual(Buffer.from(authTag, 'hex'), Buffer.from(expectedTag, 'hex'))) {
        throw new Error('Authentication failed - data may have been tampered with');
      }
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      logger.debug('Successfully decrypted sensitive data', {
        encryptedLength: encryptedData.length,
        decryptedLength: decrypted.length,
      });
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt sensitive data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        encryptedDataLength: encryptedData?.length || 0,
      });
      throw new Error('Decryption failed');
    }
  }
  
  /**
   * Encrypt SSO configuration with sensitive data protection
   */
  static encryptSSOConfig(config: any): any {
    const encryptedConfig = { ...config };
    
    // List of sensitive fields that should be encrypted
    const sensitiveFields = [
      'cert', // SAML certificate
      'privateKey', // SAML private key
      'clientSecret', // OIDC client secret
      'signingKey', // JWT signing key
    ];
    
    for (const field of sensitiveFields) {
      if (encryptedConfig[field] && typeof encryptedConfig[field] === 'string') {
        try {
          encryptedConfig[field] = this.encrypt(encryptedConfig[field]);
          encryptedConfig[`${field}_encrypted`] = true;
          
          logger.info(`Encrypted sensitive field: ${field}`, {
            fieldLength: config[field].length,
          });
        } catch (error) {
          logger.error(`Failed to encrypt field: ${field}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      }
    }
    
    return encryptedConfig;
  }
  
  /**
   * Decrypt SSO configuration
   */
  static decryptSSOConfig(config: any): any {
    if (!config) return config;
    
    const decryptedConfig = { ...config };
    
    // List of sensitive fields that might be encrypted
    const sensitiveFields = [
      'cert',
      'privateKey',
      'clientSecret',
      'signingKey',
    ];
    
    for (const field of sensitiveFields) {
      if (decryptedConfig[field] && decryptedConfig[`${field}_encrypted`]) {
        try {
          decryptedConfig[field] = this.decrypt(decryptedConfig[field]);
          delete decryptedConfig[`${field}_encrypted`];
          
          logger.debug(`Decrypted sensitive field: ${field}`);
        } catch (error) {
          logger.error(`Failed to decrypt field: ${field}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      }
    }
    
    return decryptedConfig;
  }
  
  /**
   * Hash sensitive data for comparison without storing plaintext
   */
  static hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Generate a secure random string for secrets
   */
  static generateSecureSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Validate that required encryption key is properly configured
   */
  static validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const keyMaterial = process.env.SSO_ENCRYPTION_KEY;
      if (!keyMaterial) {
        errors.push('SSO_ENCRYPTION_KEY environment variable is not set');
      } else if (keyMaterial.length < 32) {
        errors.push('SSO_ENCRYPTION_KEY must be at least 32 characters long');
      }
      
      // Test encryption/decryption
      if (keyMaterial && keyMaterial.length >= 32) {
        const testData = 'test-encryption-data';
        const encrypted = this.encrypt(testData);
        const decrypted = this.decrypt(encrypted);
        
        if (decrypted !== testData) {
          errors.push('Encryption/decryption test failed');
        }
      }
    } catch (error) {
      errors.push(`Encryption configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}