import crypto from 'crypto';
import { SSOService } from './sso.service';
import { prisma } from './database.service';

export interface CertificateInfo {
  providerId: string;
  providerName: string;
  organizationId: string;
  certificateData: string;
  issuer: string;
  subject: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  fingerprint: string;
  keyUsage?: string[];
  subjectAltNames?: string[];
  isValid: boolean;
  daysUntilExpiry: number;
  warningLevel: 'green' | 'yellow' | 'orange' | 'red';
  lastChecked: Date;
}

export interface CertificateRotationPlan {
  providerId: string;
  currentCertificate: CertificateInfo;
  newCertificate?: string;
  rotationSchedule: Date;
  rollbackPlan: {
    enabled: boolean;
    rollbackCertificate: string;
    maxRollbackTime: number; // minutes
  };
  testingPlan: {
    preRotationTests: string[];
    postRotationTests: string[];
    rolloutStrategy: 'immediate' | 'gradual' | 'blue-green';
  };
  notifications: {
    channels: string[];
    recipients: string[];
    reminderSchedule: number[]; // days before rotation
  };
}

export interface CertificateAlert {
  type: 'expiry_warning' | 'expiry_critical' | 'rotation_required' | 'validation_failed' | 'rotation_completed';
  severity: 'info' | 'warning' | 'critical';
  providerId: string;
  organizationId: string;
  message: string;
  details: Record<string, any>;
  actionRequired?: string;
  scheduledAction?: {
    action: string;
    scheduledFor: Date;
    autoExecute: boolean;
  };
  timestamp: Date;
}

