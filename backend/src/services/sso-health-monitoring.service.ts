import { SSOService } from './sso.service';
import { SSOAuditService } from './sso-audit.service';
import { CertificateManagementService } from './certificate-management.service';
import { ProviderHealthCheck } from '../utils/provider-health-check';
import { prisma } from './database.service';

export interface SSOHealthMetrics {
  overall: {
    status: 'healthy' | 'degraded' | 'critical';
    score: number; // 0-100
    lastUpdated: Date;
  };
  providers: Array<{
    id: string;
    name: string;
    type: 'saml' | 'oidc';
    status: 'healthy' | 'degraded' | 'critical' | 'offline';
    responseTime: number;
    availability: number; // percentage
    errorRate: number; // percentage
    lastHealthCheck: Date;
    issues: string[];
  }>;
  authentication: {
    successRate: number;
    averageResponseTime: number;
    totalAttempts: number;
    failedAttempts: number;
    blockedAttempts: number;
    timeRange: string;
  };
  certificates: {
    total: number;
    healthy: number;
    expiringSoon: number;
    expired: number;
    nextExpiry: Date | null;
  };
  performance: {
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number; // requests per minute
    errorRate: number;
  };
  security: {
    riskScore: number; // 0-100
    activeAlerts: number;
    suspiciousActivity: number;
    blockedIPs: number;
    anomalies: Array<{
      type: string;
      count: number;
      lastOccurrence: Date;
    }>;
  };
}

export interface HealthAlert {
  id: string;
  type: 'provider_down' | 'high_error_rate' | 'slow_response' | 'certificate_expiry' | 'security_threat' | 'performance_degradation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affected: {
    providers?: string[];
    organizations?: string[];
    users?: number;
  };
  metrics: Record<string, any>;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface MonitoringRule {
  id: string;
  name: string;
  type: 'threshold' | 'anomaly' | 'composite';
  enabled: boolean;
  conditions: {
    metric: string;
    operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
    threshold: number;
    timeWindow: number; // minutes
    evaluationFrequency: number; // minutes
  }[];
  actions: {
    alert: boolean;
    notification: {
      channels: string[];
      recipients: string[];
      template: string;
    };
    autoRemediation?: {
      enabled: boolean;
      action: string;
      maxRetries: number;
    };
  };
  organizationId?: string; // null for global rules
}

export class SSOHealthMonitoringService {
  // Real-time health monitoring
  static async getCurrentHealthStatus(organizationId?: string): Promise<SSOHealthMetrics> {
    const [
      providerHealth,
      authMetrics,
      certHealth,
      performanceMetrics,
      securityMetrics
    ] = await Promise.all([
      this.getProviderHealthMetrics(organizationId),
      this.getAuthenticationMetrics(organizationId),
      this.getCertificateHealthMetrics(organizationId),
      this.getPerformanceMetrics(organizationId),
      this.getSecurityMetrics(organizationId)
    ]);

    // Calculate overall health score
    const overallScore = this.calculateOverallHealthScore({
      providerHealth,
      authMetrics,
      certHealth,
      performanceMetrics,
      securityMetrics
    });

    return {
      overall: {
        status: this.getStatusFromScore(overallScore),
        score: overallScore,
        lastUpdated: new Date(),
      },
      providers: providerHealth,
      authentication: authMetrics,
      certificates: certHealth,
      performance: performanceMetrics,
      security: securityMetrics,
    };
  }

