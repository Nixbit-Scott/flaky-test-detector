import { UserService } from './user.service';
import { SSOService } from './sso.service';
import { SSOAuditService } from './sso-audit.service';
import { prisma } from './database.service';
import crypto from 'crypto';

export interface FallbackAuthMethod {
  type: 'emergency_codes' | 'backup_password' | 'admin_override' | 'recovery_email';
  enabled: boolean;
  organizationId: string;
  configuration: Record<string, any>;
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
}

export interface EmergencyCode {
  id: string;
  organizationId: string;
  code: string;
  hashedCode: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  usedBy?: string;
  purpose: string;
  restrictions?: {
    ipAddresses?: string[];
    maxUses?: number;
    timeWindow?: number; // minutes
  };
}

export interface FallbackAuthResult {
  success: boolean;
  user?: any;
  method: string;
  restrictions?: string[];
  expiresAt?: Date;
  requiresFollowUp?: {
    action: string;
    deadline: Date;
    description: string;
  };
}

export interface SSOCircuitBreaker {
  organizationId: string;
  providerId: string;
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure?: Date;
  nextRetry?: Date;
  threshold: number;
  timeout: number; // milliseconds
  halfOpenMaxCalls: number;
  statistics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
  };
}

export class SSOFallbackService {
  // Emergency authentication codes
  static async generateEmergencyCodes(
    organizationId: string,
    createdBy: string,
    count: number = 10,
    purpose: string = 'SSO provider failure'
  ): Promise<EmergencyCode[]> {
    const codes: EmergencyCode[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = this.generateSecureCode();
      const hashedCode = await this.hashCode(code);
      
      const emergencyCode: EmergencyCode = {
        id: crypto.randomUUID(),
        organizationId,
        code, // Will be returned once, then removed for security
        hashedCode,
        createdBy,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        used: false,
        purpose,
        restrictions: {
          maxUses: 1,
          timeWindow: 60, // 1 hour window
        },
      };
      
      codes.push(emergencyCode);
      
      // Store in database (without plaintext code)
      await prisma.emergencyAuthCode.create({
        data: {
          id: emergencyCode.id,
          organizationId: emergencyCode.organizationId,
          hashedCode: emergencyCode.hashedCode,
          createdBy: emergencyCode.createdBy,
          createdAt: emergencyCode.createdAt,
          expiresAt: emergencyCode.expiresAt,
          used: false,
          purpose: emergencyCode.purpose,
          restrictions: emergencyCode.restrictions as any,
        },
      });
    }
    
    // Log emergency code generation
    await SSOAuditService.logSSOEvent({
      organizationId,
      email: 'system',
      provider: 'fallback',
      action: 'provision',
      details: {
        emergencyCodesGenerated: count,
        createdBy,
        purpose,
        expirationDays: 7,
      },
      severity: 'warn',
      category: 'security',
      timestamp: new Date(),
    });
    
    return codes;
  }

