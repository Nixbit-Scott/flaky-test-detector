import { prisma } from './database.service';

export interface SSOAuditEventDetailed {
  userId?: string;
  organizationId?: string;
  email: string;
  provider: string;
  action: 'login' | 'provision' | 'update' | 'denied' | 'error' | 'logout' | 'token_refresh' | 'permission_change' | 'config_change';
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  category: 'authentication' | 'authorization' | 'user_management' | 'configuration' | 'security' | 'performance';
  timestamp: Date;
  metadata?: {
    geolocation?: {
      country?: string;
      region?: string;
      city?: string;
    };
    device?: {
      type?: string;
      os?: string;
      browser?: string;
    };
    security?: {
      riskScore?: number;
      threatIndicators?: string[];
      anomalyFlags?: string[];
    };
  };
}

export interface SSOSecurityAlert {
  type: 'suspicious_login' | 'multiple_failures' | 'unusual_location' | 'certificate_expiry' | 'provider_unavailable' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  organizationId?: string;
  provider?: string;
  description: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface AuditLogQuery {
  organizationId?: string;
  userId?: string;
  provider?: string;
  action?: string;
  severity?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export class SSOAuditService {
  // Enhanced audit logging with security context
  static async logSSOEvent(event: SSOAuditEventDetailed): Promise<void> {
    try {
      // Enrich event with security metadata
      const enrichedEvent = await this.enrichSecurityContext(event);
      
      // Store in primary audit log
      await prisma.sSOAuditLog.create({
        data: {
          userId: enrichedEvent.userId,
          organizationId: enrichedEvent.organizationId,
          email: enrichedEvent.email,
          provider: enrichedEvent.provider,
          action: enrichedEvent.action,
          details: enrichedEvent.details || {},
          ipAddress: enrichedEvent.ipAddress,
          userAgent: enrichedEvent.userAgent,
          sessionId: enrichedEvent.sessionId,
          requestId: enrichedEvent.requestId,
          severity: enrichedEvent.severity,
          category: enrichedEvent.category,
          timestamp: enrichedEvent.timestamp,
          metadata: enrichedEvent.metadata || {},
        },
      });

      // Check for security alerts
      await this.checkSecurityAlerts(enrichedEvent);

      // Real-time monitoring hooks
      await this.notifySecurityMonitoring(enrichedEvent);

    } catch (error) {
      // Fallback logging to prevent audit failures from breaking SSO
      console.error('SSO Audit logging failed:', error);
      
      // Log to backup audit store (file system or external service)
      await this.logToBackupStore(event, error);
    }
  }

  // Security context enrichment
  private static async enrichSecurityContext(event: SSOAuditEventDetailed): Promise<SSOAuditEventDetailed> {
    const enriched = { ...event };

    // Add geolocation data
    if (event.ipAddress) {
      enriched.metadata = enriched.metadata || {};
      enriched.metadata.geolocation = await this.getGeolocation(event.ipAddress);
    }

    // Parse user agent for device info
    if (event.userAgent) {
      enriched.metadata = enriched.metadata || {};
      enriched.metadata.device = this.parseUserAgent(event.userAgent);
    }

    // Calculate security risk score
    enriched.metadata = enriched.metadata || {};
    enriched.metadata.security = await this.calculateSecurityContext(event);

    return enriched;
  }

  // Security alert detection
  private static async checkSecurityAlerts(event: SSOAuditEventDetailed): Promise<void> {
    const alerts: SSOSecurityAlert[] = [];

    // Check for multiple failed login attempts
    if (event.action === 'denied') {
      const recentFailures = await this.getRecentFailures(event.email, 15); // 15 minutes
      if (recentFailures >= 5) {
        alerts.push({
          type: 'multiple_failures',
          severity: 'high',
          userId: event.userId,
          organizationId: event.organizationId,
          provider: event.provider,
          description: `Multiple failed login attempts: ${recentFailures} failures in 15 minutes`,
          details: {
            failureCount: recentFailures,
            timeWindow: '15m',
            email: event.email,
            ipAddress: event.ipAddress,
          },
          timestamp: new Date(),
        });
      }
    }

    // Check for unusual login location
    if (event.action === 'login' && event.userId) {
      const isUnusualLocation = await this.detectUnusualLocation(event.userId, event.metadata?.geolocation);
      if (isUnusualLocation) {
        alerts.push({
          type: 'unusual_location',
          severity: 'medium',
          userId: event.userId,
          organizationId: event.organizationId,
          provider: event.provider,
          description: 'Login from unusual geographic location',
          details: {
            currentLocation: event.metadata?.geolocation,
            ipAddress: event.ipAddress,
          },
          timestamp: new Date(),
        });
      }
    }

    // Check for high-risk security indicators
    if (event.metadata?.security?.riskScore && event.metadata.security.riskScore > 0.8) {
      alerts.push({
        type: 'suspicious_login',
        severity: 'critical',
        userId: event.userId,
        organizationId: event.organizationId,
        provider: event.provider,
        description: 'High-risk security indicators detected',
        details: {
          riskScore: event.metadata.security.riskScore,
          threatIndicators: event.metadata.security.threatIndicators,
          anomalyFlags: event.metadata.security.anomalyFlags,
        },
        timestamp: new Date(),
      });
    }

    // Store and process alerts
    for (const alert of alerts) {
      await this.createSecurityAlert(alert);
    }
  }

  // Query audit logs with advanced filtering
  static async queryAuditLogs(query: AuditLogQuery): Promise<{
    logs: any[];
    total: number;
    summary: {
      totalEvents: number;
      uniqueUsers: number;
      topActions: Array<{ action: string; count: number }>;
      securityEvents: number;
      averageRiskScore: number;
    };
  }> {
    const where: any = {};

    // Build query filters
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.userId) where.userId = query.userId;
    if (query.provider) where.provider = query.provider;
    if (query.action) where.action = query.action;
    if (query.severity) where.severity = query.severity;
    if (query.category) where.category = query.category;
    if (query.ipAddress) where.ipAddress = query.ipAddress;
    
    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) where.timestamp.gte = query.startDate;
      if (query.endDate) where.timestamp.lte = query.endDate;
    }