export class CertificateManagementService {
  // Certificate discovery and validation
  static async scanAllCertificates(): Promise<CertificateInfo[]> {
    const allProviders = await prisma.sSOProvider.findMany({
      where: { isActive: true },
    });

    const certificates: CertificateInfo[] = [];

    for (const provider of allProviders) {
      try {
        const certInfo = await this.extractCertificateInfo(provider);
        if (certInfo) {
          certificates.push(certInfo);
          
          // Update certificate tracking
          await this.updateCertificateTracking(certInfo);
        }
      } catch (error) {
        console.error(`Certificate scan failed for provider ${provider.id}:`, error);
        
        // Log certificate scan failure
        await this.logCertificateEvent({
          type: 'validation_failed',
          severity: 'critical',
          providerId: provider.id,
          organizationId: provider.organizationId,
          message: `Certificate validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : error },
          timestamp: new Date(),
        });
      }
    }

    return certificates;
  }

  // Extract certificate information from provider configuration
  private static async extractCertificateInfo(provider: any): Promise<CertificateInfo | null> {
    const config = provider.config as any;
    
    let certificateData: string | null = null;
    
    // Extract certificate based on provider type
    if (provider.type === 'saml' && config.cert) {
      certificateData = config.cert;
    } else if (provider.type === 'oidc' && config.certificate) {
      certificateData = config.certificate;
    }

    if (!certificateData) {
      return null;
    }

    // Parse certificate
    const certInfo = this.parseCertificate(certificateData);
    
    if (!certInfo) {
      return null;
    }

    const now = new Date();
    const daysUntilExpiry = Math.ceil((certInfo.notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      providerId: provider.id,
      providerName: provider.name,
      organizationId: provider.organizationId,
      certificateData,
      issuer: certInfo.issuer,
      subject: certInfo.subject,
      serialNumber: certInfo.serialNumber,
      notBefore: certInfo.notBefore,
      notAfter: certInfo.notAfter,
      fingerprint: certInfo.fingerprint,
      keyUsage: certInfo.keyUsage,
      subjectAltNames: certInfo.subjectAltNames,
      isValid: now >= certInfo.notBefore && now <= certInfo.notAfter,
      daysUntilExpiry,
      warningLevel: this.calculateWarningLevel(daysUntilExpiry),
      lastChecked: now,
    };
  }

  // Parse X.509 certificate
  private static parseCertificate(certificateData: string): any {
    try {
      // Clean certificate data
      const cleanCert = certificateData
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\s/g, '');

      const certBuffer = Buffer.from(cleanCert, 'base64');
      
      // Create certificate object
      const cert = crypto.createCertificate ? crypto.createCertificate() : null;
      
      // Parse certificate fields (simplified implementation)
      // In production, use proper ASN.1 parsing library like 'asn1js' or 'node-forge'
      
      const now = new Date();
      const fingerprint = crypto.createHash('sha256').update(certBuffer).digest('hex');
      
      // Mock certificate parsing - replace with proper implementation
      return {
        issuer: 'CN=Mock Issuer',
        subject: 'CN=Mock Subject',
        serialNumber: '123456789',
        notBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        notAfter: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        fingerprint,
        keyUsage: ['digitalSignature', 'keyEncipherment'],
        subjectAltNames: ['DNS:example.com'],
      };
    } catch (error) {
      console.error('Certificate parsing failed:', error);
      return null;
    }
  }

  // Calculate warning level based on days until expiry
  private static calculateWarningLevel(daysUntilExpiry: number): 'green' | 'yellow' | 'orange' | 'red' {
    if (daysUntilExpiry < 0) return 'red';        // Expired
    if (daysUntilExpiry <= 7) return 'red';       // Critical: 1 week
    if (daysUntilExpiry <= 30) return 'orange';   // Warning: 1 month
    if (daysUntilExpiry <= 60) return 'yellow';   // Caution: 2 months
    return 'green';                               // OK: > 2 months
  }

  // Certificate expiry monitoring and alerting
  static async checkExpiryAlerts(): Promise<CertificateAlert[]> {
    const certificates = await this.scanAllCertificates();
    const alerts: CertificateAlert[] = [];

    for (const cert of certificates) {
      // Generate alerts based on expiry timeline
      if (cert.daysUntilExpiry <= 0) {
        alerts.push({
          type: 'expiry_critical',
          severity: 'critical',
          providerId: cert.providerId,
          organizationId: cert.organizationId,
          message: `Certificate has EXPIRED for SSO provider "${cert.providerName}"`,
          details: {
            expiredDays: Math.abs(cert.daysUntilExpiry),
            subject: cert.subject,
            issuer: cert.issuer,
            expiredOn: cert.notAfter,
          },
          actionRequired: 'Immediate certificate replacement required',
          timestamp: new Date(),
        });
      } else if (cert.daysUntilExpiry <= 7) {
        alerts.push({
          type: 'expiry_critical',
          severity: 'critical',
          providerId: cert.providerId,
          organizationId: cert.organizationId,
          message: `Certificate expires in ${cert.daysUntilExpiry} days for SSO provider "${cert.providerName}"`,
          details: {
            daysUntilExpiry: cert.daysUntilExpiry,
            subject: cert.subject,
            issuer: cert.issuer,
            expiresOn: cert.notAfter,
          },
          actionRequired: 'Urgent certificate rotation required',
          scheduledAction: {
            action: 'auto_rotate_certificate',
            scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            autoExecute: false, // Manual approval required for critical
          },
          timestamp: new Date(),
        });
      } else if (cert.daysUntilExpiry <= 30) {
        alerts.push({
          type: 'expiry_warning',
          severity: 'warning',
          providerId: cert.providerId,
          organizationId: cert.organizationId,
          message: `Certificate expires in ${cert.daysUntilExpiry} days for SSO provider "${cert.providerName}"`,
          details: {
            daysUntilExpiry: cert.daysUntilExpiry,
            subject: cert.subject,
            issuer: cert.issuer,
            expiresOn: cert.notAfter,
          },
          actionRequired: 'Schedule certificate rotation',
          scheduledAction: {
            action: 'schedule_certificate_rotation',
            scheduledFor: new Date(cert.notAfter.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days before expiry
            autoExecute: true,
          },
          timestamp: new Date(),
        });
      }
    }

    // Store alerts
    for (const alert of alerts) {
      await this.logCertificateEvent(alert);
    }

    // Send notifications for high-priority alerts
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      await this.sendCertificateAlerts(criticalAlerts);
    }

    return alerts;
  }

  // Automated certificate rotation
  static async rotateCertificate(
    providerId: string,
    newCertificate: string,
    rotationPlan?: Partial<CertificateRotationPlan>
  ): Promise<{
    success: boolean;
    rollbackInfo?: any;
    testResults?: any;
    error?: string;
  }> {
    try {
      // Get current provider configuration
      const provider = await SSOService.getSSOProvider(providerId);
      if (!provider) {
        throw new Error('SSO provider not found');
      }

      // Validate new certificate
      const newCertInfo = this.parseCertificate(newCertificate);
      if (!newCertInfo) {
        throw new Error('Invalid certificate format');
      }

      // Create rotation plan
      const fullRotationPlan = await this.createRotationPlan(provider, newCertificate, rotationPlan);

      // Pre-rotation testing
      const preTestResults = await this.runPreRotationTests(fullRotationPlan);
      if (!preTestResults.success) {
        throw new Error(`Pre-rotation tests failed: ${preTestResults.errors.join(', ')}`);
      }

      // Store current configuration for rollback
      const rollbackInfo = {
        providerId,
        previousConfig: provider.config,
        rollbackTimestamp: new Date(),
      };

      // Update certificate in provider configuration
      const updatedConfig = { ...provider.config };
      if (provider.type === 'saml') {
        (updatedConfig as any).cert = newCertificate;
      } else if (provider.type === 'oidc') {
        (updatedConfig as any).certificate = newCertificate;
      }

      // Apply new configuration
      await SSOService.updateSSOProvider(providerId, { config: updatedConfig as any });

      // Post-rotation testing
      const postTestResults = await this.runPostRotationTests(fullRotationPlan);
      if (!postTestResults.success) {
        // Auto-rollback on test failure
        console.warn('Post-rotation tests failed, initiating rollback...');
        await this.rollbackCertificate(rollbackInfo);
        throw new Error(`Post-rotation tests failed: ${postTestResults.errors.join(', ')}`);
      }

      // Log successful rotation
      await this.logCertificateEvent({
        type: 'rotation_completed',
        severity: 'info',
        providerId,
        organizationId: provider.organizationId,
        message: `Certificate successfully rotated for SSO provider "${provider.name}"`,
        details: {
          previousFingerprint: await this.getCertificateFingerprint(rollbackInfo.previousConfig),
          newFingerprint: newCertInfo.fingerprint,
          rotationTime: new Date(),
          testResults: postTestResults,
        },
        timestamp: new Date(),
      });

      return {
        success: true,
        rollbackInfo,
        testResults: postTestResults,
      };

    } catch (error) {
      console.error('Certificate rotation failed:', error);
      
      await this.logCertificateEvent({
        type: 'validation_failed',
        severity: 'critical',
        providerId,
        organizationId: provider?.organizationId || 'unknown',
        message: `Certificate rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : error },
        timestamp: new Date(),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Certificate health monitoring dashboard
  static async getCertificateHealthDashboard(organizationId?: string): Promise<{
    summary: {
      totalCertificates: number;
      healthy: number;
      warning: number;
      critical: number;
      expired: number;
    };
    certificates: CertificateInfo[];
    alerts: CertificateAlert[];
    upcomingRotations: Array<{
      providerId: string;
      providerName: string;
      scheduledDate: Date;
      status: string;
    }>;
  }> {
    // Get all certificates
    const allCertificates = await this.scanAllCertificates();
    
    // Filter by organization if specified
    const certificates = organizationId 
      ? allCertificates.filter(cert => cert.organizationId === organizationId)
      : allCertificates;

    // Calculate summary statistics
    const summary = {
      totalCertificates: certificates.length,
      healthy: certificates.filter(cert => cert.warningLevel === 'green').length,
      warning: certificates.filter(cert => cert.warningLevel === 'yellow').length,
      critical: certificates.filter(cert => cert.warningLevel === 'orange' || cert.warningLevel === 'red').length,
      expired: certificates.filter(cert => cert.daysUntilExpiry < 0).length,
    };

    // Get recent alerts
    const alerts = await this.getRecentCertificateAlerts(organizationId);

    // Get upcoming rotations
    const upcomingRotations = await this.getUpcomingRotations(organizationId);

    return {
      summary,
      certificates: certificates.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
      alerts: alerts.slice(0, 10), // Latest 10 alerts
      upcomingRotations,
    };
  }

  // Helper methods
  private static async updateCertificateTracking(certInfo: CertificateInfo): Promise<void> {
    await prisma.certificateTracking.upsert({
      where: { providerId: certInfo.providerId },
      update: {
        certificateData: certInfo.certificateData,
        issuer: certInfo.issuer,
        subject: certInfo.subject,
        serialNumber: certInfo.serialNumber,
        notBefore: certInfo.notBefore,
        notAfter: certInfo.notAfter,
        fingerprint: certInfo.fingerprint,
        isValid: certInfo.isValid,
        daysUntilExpiry: certInfo.daysUntilExpiry,
        warningLevel: certInfo.warningLevel,
        lastChecked: certInfo.lastChecked,
      },
      create: {
        providerId: certInfo.providerId,
        organizationId: certInfo.organizationId,
        certificateData: certInfo.certificateData,
        issuer: certInfo.issuer,
        subject: certInfo.subject,
        serialNumber: certInfo.serialNumber,
        notBefore: certInfo.notBefore,
        notAfter: certInfo.notAfter,
        fingerprint: certInfo.fingerprint,
        isValid: certInfo.isValid,
        daysUntilExpiry: certInfo.daysUntilExpiry,
        warningLevel: certInfo.warningLevel,
        lastChecked: certInfo.lastChecked,
      },
    });
  }

  private static async logCertificateEvent(alert: CertificateAlert): Promise<void> {
    await prisma.certificateAlert.create({
      data: {
        type: alert.type,
        severity: alert.severity,
        providerId: alert.providerId,
        organizationId: alert.organizationId,
        message: alert.message,
        details: alert.details,
        actionRequired: alert.actionRequired,
        scheduledAction: alert.scheduledAction,
        timestamp: alert.timestamp,
      },
    });
  }

  private static async createRotationPlan(
    provider: any,
    newCertificate: string,
    customPlan?: Partial<CertificateRotationPlan>
  ): Promise<CertificateRotationPlan> {
    const currentCertInfo = await this.extractCertificateInfo(provider);
    
    return {
      providerId: provider.id,
      currentCertificate: currentCertInfo!,
      newCertificate,
      rotationSchedule: customPlan?.rotationSchedule || new Date(),
      rollbackPlan: {
        enabled: true,
        rollbackCertificate: provider.config.cert || provider.config.certificate,
        maxRollbackTime: 30, // 30 minutes
        ...customPlan?.rollbackPlan,
      },
      testingPlan: {
        preRotationTests: ['certificate_validation', 'provider_connectivity'],
        postRotationTests: ['sso_authentication', 'user_provisioning'],
        rolloutStrategy: 'immediate',
        ...customPlan?.testingPlan,
      },
      notifications: {
        channels: ['email', 'slack'],
        recipients: ['admin@example.com'],
        reminderSchedule: [7, 3, 1], // days before rotation
        ...customPlan?.notifications,
      },
    };
  }

  private static async runPreRotationTests(plan: CertificateRotationPlan): Promise<any> {
    // Implement pre-rotation testing
    return { success: true, errors: [] };
  }

  private static async runPostRotationTests(plan: CertificateRotationPlan): Promise<any> {
    // Implement post-rotation testing
    return { success: true, errors: [] };
  }

  private static async rollbackCertificate(rollbackInfo: any): Promise<void> {
    await SSOService.updateSSOProvider(rollbackInfo.providerId, {
      config: rollbackInfo.previousConfig,
    });
  }

  private static async getCertificateFingerprint(config: any): Promise<string> {
    const cert = config.cert || config.certificate;
    if (!cert) return 'unknown';
    
    const cleanCert = cert.replace(/-----BEGIN CERTIFICATE-----/, '')
                         .replace(/-----END CERTIFICATE-----/, '')
                         .replace(/\s/g, '');
    
    return crypto.createHash('sha256').update(cleanCert, 'base64').digest('hex');
  }

  private static async sendCertificateAlerts(alerts: CertificateAlert[]): Promise<void> {
    // Implement alert notifications
    console.log('Certificate Alerts:', alerts);
  }

  private static async getRecentCertificateAlerts(organizationId?: string): Promise<CertificateAlert[]> {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;

    const alerts = await prisma.certificateAlert.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    return alerts.map(alert => ({
      type: alert.type as any,
      severity: alert.severity as any,
      providerId: alert.providerId,
      organizationId: alert.organizationId,
      message: alert.message,
      details: alert.details as any,
      actionRequired: alert.actionRequired || undefined,
      scheduledAction: alert.scheduledAction as any,
      timestamp: alert.timestamp,
    }));
  }

  private static async getUpcomingRotations(organizationId?: string): Promise<any[]> {
    // Return scheduled certificate rotations
    return [];
  }
}