  // Provider health metrics
  private static async getProviderHealthMetrics(organizationId?: string): Promise<any[]> {
    const providers = organizationId
      ? await SSOService.getSSOProviderByOrganization(organizationId)
      : await this.getAllActiveProviders();

    const healthMetrics = [];

    for (const provider of providers) {
      try {
        // Get recent health check results
        const healthResult = await ProviderHealthCheck.checkProviderHealth(
          provider.id,
          provider.type,
          provider.config
        );

        // Get provider statistics from last 24 hours
        const stats = await this.getProviderStats(provider.id, 24);

        healthMetrics.push({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          status: healthResult.isHealthy ? 'healthy' : 'degraded',
          responseTime: healthResult.checks.responseTime || 0,
          availability: stats.availability,
          errorRate: stats.errorRate,
          lastHealthCheck: healthResult.lastChecked,
          issues: healthResult.errors || [],
        });
      } catch (error) {
        healthMetrics.push({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          status: 'offline',
          responseTime: 0,
          availability: 0,
          errorRate: 100,
          lastHealthCheck: new Date(),
          issues: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    return healthMetrics;
  }

  // Authentication metrics
  private static async getAuthenticationMetrics(organizationId?: string): Promise<any> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const where: any = {
      timestamp: { gte: since },
      action: { in: ['login', 'denied', 'error'] },
    };
    
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [authEvents, responseTimes] = await Promise.all([
      prisma.sSOAuditLog.findMany({
        where,
        select: {
          action: true,
          details: true,
          timestamp: true,
        },
      }),
      this.getAuthResponseTimes(since, organizationId),
    ]);

    const totalAttempts = authEvents.length;
    const successfulLogins = authEvents.filter(e => e.action === 'login').length;
    const failedAttempts = authEvents.filter(e => e.action === 'denied').length;
    const errors = authEvents.filter(e => e.action === 'error').length;

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      successRate: totalAttempts > 0 ? (successfulLogins / totalAttempts) * 100 : 100,
      averageResponseTime,
      totalAttempts,
      failedAttempts,
      blockedAttempts: errors,
      timeRange: '24h',
    };
  }

  // Certificate health metrics
  private static async getCertificateHealthMetrics(organizationId?: string): Promise<any> {
    const dashboard = await CertificateManagementService.getCertificateHealthDashboard(organizationId);
    
    const nextExpiry = dashboard.certificates
      .filter(cert => cert.isValid)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)[0]?.notAfter || null;

    return {
      total: dashboard.summary.totalCertificates,
      healthy: dashboard.summary.healthy,
      expiringSoon: dashboard.summary.warning + dashboard.summary.critical,
      expired: dashboard.summary.expired,
      nextExpiry,
    };
  }

  // Performance metrics
  private static async getPerformanceMetrics(organizationId?: string): Promise<any> {
    const since = new Date(Date.now() - 60 * 60 * 1000); // Last hour
    
    const responseTimes = await this.getDetailedResponseTimes(since, organizationId);
    const requestCount = await this.getRequestCount(since, organizationId);
    const errorCount = await this.getErrorCount(since, organizationId);

    if (responseTimes.length === 0) {
      return {
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
      };
    }

    // Calculate percentiles
    responseTimes.sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];

    return {
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      throughput: requestCount, // requests per hour
      errorRate: requestCount > 0 ? (errorCount / requestCount) * 100 : 0,
    };
  }

  // Security metrics
  private static async getSecurityMetrics(organizationId?: string): Promise<any> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const [auditSummary, alerts, anomalies] = await Promise.all([
      SSOAuditService.queryAuditLogs({
        organizationId,
        startDate: since,
        category: 'security',
      }),
      this.getActiveSecurityAlerts(organizationId),
      this.getSecurityAnomalies(since, organizationId),
    ]);

