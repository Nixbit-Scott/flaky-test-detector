import { prisma } from './database.service';
import crypto from 'crypto';

export interface ApiKeyData {
  id: string;
  name: string;
  key: string;
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
  permissions: string[];
  isActive: boolean;
}

export interface CreateApiKeyRequest {
  name: string;
  expiresAt?: Date;
  permissions?: string[];
}

export class ApiKeyService {
  /**
   * Generate a new API key for a user
   */
  static async createApiKey(userId: string, request: CreateApiKeyRequest): Promise<{ apiKey: ApiKeyData; plainKey: string }> {
    // Generate secure API key
    const plainKey = this.generateSecureKey();
    const hashedKey = this.hashKey(plainKey);

    // Create API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        name: request.name,
        key: hashedKey,
        userId,
        expiresAt: request.expiresAt,
      },
    });

    const apiKeyData: ApiKeyData = {
      id: apiKey.id,
      name: apiKey.name,
      key: this.maskKey(plainKey),
      lastUsed: apiKey.lastUsed?.toISOString(),
      createdAt: apiKey.createdAt.toISOString(),
      expiresAt: apiKey.expiresAt?.toISOString(),
      permissions: request.permissions || ['read:projects', 'write:test-results'],
      isActive: true,
    };

    return {
      apiKey: apiKeyData,
      plainKey, // Return plain key only once
    };
  }

  /**
   * Get all API keys for a user
   */
  static async getUserApiKeys(userId: string): Promise<ApiKeyData[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      key: this.maskKey(key.key),
      lastUsed: key.lastUsed?.toISOString(),
      createdAt: key.createdAt.toISOString(),
      expiresAt: key.expiresAt?.toISOString(),
      permissions: ['read:projects', 'write:test-results'], // Default permissions
      isActive: this.isKeyActive(key),
    }));
  }

  /**
   * Validate an API key and return user info
   */
  static async validateApiKey(keyString: string): Promise<{ user: any; keyId: string } | null> {
    if (!keyString.startsWith('ftd_')) {
      return null;
    }

    const hashedKey = this.hashKey(keyString);

    const apiKey = await prisma.apiKey.findUnique({
      where: { key: hashedKey },
      include: { user: true },
    });

    if (!apiKey || !this.isKeyActive(apiKey)) {
      return null;
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return {
      user: apiKey.user,
      keyId: apiKey.id,
    };
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId,
      },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    });
  }

  /**
   * Update API key name
   */
  static async updateApiKey(userId: string, keyId: string, updates: { name?: string }): Promise<ApiKeyData> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId,
      },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    const updatedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        name: updates.name,
      },
    });

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      key: this.maskKey(updatedKey.key),
      lastUsed: updatedKey.lastUsed?.toISOString(),
      createdAt: updatedKey.createdAt.toISOString(),
      expiresAt: updatedKey.expiresAt?.toISOString(),
      permissions: ['read:projects', 'write:test-results'],
      isActive: this.isKeyActive(updatedKey),
    };
  }

  /**
   * Get API key usage statistics
   */
  static async getApiKeyStats(userId: string, days = 30): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    totalRequests: number;
    requestsByKey: Array<{
      keyId: string;
      keyName: string;
      requests: number;
      lastUsed?: string;
    }>;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
    });

    const totalKeys = apiKeys.length;
    const activeKeys = apiKeys.filter(key => this.isKeyActive(key)).length;
    const expiredKeys = apiKeys.filter(key => key.expiresAt && key.expiresAt < new Date()).length;

    // In a real implementation, you'd track API requests in a separate table
    // For now, we'll generate mock statistics
    const requestsByKey = apiKeys.map(key => ({
      keyId: key.id,
      keyName: key.name,
      requests: key.lastUsed ? Math.floor(Math.random() * 1000) + 10 : 0,
      lastUsed: key.lastUsed?.toISOString(),
    }));

    const totalRequests = requestsByKey.reduce((sum, key) => sum + key.requests, 0);

    return {
      totalKeys,
      activeKeys,
      expiredKeys,
      totalRequests,
      requestsByKey,
    };
  }

  /**
   * Generate a secure API key
   */
  private static generateSecureKey(): string {
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64url'); // URL-safe base64
    return `ftd_${key}`;
  }

  /**
   * Hash an API key for storage
   */
  private static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Mask an API key for display
   */
  private static maskKey(key: string): string {
    if (key.length < 12) return key;
    
    if (key.startsWith('ftd_')) {
      const visiblePart = key.substring(0, 8); // 'ftd_' + 4 chars
      const maskedPart = '*'.repeat(Math.max(0, key.length - 12));
      const endPart = key.substring(key.length - 4);
      return `${visiblePart}${maskedPart}${endPart}`;
    }
    
    return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
  }

  /**
   * Check if an API key is active
   */
  private static isKeyActive(apiKey: any): boolean {
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return false;
    }
    return true;
  }

  /**
   * Get API key permissions (for future use)
   */
  static getAvailablePermissions(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'read:projects',
        name: 'Read Projects',
        description: 'View project information and settings'
      },
      {
        id: 'write:projects',
        name: 'Write Projects',
        description: 'Create and modify projects'
      },
      {
        id: 'read:test-results',
        name: 'Read Test Results',
        description: 'View test runs and results'
      },
      {
        id: 'write:test-results',
        name: 'Submit Test Results',
        description: 'Submit test results via API'
      },
      {
        id: 'read:analytics',
        name: 'Read Analytics',
        description: 'View analytics and reports'
      },
      {
        id: 'manage:flaky-tests',
        name: 'Manage Flaky Tests',
        description: 'Run analysis and manage flaky test detection'
      },
      {
        id: 'manage:retry-logic',
        name: 'Manage Retry Logic',
        description: 'Configure retry settings and view retry statistics'
      },
    ];
  }
}