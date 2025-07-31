import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { CrossRepoPattern } from './cross-repo-pattern-detection.service';
import { WebSocketService } from './websocket.service';
import { NotificationService } from './notification.service';

const prisma = new PrismaClient();

export interface AlertRule {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  conditions: {
    minAffectedRepos: number;
    maxTimeToDetection: number; // minutes
    severityThreshold: 'low' | 'medium' | 'high' | 'critical';
    confidenceThreshold: number; // 0-1
    patternTypes: string[];
    estimatedCostThreshold: number;
    cascadeDetection: boolean;
  };
  actions: {
    webhookUrl?: string;
    emailRecipients: string[];
    slackChannel?: string;
    createJiraTicket?: boolean;
    escalateAfterMinutes?: number;
  };
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatternAlert {
  id: string;
  alertRuleId: string;
  organizationId: string;
  patternId: string;
  pattern: CrossRepoPattern;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  actionsTaken: string[];
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export class CrossRepoAlertingService {
  private wsService: WebSocketService;
  private notificationService: NotificationService;

  constructor() {
    this.wsService = new WebSocketService();
    this.notificationService = new NotificationService();
  }

  /**
   * Process new patterns and trigger alerts based on configured rules
   */
  public async processNewPatterns(organizationId: string, patterns: CrossRepoPattern[]): Promise<PatternAlert[]> {
    logger.info(`Processing ${patterns.length} patterns for alerts in organization ${organizationId}`);
    
    const alertRules = await this.getActiveAlertRules(organizationId);
    const triggeredAlerts: PatternAlert[] = [];

    for (const pattern of patterns) {
      for (const rule of alertRules) {
        if (this.shouldTriggerAlert(pattern, rule)) {
          const alert = await this.createAlert(rule, pattern);
          await this.executeAlertActions(alert, rule);
          triggeredAlerts.push(alert);
          
          logger.info(`Alert triggered: ${alert.id} for pattern ${pattern.id}`);
        }
      }
    }

    // Check for cascading pattern alerts
    const cascadingAlerts = await this.detectCascadingPatternAlerts(organizationId, patterns);
    triggeredAlerts.push(...cascadingAlerts);

    return triggeredAlerts;
  }

  /**
   * Create and configure alert rules for an organization
   */
  public async createAlertRule(organizationId: string, ruleData: Omit<AlertRule, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const rule: AlertRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      ...ruleData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store rule in database (simplified - would use actual DB)
    logger.info(`Created alert rule ${rule.id} for organization ${organizationId}`);
    
    return rule;
  }

  /**
   * Get real-time pattern monitoring dashboard data
   */
  public async getMonitoringDashboard(organizationId: string): Promise<{
    activeAlerts: PatternAlert[];
    recentPatterns: CrossRepoPattern[];
    alertRules: AlertRule[];
    metrics: {
      alertsLast24h: number;
      criticalPatternsActive: number;
      avgResolutionTime: number;
      mostCommonPatternType: string;
    };
  }> {
    const activeAlerts = await this.getActiveAlerts(organizationId);
    const recentPatterns = await this.getRecentPatterns(organizationId, 24); // Last 24 hours
    const alertRules = await this.getActiveAlertRules(organizationId);
    
    const metrics = {
      alertsLast24h: activeAlerts.filter(a => 
        new Date().getTime() - a.createdAt.getTime() < 24 * 60 * 60 * 1000
      ).length,
      criticalPatternsActive: recentPatterns.filter(p => p.severity === 'critical').length,
      avgResolutionTime: await this.calculateAverageResolutionTime(organizationId),
      mostCommonPatternType: this.getMostCommonPatternType(recentPatterns)
    };

    return {
      activeAlerts,
      recentPatterns,
      alertRules,
      metrics
    };
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    logger.info(`Alert ${alertId} acknowledged by user ${userId}`);
    
    // In real implementation, update database
    // Send real-time update via WebSocket
    await this.wsService.sendToOrganization('alert-acknowledged', {
      alertId,
      acknowledgedBy: userId,
      acknowledgedAt: new Date()
    });
  }

  /**
   * Set up real-time monitoring for an organization
   */
  public async setupRealtimeMonitoring(organizationId: string): Promise<void> {
    logger.info(`Setting up real-time monitoring for organization ${organizationId}`);
    
    // Set up periodic pattern analysis
    setInterval(async () => {
      await this.checkForNewPatterns(organizationId);
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Set up escalation checks
    setInterval(async () => {
      await this.checkAlertEscalations(organizationId);
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  // Private helper methods

  private async getActiveAlertRules(organizationId: string): Promise<AlertRule[]> {
    // In real implementation, fetch from database
    // For now, return default rules
    return [
      {
        id: 'default-critical',
        organizationId,
        name: 'Critical Cross-Repo Patterns',
        description: 'Alert on critical patterns affecting multiple repositories',
        conditions: {
          minAffectedRepos: 3,
          maxTimeToDetection: 30,
          severityThreshold: 'critical',
          confidenceThreshold: 0.8,
          patternTypes: ['infrastructure', 'dependency', 'environmental'],
          estimatedCostThreshold: 500,
          cascadeDetection: true
        },
        actions: {
          emailRecipients: [],
          createJiraTicket: true,
          escalateAfterMinutes: 60
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  private shouldTriggerAlert(pattern: CrossRepoPattern, rule: AlertRule): boolean {
    const conditions = rule.conditions;
    
    // Check affected repositories threshold
    if (pattern.affectedRepos.length < conditions.minAffectedRepos) {
      return false;
    }

    // Check severity threshold
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    if (severityOrder[pattern.severity] < severityOrder[conditions.severityThreshold]) {
      return false;
    }

    // Check confidence threshold
    if (pattern.confidence < conditions.confidenceThreshold) {
      return false;
    }

    // Check pattern type filter
    if (conditions.patternTypes.length > 0 && !conditions.patternTypes.includes(pattern.patternType)) {
      return false;
    }

    // Check estimated cost threshold
    if (pattern.impactMetrics.estimatedCostImpact < conditions.estimatedCostThreshold) {
      return false;
    }

    // Check time to detection (how quickly pattern was detected)
    const detectionTime = new Date().getTime() - pattern.detectedAt.getTime();
    if (detectionTime > conditions.maxTimeToDetection * 60 * 1000) {
      return false;
    }

    return true;
  }

  private async createAlert(rule: AlertRule, pattern: CrossRepoPattern): Promise<PatternAlert> {
    const alert: PatternAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      alertRuleId: rule.id,
      organizationId: rule.organizationId,
      patternId: pattern.id,
      pattern,
      severity: this.mapPatternSeverityToAlertSeverity(pattern.severity),
      message: this.generateAlertMessage(pattern),
      actionsTaken: [],
      createdAt: new Date()
    };

    // Store alert in database (simplified)
    logger.info(`Created alert ${alert.id} for pattern ${pattern.id}`);
    
    return alert;
  }

  private async executeAlertActions(alert: PatternAlert, rule: AlertRule): Promise<void> {
    const actions = rule.actions;
    const actionsTaken: string[] = [];

    // Send real-time WebSocket notification
    await this.wsService.sendToOrganization(rule.organizationId, 'cross-repo-pattern-alert', {
      alert,
      pattern: alert.pattern
    });
    actionsTaken.push('Real-time notification sent');

    // Send email notifications
    if (actions.emailRecipients.length > 0) {
      await this.notificationService.sendPatternAlert(
        actions.emailRecipients,
        alert.pattern,
        alert.message
      );
      actionsTaken.push(`Email sent to ${actions.emailRecipients.length} recipients`);
    }

    // Webhook notification
    if (actions.webhookUrl) {
      await this.sendWebhookNotification(actions.webhookUrl, alert);
      actionsTaken.push('Webhook notification sent');
    }

    // Slack notification
    if (actions.slackChannel) {
      await this.sendSlackNotification(actions.slackChannel, alert);
      actionsTaken.push('Slack notification sent');
    }

    // Create Jira ticket
    if (actions.createJiraTicket) {
      await this.createJiraTicket(alert);
      actionsTaken.push('Jira ticket created');
    }

    alert.actionsTaken = actionsTaken;
    logger.info(`Executed ${actionsTaken.length} actions for alert ${alert.id}`);
  }

  private async detectCascadingPatternAlerts(organizationId: string, patterns: CrossRepoPattern[]): Promise<PatternAlert[]> {
    const cascadingAlerts: PatternAlert[] = [];
    
    // Detect if multiple critical patterns appeared within a short time window
    const criticalPatterns = patterns.filter(p => p.severity === 'critical');
    
    if (criticalPatterns.length >= 3) {
      const cascadeAlert: PatternAlert = {
        id: `cascade-alert-${Date.now()}`,
        alertRuleId: 'cascade-detection',
        organizationId,
        patternId: 'cascade-pattern',
        pattern: this.createCascadePattern(criticalPatterns),
        severity: 'critical',
        message: `🚨 CASCADE ALERT: ${criticalPatterns.length} critical cross-repo patterns detected simultaneously. Potential system-wide issue.`,
        actionsTaken: [],
        createdAt: new Date()
      };

      cascadingAlerts.push(cascadeAlert);
      
      // Immediate escalation for cascade alerts
      await this.escalateCascadeAlert(cascadeAlert);
    }

    return cascadingAlerts;
  }

  private createCascadePattern(patterns: CrossRepoPattern[]): CrossRepoPattern {
    const allAffectedRepos = new Set<string>();
    const allAffectedTests: CrossRepoPattern['affectedTests'] = [];
    let totalFailures = 0;
    let totalCost = 0;

    patterns.forEach(pattern => {
      pattern.affectedRepos.forEach(repo => allAffectedRepos.add(repo));
      allAffectedTests.push(...pattern.affectedTests);
      totalFailures += pattern.impactMetrics.totalFailures;
      totalCost += pattern.impactMetrics.estimatedCostImpact;
    });

    return {
      id: `cascade-${Date.now()}`,
      patternType: 'infrastructure',
      severity: 'critical',
      confidence: 0.95,
      affectedRepos: Array.from(allAffectedRepos),
      affectedTests: allAffectedTests,
      commonFactors: {
        environmentFactors: ['System-wide cascade failure'],
        mlInsights: ['Multiple critical patterns detected simultaneously']
      },
      rootCause: {
        primaryCause: 'Cascading system failure across multiple repositories',
        secondaryCauses: [
          'Infrastructure-wide issue',
          'Shared service dependency failure',
          'Configuration change impact',
          'Resource exhaustion cascade'
        ],
        evidenceStrength: 0.95,
        suggestedFixes: [
          'IMMEDIATE: Check system-wide infrastructure health',
          'IMMEDIATE: Review recent configuration changes',
          'IMMEDIATE: Verify shared service status',
          'Implement circuit breakers to prevent future cascades'
        ]
      },
      impactMetrics: {
        totalFailures,
        affectedProjectsCount: allAffectedRepos.size,
        estimatedCostImpact: totalCost,
        timeToResolution: 1 // Critical - immediate action required
      },
      detectedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  private async getActiveAlerts(organizationId: string): Promise<PatternAlert[]> {
    // In real implementation, fetch from database
    return [];
  }

  private async getRecentPatterns(organizationId: string, hours: number): Promise<CrossRepoPattern[]> {
    // In real implementation, fetch recent patterns from database
    return [];
  }

  private async calculateAverageResolutionTime(organizationId: string): Promise<number> {
    // In real implementation, calculate from historical data
    return 4.5; // hours
  }

  private getMostCommonPatternType(patterns: CrossRepoPattern[]): string {
    if (patterns.length === 0) return 'none';
    
    const typeCounts = patterns.reduce((counts, p) => {
      counts[p.patternType] = (counts[p.patternType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';
  }

  private mapPatternSeverityToAlertSeverity(severity: string): 'info' | 'warning' | 'critical' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'critical';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  }

  private generateAlertMessage(pattern: CrossRepoPattern): string {
    const repoCount = pattern.affectedRepos.length;
    const cost = pattern.impactMetrics.estimatedCostImpact;
    
    return `🔍 Cross-Repository Pattern Detected: ${pattern.rootCause.primaryCause} affecting ${repoCount} repositories with estimated cost impact of $${cost}. Confidence: ${Math.round(pattern.confidence * 100)}%`;
  }

  private async checkForNewPatterns(organizationId: string): Promise<void> {
    try {
      // This would trigger pattern analysis and check for new patterns
      logger.debug(`Checking for new patterns in organization ${organizationId}`);
      
      // In real implementation:
      // 1. Run incremental pattern analysis
      // 2. Compare with last known patterns
      // 3. Trigger alerts for new patterns
      
    } catch (error) {
      logger.error('Error checking for new patterns:', error);
    }
  }

  private async checkAlertEscalations(organizationId: string): Promise<void> {
    try {
      const activeAlerts = await this.getActiveAlerts(organizationId);
      
      for (const alert of activeAlerts) {
        if (!alert.acknowledgedAt && this.shouldEscalateAlert(alert)) {
          await this.escalateAlert(alert);
        }
      }
    } catch (error) {
      logger.error('Error checking alert escalations:', error);
    }
  }

  private shouldEscalateAlert(alert: PatternAlert): boolean {
    const hoursSinceCreated = (new Date().getTime() - alert.createdAt.getTime()) / (1000 * 60 * 60);
    
    // Escalate critical alerts after 1 hour, warnings after 4 hours
    if (alert.severity === 'critical' && hoursSinceCreated > 1) return true;
    if (alert.severity === 'warning' && hoursSinceCreated > 4) return true;
    
    return false;
  }

  private async escalateAlert(alert: PatternAlert): Promise<void> {
    logger.warn(`Escalating alert ${alert.id} - no acknowledgment received`);
    
    // Send escalation notifications
    await this.notificationService.sendEscalationAlert(alert);
    
    // Update alert status
    alert.actionsTaken.push(`Escalated at ${new Date().toISOString()}`);
  }

  private async escalateCascadeAlert(alert: PatternAlert): Promise<void> {
    logger.error(`CASCADE ALERT: ${alert.message}`);
    
    // Immediate notifications for cascade alerts
    await this.notificationService.sendCriticalAlert(alert);
    
    // Send to operations team
    await this.wsService.sendToOrganization(alert.organizationId, 'cascade-alert', alert);
  }

  private async sendWebhookNotification(webhookUrl: string, alert: PatternAlert): Promise<void> {
    try {
      // In real implementation, send HTTP POST to webhook URL
      logger.info(`Sending webhook notification to ${webhookUrl} for alert ${alert.id}`);
    } catch (error) {
      logger.error('Error sending webhook notification:', error);
    }
  }

  private async sendSlackNotification(channel: string, alert: PatternAlert): Promise<void> {
    try {
      // In real implementation, send Slack message
      logger.info(`Sending Slack notification to ${channel} for alert ${alert.id}`);
    } catch (error) {
      logger.error('Error sending Slack notification:', error);
    }
  }

  private async createJiraTicket(alert: PatternAlert): Promise<void> {
    try {
      // In real implementation, create Jira ticket via API
      logger.info(`Creating Jira ticket for alert ${alert.id}`);
    } catch (error) {
      logger.error('Error creating Jira ticket:', error);
    }
  }
}