    return {
      riskScore: auditSummary.summary.averageRiskScore * 100,
      activeAlerts: alerts.length,
      suspiciousActivity: auditSummary.summary.securityEvents,
      blockedIPs: await this.getBlockedIPCount(organizationId),
      anomalies,
    };
  }

  // Health monitoring rules engine
  static async evaluateMonitoringRules(): Promise<HealthAlert[]> {
    const rules = await this.getActiveMonitoringRules();
    const alerts: HealthAlert[] = [];

    for (const rule of rules) {
      try {
        const isTriggered = await this.evaluateRule(rule);
        
        if (isTriggered) {
          const alert = await this.createHealthAlert(rule);
          alerts.push(alert);
          
          // Execute actions
          await this.executeRuleActions(rule, alert);
        }
      } catch (error) {
        console.error(`Failed to evaluate monitoring rule ${rule.id}:`, error);
      }
    }

    return alerts;
  }

  // Alert management
  static async getActiveAlerts(organizationId?: string): Promise<HealthAlert[]> {
    const where: any = { resolved: false };
    if (organizationId) where.organizationId = organizationId;

    const alerts = await prisma.sSOHealthAlert.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    return alerts.map(alert => ({
      id: alert.id,
      type: alert.type as any,
      severity: alert.severity as any,
      title: alert.title,
      description: alert.description,
      affected: alert.affected as any,
      metrics: alert.metrics as any,
      timestamp: alert.timestamp,
      resolved: alert.resolved,
      resolvedAt: alert.resolvedAt || undefined,
      acknowledgedBy: alert.acknowledgedBy || undefined,
      acknowledgedAt: alert.acknowledgedAt || undefined,
    }));
  }

  static async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await prisma.sSOHealthAlert.update({
      where: { id: alertId },
      data: {
        acknowledgedBy,
        acknowledgedAt: new Date(),
      },
    });
  }

  static async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    await prisma.sSOHealthAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }

  // Dashboard endpoints
  static async getHealthDashboardData(organizationId?: string): Promise<{
    health: SSOHealthMetrics;
    alerts: HealthAlert[];
    trends: any;
    recommendations: any[];
  }> {
    const [health, alerts, trends, recommendations] = await Promise.all([
      this.getCurrentHealthStatus(organizationId),
      this.getActiveAlerts(organizationId),
      this.getHealthTrends(organizationId),
      this.generateHealthRecommendations(organizationId),
    ]);

    return { health, alerts, trends, recommendations };
  }

  // Helper methods
  private static async getAllActiveProviders(): Promise<any[]> {
    return prisma.sSOProvider.findMany({
      where: { isActive: true },
    });
  }

  private static async getProviderStats(providerId: string, hours: number): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const logs = await prisma.sSOAuditLog.findMany({
      where: {
        timestamp: { gte: since },
        // Note: This assumes you have a way to link audit logs to providers
        details: { path: ['providerId'], equals: providerId },
      },
    });

    const totalRequests = logs.length;
    const errors = logs.filter(log => log.severity === 'error' || log.severity === 'critical').length;

    return {
      availability: totalRequests > 0 ? ((totalRequests - errors) / totalRequests) * 100 : 100,
      errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
    };
  }

  private static async getAuthResponseTimes(since: Date, organizationId?: string): Promise<number[]> {
    const where: any = {
      timestamp: { gte: since },
      action: 'login',
    };
    
    if (organizationId) where.organizationId = organizationId;

    const logs = await prisma.sSOAuditLog.findMany({
      where,
      select: { details: true },
    });

    return logs
      .map(log => (log.details as any)?.responseTime)
      .filter(time => typeof time === 'number');
  }

  private static async getDetailedResponseTimes(since: Date, organizationId?: string): Promise<number[]> {
    // Implementation would get detailed response times from monitoring system
    return [100, 150, 200, 120, 180, 300, 250, 90, 110, 400];
  }

  private static async getRequestCount(since: Date, organizationId?: string): Promise<number> {
    const where: any = { timestamp: { gte: since } };
    if (organizationId) where.organizationId = organizationId;
    
    return prisma.sSOAuditLog.count({ where });
  }

  private static async getErrorCount(since: Date, organizationId?: string): Promise<number> {
    const where: any = {
      timestamp: { gte: since },
      severity: { in: ['error', 'critical'] },
    };
    
    if (organizationId) where.organizationId = organizationId;
    
    return prisma.sSOAuditLog.count({ where });
  }

  private static calculateOverallHealthScore(metrics: any): number {
    let score = 100;

    // Provider health (30% weight)
    const unhealthyProviders = metrics.providerHealth.filter((p: any) => p.status !== 'healthy').length;
    const providerPenalty = (unhealthyProviders / metrics.providerHealth.length) * 30;
    score -= providerPenalty;

    // Authentication success rate (25% weight)
    const authPenalty = (100 - metrics.authMetrics.successRate) * 0.25;
    score -= authPenalty;

    // Certificate health (20% weight)
    const certPenalty = (metrics.certHealth.expired + metrics.certHealth.expiringSoon) * 5;
    score -= Math.min(certPenalty, 20);

    // Performance (15% weight)
    if (metrics.performanceMetrics.p95ResponseTime > 1000) {
      score -= 15;
    } else if (metrics.performanceMetrics.p95ResponseTime > 500) {
      score -= 7;
    }

    // Security (10% weight)
    const securityPenalty = (metrics.securityMetrics.riskScore / 100) * 10;
    score -= securityPenalty;

    return Math.max(score, 0);
  }

  private static getStatusFromScore(score: number): 'healthy' | 'degraded' | 'critical' {
    if (score >= 90) return 'healthy';
    if (score >= 70) return 'degraded';
    return 'critical';
  }

  private static async getActiveSecurityAlerts(organizationId?: string): Promise<any[]> {
    // Implementation would get active security alerts
    return [];
  }

  private static async getSecurityAnomalies(since: Date, organizationId?: string): Promise<any[]> {
    // Implementation would detect security anomalies
    return [
      { type: 'unusual_login_time', count: 3, lastOccurrence: new Date() },
      { type: 'new_location', count: 1, lastOccurrence: new Date() },
    ];
  }

  private static async getBlockedIPCount(organizationId?: string): Promise<number> {
    // Implementation would count blocked IPs
    return 0;
  }

  private static async getActiveMonitoringRules(): Promise<MonitoringRule[]> {
    const rules = await prisma.sSOMonitoringRule.findMany({
      where: { enabled: true },
    });

    return rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      type: rule.type as any,
      enabled: rule.enabled,
      conditions: rule.conditions as any,
      actions: rule.actions as any,
      organizationId: rule.organizationId,
    }));
  }

  private static async evaluateRule(rule: MonitoringRule): Promise<boolean> {
    // Implementation would evaluate monitoring rule conditions
    return false;
  }

  private static async createHealthAlert(rule: MonitoringRule): Promise<HealthAlert> {
    const alert: HealthAlert = {
      id: `alert-${Date.now()}`,
      type: 'performance_degradation',
      severity: 'warning',
      title: `Monitoring Rule Triggered: ${rule.name}`,
      description: 'A monitoring rule has been triggered',
      affected: {},
      metrics: {},
      timestamp: new Date(),
    };

    await prisma.sSOHealthAlert.create({
      data: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        affected: alert.affected,
        metrics: alert.metrics,
        timestamp: alert.timestamp,
        organizationId: rule.organizationId,
        resolved: false,
      },
    });

    return alert;
  }

  private static async executeRuleActions(rule: MonitoringRule, alert: HealthAlert): Promise<void> {
    // Implementation would execute rule actions (notifications, auto-remediation)
    console.log(`Executing actions for rule ${rule.name}:`, rule.actions);
  }

  private static async getHealthTrends(organizationId?: string): Promise<any> {
    // Implementation would return health trends over time
    return {
      healthScore: [85, 88, 92, 89, 91, 87, 90],
      responseTime: [120, 110, 130, 125, 115, 140, 135],
      errorRate: [2.1, 1.8, 1.5, 2.3, 1.9, 2.7, 2.0],
      dates: ['2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03'],
    };
  }

  private static async generateHealthRecommendations(organizationId?: string): Promise<any[]> {
    // Implementation would generate actionable recommendations
    return [
      {
        type: 'certificate',
        priority: 'high',
        title: 'Certificate Expiring Soon',
        description: 'SSO provider "Azure AD" certificate expires in 15 days',
        action: 'Rotate certificate',
        impact: 'Authentication will fail if not addressed',
      },
      {
        type: 'performance',
        priority: 'medium',
        title: 'Response Time Increasing',
        description: 'Average response time has increased by 25% over the last week',
        action: 'Review provider configuration and network connectivity',
        impact: 'User experience degradation',
      },
    ];
  }
}