    // Execute queries in parallel
    const [logs, total, summary] = await Promise.all([
      // Main logs query
      prisma.sSOAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit || 100,
        skip: query.offset || 0,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),

      // Count total matching logs
      prisma.sSOAuditLog.count({ where }),

      // Generate summary statistics
      this.generateAuditSummary(where),
    ]);

    return { logs, total, summary };
  }

  // Generate audit summary statistics
  private static async generateAuditSummary(where: any): Promise<{
    totalEvents: number;
    uniqueUsers: number;
    topActions: Array<{ action: string; count: number }>;
    securityEvents: number;
    averageRiskScore: number;
  }> {
    const [
      totalEvents,
      uniqueUsers,
      actionStats,
      securityEvents,
      riskScores,
    ] = await Promise.all([
      prisma.sSOAuditLog.count({ where }),
      
      prisma.sSOAuditLog.findMany({
        where,
        select: { userId: true },
        distinct: ['userId'],
      }),
      
      prisma.sSOAuditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 5,
      }),
      
      prisma.sSOAuditLog.count({
        where: {
          ...where,
          OR: [
            { severity: 'error' },
            { severity: 'critical' },
            { category: 'security' },
          ],
        },
      }),
      
      prisma.sSOAuditLog.findMany({
        where,
        select: { metadata: true },
      }),
    ]);

    // Calculate average risk score
    const validRiskScores = riskScores
      .map(log => (log.metadata as any)?.security?.riskScore)
      .filter(score => typeof score === 'number');
    
    const averageRiskScore = validRiskScores.length > 0
      ? validRiskScores.reduce((sum, score) => sum + score, 0) / validRiskScores.length
      : 0;

    return {
      totalEvents,
      uniqueUsers: uniqueUsers.length,
      topActions: actionStats.map(stat => ({
        action: stat.action,
        count: stat._count.action,
      })),
      securityEvents,
      averageRiskScore,
    };
  }

  // Export audit logs for compliance
  static async exportAuditLogs(
    query: AuditLogQuery,
    format: 'csv' | 'json' | 'xlsx'
  ): Promise<{
    data: any;
    filename: string;
    contentType: string;
  }> {
    const { logs } = await this.queryAuditLogs({ ...query, limit: 10000 });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sso-audit-logs-${timestamp}`;

    switch (format) {
      case 'csv':
        return {
          data: this.formatAsCSV(logs),
          filename: `${filename}.csv`,
          contentType: 'text/csv',
        };
        
      case 'json':
        return {
          data: JSON.stringify(logs, null, 2),
          filename: `${filename}.json`,
          contentType: 'application/json',
        };
        
      case 'xlsx':
        return {
          data: this.formatAsXLSX(logs),
          filename: `${filename}.xlsx`,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
        
      default:
        throw new Error('Unsupported export format');
    }
  }

  // Real-time security monitoring notifications
  private static async notifySecurityMonitoring(event: SSOAuditEventDetailed): Promise<void> {
    // High-severity events trigger immediate notifications
    if (event.severity === 'critical' || event.category === 'security') {
      // Integrate with security monitoring systems
      await this.sendSecurityAlert({
        event,
        alertType: 'real-time',
        channels: ['slack', 'email', 'webhook'],
      });
    }

    // Performance monitoring for SSO operations
    if (event.action === 'login' && event.details?.responseTime) {
      await this.trackPerformanceMetrics({
        provider: event.provider,
        responseTime: event.details.responseTime,
        timestamp: event.timestamp,
      });
    }
  }

  // Helper methods for security analysis
  private static async getRecentFailures(email: string, minutesWindow: number): Promise<number> {
    const since = new Date(Date.now() - minutesWindow * 60 * 1000);
    
    return prisma.sSOAuditLog.count({
      where: {
        email,
        action: 'denied',
        timestamp: { gte: since },
      },
    });
  }

  private static async detectUnusualLocation(userId: string, currentLocation?: any): Promise<boolean> {
    if (!currentLocation) return false;

    // Get user's typical login locations from last 30 days
    const recentLogins = await prisma.sSOAuditLog.findMany({
      where: {
        userId,
        action: 'login',
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: { metadata: true },
    });

    // Simple location anomaly detection
    const knownCountries = new Set(
      recentLogins
        .map(log => (log.metadata as any)?.geolocation?.country)
        .filter(Boolean)
    );

    return knownCountries.size > 0 && !knownCountries.has(currentLocation.country);
  }

  private static async calculateSecurityContext(event: SSOAuditEventDetailed): Promise<any> {
    let riskScore = 0;
    const threatIndicators: string[] = [];
    const anomalyFlags: string[] = [];

    // Check for known threat indicators
    if (event.ipAddress) {
      // In production, integrate with threat intelligence feeds
      const isThreatIP = await this.checkThreatIntelligence(event.ipAddress);
      if (isThreatIP) {
        riskScore += 0.5;
        threatIndicators.push('known_threat_ip');
      }
    }

    // Check for anomalous patterns
    if (event.action === 'login') {
      const isOffHours = this.isOffHours(event.timestamp);
      if (isOffHours) {
        riskScore += 0.2;
        anomalyFlags.push('off_hours_login');
      }
    }

    // User agent analysis
    if (event.userAgent) {
      const isSuspiciousAgent = this.analyzeSuspiciousUserAgent(event.userAgent);
      if (isSuspiciousAgent) {
        riskScore += 0.3;
        threatIndicators.push('suspicious_user_agent');
      }
    }

    return {
      riskScore: Math.min(riskScore, 1.0),
      threatIndicators,
      anomalyFlags,
    };
  }

  private static async getGeolocation(ipAddress: string): Promise<any> {
    // In production, integrate with geolocation service
    // For now, return mock data for known test IPs
    if (ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.')) {
      return {
        country: 'Local',
        region: 'Local',
        city: 'Local',
      };
    }

    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
    };
  }

  private static parseUserAgent(userAgent: string): any {
    // Simple user agent parsing - in production use proper library
    return {
      type: userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      os: userAgent.includes('Windows') ? 'Windows' : 
          userAgent.includes('Mac') ? 'macOS' : 
          userAgent.includes('Linux') ? 'Linux' : 'Unknown',
      browser: userAgent.includes('Chrome') ? 'Chrome' :
               userAgent.includes('Firefox') ? 'Firefox' :
               userAgent.includes('Safari') ? 'Safari' : 'Unknown',
    };
  }

  private static async createSecurityAlert(alert: SSOSecurityAlert): Promise<void> {
    await prisma.sSOSecurityAlert.create({
      data: {
        type: alert.type,
        severity: alert.severity,
        userId: alert.userId,
        organizationId: alert.organizationId,
        provider: alert.provider,
        description: alert.description,
        details: alert.details,
        timestamp: alert.timestamp,
        resolved: false,
      },
    });

    // Send immediate notification for high-severity alerts
    if (alert.severity === 'high' || alert.severity === 'critical') {
      await this.sendSecurityAlert({
        alert,
        alertType: 'security',
        channels: ['email', 'slack'],
      });
    }
  }

  private static async logToBackupStore(event: SSOAuditEventDetailed, error: any): Promise<void> {
    // Backup audit logging to prevent data loss
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      error: error?.message,
      source: 'sso-audit-backup',
    };

    console.error('SSO Audit Backup Log:', JSON.stringify(logEntry));
    
    // Could also write to file system or external logging service
  }

  private static async checkThreatIntelligence(ipAddress: string): Promise<boolean> {
    // In production, integrate with threat intelligence feeds
    const knownThreats = ['192.0.2.1', '198.51.100.1', '203.0.113.1'];
    return knownThreats.includes(ipAddress);
  }

  private static isOffHours(timestamp: Date): boolean {
    const hour = timestamp.getHours();
    return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
  }

  private static analyzeSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      'bot', 'crawler', 'spider', 'scraper',
      'curl', 'wget', 'python-requests',
    ];
    
    const lowerAgent = userAgent.toLowerCase();
    return suspiciousPatterns.some(pattern => lowerAgent.includes(pattern));
  }

  private static formatAsCSV(logs: any[]): string {
    if (logs.length === 0) return '';

    const headers = [
      'timestamp', 'email', 'provider', 'action', 'severity',
      'category', 'ipAddress', 'userAgent', 'details'
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.timestamp,
        log.email,
        log.provider,
        log.action,
        log.severity,
        log.category,
        log.ipAddress || '',
        `"${log.userAgent || ''}"`,
        `"${JSON.stringify(log.details || {})}"`,
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  private static formatAsXLSX(logs: any[]): Buffer {
    // In production, use proper XLSX library like 'exceljs'
    // For now, return CSV data as buffer
    const csvData = this.formatAsCSV(logs);
    return Buffer.from(csvData, 'utf-8');
  }

  private static async sendSecurityAlert(params: {
    event?: SSOAuditEventDetailed;
    alert?: SSOSecurityAlert;
    alertType: string;
    channels: string[];
  }): Promise<void> {
    // Integration with notification systems
    console.log('Security Alert:', params);
    
    // In production, integrate with Slack, email, webhook systems
  }

  private static async trackPerformanceMetrics(params: {
    provider: string;
    responseTime: number;
    timestamp: Date;
  }): Promise<void> {
    // Track SSO performance metrics for monitoring
    console.log('Performance Metric:', params);
    
    // In production, send to monitoring system like DataDog, New Relic
  }
}