  // Validate emergency authentication code
  static async validateEmergencyCode(
    organizationId: string,
    code: string,
    userEmail: string,
    ipAddress?: string
  ): Promise<FallbackAuthResult> {
    try {
      // Find matching emergency code
      const emergencyCodes = await prisma.emergencyAuthCode.findMany({
        where: {
          organizationId,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      let validCode: any = null;
      for (const storedCode of emergencyCodes) {
        if (await this.verifyCode(code, storedCode.hashedCode)) {
          validCode = storedCode;
          break;
        }
      }

      if (!validCode) {
        await SSOAuditService.logSSOEvent({
          organizationId,
          email: userEmail,
          provider: 'fallback',
          action: 'denied',
          details: {
            reason: 'Invalid emergency code',
            attemptedCode: code.substring(0, 4) + '***',
          },
          ipAddress,
          severity: 'warn',
          category: 'security',
          timestamp: new Date(),
        });

        return {
          success: false,
          method: 'emergency_code',
          restrictions: ['Invalid or expired emergency code'],
        };
      }

      // Check IP restrictions
      if (validCode.restrictions?.ipAddresses && ipAddress) {
        if (!validCode.restrictions.ipAddresses.includes(ipAddress)) {
          return {
            success: false,
            method: 'emergency_code',
            restrictions: ['IP address not authorized for this emergency code'],
          };
        }
      }

      // Find user
      const user = await UserService.getUserByEmail(userEmail);
      if (!user) {
        return {
          success: false,
          method: 'emergency_code',
          restrictions: ['User not found'],
        };
      }

      // Mark code as used
      await prisma.emergencyAuthCode.update({
        where: { id: validCode.id },
        data: {
          used: true,
          usedAt: new Date(),
          usedBy: user.id,
        },
      });

      // Log successful emergency authentication
      await SSOAuditService.logSSOEvent({
        userId: user.id,
        organizationId,
        email: userEmail,
        provider: 'fallback',
        action: 'login',
        details: {
          method: 'emergency_code',
          codeId: validCode.id,
          purpose: validCode.purpose,
        },
        ipAddress,
        severity: 'warn',
        category: 'authentication',
        timestamp: new Date(),
      });

      return {
        success: true,
        user,
        method: 'emergency_code',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour session
        requiresFollowUp: {
          action: 'restore_sso_access',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          description: 'Emergency access expires in 24 hours. Please restore SSO provider connectivity.',
        },
      };

    } catch (error) {
      console.error('Emergency code validation failed:', error);
      
      await SSOAuditService.logSSOEvent({
        organizationId,
        email: userEmail,
        provider: 'fallback',
        action: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          method: 'emergency_code',
        },
        ipAddress,
        severity: 'error',
        category: 'authentication',
        timestamp: new Date(),
      });

      return {
        success: false,
        method: 'emergency_code',
        restrictions: ['System error during validation'],
      };
    }
  }

  // Backup password authentication
  static async createBackupPassword(
    organizationId: string,
    userId: string,
    password: string
  ): Promise<{ success: boolean; expiresAt: Date }> {
    const hashedPassword = await this.hashPassword(password);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.backupAuthMethod.upsert({
      where: {
        userId_organizationId_type: {
          userId,
          organizationId,
          type: 'backup_password',
        },
      },
      update: {
        configuration: { hashedPassword },
        createdAt: new Date(),
        lastUsed: null,
        useCount: 0,
      },
      create: {
        userId,
        organizationId,
        type: 'backup_password',
        enabled: true,
        configuration: { hashedPassword, expiresAt },
        createdAt: new Date(),
        useCount: 0,
      },
    });

    return { success: true, expiresAt };
  }

  // Admin override authentication
  static async adminOverrideAuth(
    adminUserId: string,
    targetUserEmail: string,
    organizationId: string,
    reason: string,
    ipAddress?: string
  ): Promise<FallbackAuthResult> {
    try {
      // Verify admin has override permissions
      const adminUser = await UserService.getUserWithAdminStatus(adminUserId);
      if (!adminUser?.isSystemAdmin) {
        return {
          success: false,
          method: 'admin_override',
          restrictions: ['Insufficient permissions for admin override'],
        };
      }

      // Find target user
      const targetUser = await UserService.getUserByEmail(targetUserEmail);
      if (!targetUser) {
        return {
          success: false,
          method: 'admin_override',
          restrictions: ['Target user not found'],
        };
      }

      // Log admin override
      await SSOAuditService.logSSOEvent({
        userId: targetUser.id,
        organizationId,
        email: targetUserEmail,
        provider: 'fallback',
        action: 'login',
        details: {
          method: 'admin_override',
          adminUserId,
          adminEmail: adminUser.email,
          reason,
          overrideTimestamp: new Date(),
        },
        ipAddress,
        severity: 'critical',
        category: 'authentication',
        timestamp: new Date(),
      });

      return {
        success: true,
        user: targetUser,
        method: 'admin_override',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        requiresFollowUp: {
          action: 'review_access',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          description: 'Admin override access requires security review within 24 hours.',
        },
      };

    } catch (error) {
      console.error('Admin override failed:', error);
      return {
        success: false,
        method: 'admin_override',
        restrictions: ['System error during admin override'],
      };
    }
  }

  // Circuit breaker for SSO providers
  static async checkSSOCircuitBreaker(
    organizationId: string,
    providerId: string
  ): Promise<{ allowRequest: boolean; circuitBreakerStatus: string }> {
    const circuitBreaker = await this.getCircuitBreaker(organizationId, providerId);

    switch (circuitBreaker.status) {
      case 'closed':
        return { allowRequest: true, circuitBreakerStatus: 'closed' };

      case 'open':
        if (Date.now() > (circuitBreaker.nextRetry?.getTime() || 0)) {
          // Move to half-open state
          await this.updateCircuitBreaker(organizationId, providerId, {
            status: 'half-open',
          });
          return { allowRequest: true, circuitBreakerStatus: 'half-open' };
        }
        return { allowRequest: false, circuitBreakerStatus: 'open' };

      case 'half-open':
        return { allowRequest: true, circuitBreakerStatus: 'half-open' };

      default:
        return { allowRequest: true, circuitBreakerStatus: 'unknown' };
    }
  }

  static async recordSSOResult(
    organizationId: string,
    providerId: string,
    success: boolean,
    responseTime: number
  ): Promise<void> {
    const circuitBreaker = await this.getCircuitBreaker(organizationId, providerId);

    // Update statistics
    circuitBreaker.statistics.totalCalls++;
    circuitBreaker.statistics.averageResponseTime = 
      (circuitBreaker.statistics.averageResponseTime * (circuitBreaker.statistics.totalCalls - 1) + responseTime) 
      / circuitBreaker.statistics.totalCalls;

    if (success) {
      circuitBreaker.statistics.successfulCalls++;
      circuitBreaker.failureCount = 0;

      // If in half-open state and success, close the circuit
      if (circuitBreaker.status === 'half-open') {
        circuitBreaker.status = 'closed';
      }
    } else {
      circuitBreaker.statistics.failedCalls++;
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailure = new Date();

      // Check if we should open the circuit
      if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
        circuitBreaker.status = 'open';
        circuitBreaker.nextRetry = new Date(Date.now() + circuitBreaker.timeout);
        
        // Log circuit breaker activation
        await SSOAuditService.logSSOEvent({
          organizationId,
          email: 'system',
          provider: 'circuit_breaker',
          action: 'error',
          details: {
            providerId,
            failureCount: circuitBreaker.failureCount,
            threshold: circuitBreaker.threshold,
            nextRetry: circuitBreaker.nextRetry,
          },
          severity: 'critical',
          category: 'performance',
          timestamp: new Date(),
        });
      }
    }

    await this.saveCircuitBreaker(circuitBreaker);
  }

  // Fallback authentication strategy selection
  static async selectFallbackStrategy(
    organizationId: string,
    userEmail: string
  ): Promise<{
    availableMethods: string[];
    recommendedMethod: string;
    restrictions: Record<string, string[]>;
  }> {
    const [emergencyCodes, backupMethods, adminOverride] = await Promise.all([
      this.getAvailableEmergencyCodes(organizationId),
      this.getBackupMethods(organizationId, userEmail),
      this.checkAdminOverrideAvailable(organizationId),
    ]);

    const availableMethods: string[] = [];
    const restrictions: Record<string, string[]> = {};

    if (emergencyCodes.length > 0) {
      availableMethods.push('emergency_codes');
      restrictions.emergency_codes = [`${emergencyCodes.length} codes available`];
    }

    if (backupMethods.length > 0) {
      availableMethods.push('backup_password');
      restrictions.backup_password = backupMethods.map(m => `${m.type} available`);
    }

    if (adminOverride) {
      availableMethods.push('admin_override');
      restrictions.admin_override = ['Requires system administrator approval'];
    }

    // Recommend best available method
    let recommendedMethod = 'none';
    if (availableMethods.includes('emergency_codes')) {
      recommendedMethod = 'emergency_codes';
    } else if (availableMethods.includes('backup_password')) {
      recommendedMethod = 'backup_password';
    } else if (availableMethods.includes('admin_override')) {
      recommendedMethod = 'admin_override';
    }

    return {
      availableMethods,
      recommendedMethod,
      restrictions,
    };
  }

  // Helper methods
  private static generateSecureCode(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Add hyphens for readability
    return result.match(/.{1,4}/g)?.join('-') || result;
  }

  private static async hashCode(code: string): Promise<string> {
    const bcrypt = require('bcryptjs');
    return bcrypt.hash(code, 12);
  }

  private static async verifyCode(code: string, hashedCode: string): Promise<boolean> {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(code, hashedCode);
  }

  private static async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcryptjs');
    return bcrypt.hash(password, 12);
  }

