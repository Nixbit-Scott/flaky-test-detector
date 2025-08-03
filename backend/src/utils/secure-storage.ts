import * as crypto from 'crypto';
import { logger } from './logger';

/**
 * Secure storage utility for sensitive SSO configuration data
 * Uses AES-256-GCM encryption with environment-specific keys
 */
export class SecureStorage {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  
  private static encryptionKey: Buffer | null = null;
  
  /**
   * Initialize the encryption key from environment
   */
  private static getEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      const keyMaterial = process.env.SSO_ENCRYPTION_KEY;
      if (!keyMaterial) {
        throw new Error('SSO_ENCRYPTION_KEY environment variable is required for secure storage');
      }
      
      if (keyMaterial.length < 32) {
        throw new Error('SSO_ENCRYPTION_KEY must be at least 32 characters long');
      }
      
      // Derive a consistent key from the environment variable
      this.encryptionKey = crypto.scryptSync(keyMaterial, 'sso-salt', this.KEY_LENGTH);
    }
    
    return this.encryptionKey;
  }
  
  /**
   * Encrypt sensitive data
   */
  static encrypt(plaintext: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipher(this.ALGORITHM, key);
      cipher.setAAD(Buffer.from('sso-config', 'utf8'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const result = iv.toString('hex') + tag.toString('hex') + encrypted;
      
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
      const key = this.getEncryptionKey();
      
      // Extract IV, tag, and encrypted data
      const iv = Buffer.from(encryptedData.slice(0, this.IV_LENGTH * 2), 'hex');
      const tag = Buffer.from(encryptedData.slice(this.IV_LENGTH * 2, (this.IV_LENGTH + this.TAG_LENGTH) * 2), 'hex');
      const encrypted = encryptedData.slice((this.IV_LENGTH + this.TAG_LENGTH) * 2);
      
      const decipher = crypto.createDecipher(this.ALGORITHM, key);
      decipher.setAAD(Buffer.from('sso-config', 'utf8'));
      decipher.setAuthTag(tag);
      
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
  
  /**
   * Rotate encryption key (for key rotation scenarios)
   */
  static rotateEncryptionKey(oldKey: string, newKey: string, encryptedData: string): string {
    // Temporarily set old key
    const originalKey = this.encryptionKey;
    this.encryptionKey = crypto.scryptSync(oldKey, 'sso-salt', this.KEY_LENGTH);
    
    try {
      // Decrypt with old key
      const plaintext = this.decrypt(encryptedData);
      
      // Set new key
      this.encryptionKey = crypto.scryptSync(newKey, 'sso-salt', this.KEY_LENGTH);
      
      // Encrypt with new key
      const reencrypted = this.encrypt(plaintext);
      
      logger.info('Successfully rotated encryption key for SSO data');
      
      return reencrypted;
    } finally {
      // Restore original key
      this.encryptionKey = originalKey;
    }
  }
}