  private static async getCircuitBreaker(
    organizationId: string,
    providerId: string
  ): Promise<SSOCircuitBreaker> {
    const existing = await prisma.sSOCircuitBreaker.findUnique({
      where: {
        organizationId_providerId: {
          organizationId,
          providerId,
        },
      },
    });

    if (existing) {
      return {
        organizationId: existing.organizationId,
        providerId: existing.providerId,
        status: existing.status as any,
        failureCount: existing.failureCount,
        lastFailure: existing.lastFailure || undefined,
        nextRetry: existing.nextRetry || undefined,
        threshold: existing.threshold,
        timeout: existing.timeout,
        halfOpenMaxCalls: existing.halfOpenMaxCalls,
        statistics: existing.statistics as any,
      };
    }

    // Create default circuit breaker
    return {
      organizationId,
      providerId,
      status: 'closed',
      failureCount: 0,
      threshold: 5, // Open after 5 failures
      timeout: 60000, // 1 minute timeout
      halfOpenMaxCalls: 3,
      statistics: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0,
      },
    };
  }

  private static async updateCircuitBreaker(
    organizationId: string,
    providerId: string,
    updates: Partial<SSOCircuitBreaker>
  ): Promise<void> {
    await prisma.sSOCircuitBreaker.upsert({
      where: {
        organizationId_providerId: {
          organizationId,
          providerId,
        },
      },
      update: updates as any,
      create: {
        organizationId,
        providerId,
        status: 'closed',
        failureCount: 0,
        threshold: 5,
        timeout: 60000,
        halfOpenMaxCalls: 3,
        statistics: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          averageResponseTime: 0,
        },
        ...updates,
      } as any,
    });
  }

  private static async saveCircuitBreaker(circuitBreaker: SSOCircuitBreaker): Promise<void> {
    await prisma.sSOCircuitBreaker.upsert({
      where: {
        organizationId_providerId: {
          organizationId: circuitBreaker.organizationId,
          providerId: circuitBreaker.providerId,
        },
      },
      update: {
        status: circuitBreaker.status,
        failureCount: circuitBreaker.failureCount,
        lastFailure: circuitBreaker.lastFailure,
        nextRetry: circuitBreaker.nextRetry,
        statistics: circuitBreaker.statistics,
      },
      create: {
        organizationId: circuitBreaker.organizationId,
        providerId: circuitBreaker.providerId,
        status: circuitBreaker.status,
        failureCount: circuitBreaker.failureCount,
        lastFailure: circuitBreaker.lastFailure,
        nextRetry: circuitBreaker.nextRetry,
        threshold: circuitBreaker.threshold,
        timeout: circuitBreaker.timeout,
        halfOpenMaxCalls: circuitBreaker.halfOpenMaxCalls,
        statistics: circuitBreaker.statistics,
      },
    });
  }

  private static async getAvailableEmergencyCodes(organizationId: string): Promise<any[]> {
    return prisma.emergencyAuthCode.findMany({
      where: {
        organizationId,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  private static async getBackupMethods(organizationId: string, userEmail: string): Promise<any[]> {
    const user = await UserService.getUserByEmail(userEmail);
    if (!user) return [];

    return prisma.backupAuthMethod.findMany({
      where: {
        userId: user.id,
        organizationId,
        enabled: true,
      },
    });
  }

  private static async checkAdminOverrideAvailable(organizationId: string): Promise<boolean> {
    // Check if there are any system administrators available
    const adminCount = await prisma.user.count({
      where: {
        isSystemAdmin: true,
        organizations: {
          some: { organizationId },
        },
      },
    });

    return adminCount > 0;
  }
}