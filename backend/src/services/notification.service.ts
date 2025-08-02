import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { IntegrationService, AlertPayload } from './integration.service';

const prisma = new PrismaClient();

export interface NotificationPreferences {
  email: boolean;
  webhook: boolean;
  webhookUrl?: string;
  riskThreshold: 'medium' | 'high' | 'critical';
  immediateAlerts: boolean;
  dailySummary: boolean;
}

export interface HighRiskAlert {
  projectId: string;
  projectName: string;
  filePath: string;
  riskScore: number;
  riskLevel: string;
  predictedFailureTypes: string[];
  confidence: number;
  estimatedTimeToFlaky?: number;
}

export interface DailySummary {
  projectId: string;
  projectName: string;
  totalFiles: number;
  newHighRiskFiles: number;
  averageRiskScore: number;
  topRiskyFiles: Array<{
    filePath: string;
    riskScore: number;
    riskLevel: string;
  }>;
}

export interface QuarantineNotification {
  projectId: string;
  testName: string;
  testSuite?: string;
  decision: any;
  type: 'auto_quarantine' | 'auto_unquarantine' | 'manual_quarantine' | 'manual_unquarantine';
}

export class NotificationService {
  /**
   * Send quarantine notification
   */
  public async sendQuarantineNotification(notification: QuarantineNotification): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: notification.projectId },
        select: { name: true, repository: true }
      });

      if (!project) {
        logger.warn(`Project not found for quarantine notification: ${notification.projectId}`);
        return;
      }

      const isQuarantine = notification.type.includes('quarantine') && !notification.type.includes('unquarantine');
      const isAuto = notification.type.includes('auto');
      
      const title = isQuarantine 
        ? `🔒 Test ${isAuto ? 'Auto-' : ''}Quarantined`
        : `🔓 Test ${isAuto ? 'Auto-' : ''}Unquarantined`;
      
      const testFullName = notification.testSuite 
        ? `${notification.testSuite} > ${notification.testName}`
        : notification.testName;

      const message = isQuarantine
        ? `Test "${testFullName}" has been ${isAuto ? 'automatically ' : ''}quarantined in ${project.name}.\n\nReason: ${notification.decision.reason}\nConfidence: ${(notification.decision.confidence * 100).toFixed(1)}%`
        : `Test "${testFullName}" has been ${isAuto ? 'automatically ' : ''}released from quarantine in ${project.name}.\n\nReason: ${notification.decision.reason || notification.decision}`;

      // Create integration alert
      const integrationAlert: AlertPayload = {
        type: 'quarantine_triggered',
        projectName: project.name,
        projectId: notification.projectId,
        title,
        description: message,
        severity: isQuarantine ? 'medium' : 'low',
        timestamp: new Date(),
        data: {
          testName: notification.testName,
          testSuite: notification.testSuite,
          automated: isAuto,
          decision: notification.decision
        }
      };

      // Send to all configured integrations for the project
      await IntegrationService.sendAlert(notification.projectId, integrationAlert);
      
      logger.info(`Sent quarantine notification for ${testFullName} in ${project.name}`);
      
    } catch (error) {
      logger.error('Error sending quarantine notification:', error);
    }
  }
  public async sendHighRiskAlert(alert: HighRiskAlert, userEmail: string): Promise<void> {
    try {
      logger.info(`Sending high-risk alert for ${alert.filePath} in project ${alert.projectName}`);

      // Send to configured integrations
      const integrationAlert: AlertPayload = {
        type: 'high_risk_alert',
        projectName: alert.projectName,
        projectId: alert.projectId,
        title: `High Risk Test File Detected`,
        description: `Test file ${alert.filePath} has a ${alert.riskLevel} risk level (${(alert.riskScore * 100).toFixed(1)}% chance of becoming flaky)`,
        severity: alert.riskLevel as 'low' | 'medium' | 'high' | 'critical',
        data: {
          filePath: alert.filePath,
          riskScore: alert.riskScore,
          riskLevel: alert.riskLevel,
          predictedFailureTypes: alert.predictedFailureTypes,
          confidence: alert.confidence,
          estimatedTimeToFlaky: alert.estimatedTimeToFlaky,
        },
        timestamp: new Date(),
        dashboardUrl: `${process.env.FRONTEND_URL}/projects/${alert.projectId}?tab=ai-flaky-tests`,
      };

      await IntegrationService.sendAlert(alert.projectId, integrationAlert);
      
      // For now, we'll just log the alert
      await this.logAlert(alert, userEmail);

      // Mock email sending
      await this.sendEmailAlert(alert, userEmail);

      // Mock webhook sending
      await this.sendWebhookAlert(alert);

    } catch (error) {
      logger.error('Error sending high-risk alert:', error);
    }
  }

  public async sendDailySummary(summary: DailySummary, userEmail: string): Promise<void> {
    try {
      logger.info(`Sending daily summary for project ${summary.projectName}`);

      // Send to configured integrations
      const integrationAlert: AlertPayload = {
        type: 'daily_summary',
        projectName: summary.projectName,
        projectId: summary.projectId,
        title: `Daily Flaky Test Summary`,
        description: `${summary.newHighRiskFiles} new high-risk files detected. Total files analyzed: ${summary.totalFiles}. Average risk score: ${(summary.averageRiskScore * 100).toFixed(1)}%`,
        severity: summary.newHighRiskFiles > 0 ? 'medium' : 'low',
        data: {
          totalFiles: summary.totalFiles,
          newHighRiskFiles: summary.newHighRiskFiles,
          averageRiskScore: summary.averageRiskScore,
          topRiskyFiles: summary.topRiskyFiles,
        },
        timestamp: new Date(),
        dashboardUrl: `${process.env.FRONTEND_URL}/projects/${summary.projectId}`,
      };

      await IntegrationService.sendAlert(summary.projectId, integrationAlert);

      // Mock email sending
      await this.sendSummaryEmail(summary, userEmail);

    } catch (error) {
      logger.error('Error sending daily summary:', error);
    }
  }

  public async sendFlakyTestAlert(
    projectId: string,
    projectName: string,
    testName: string,
    testSuite: string | null,
    failureRate: number,
    confidence: number
  ): Promise<void> {
    try {
      logger.info(`Sending flaky test alert for ${testName} in project ${projectName}`);

      const severity = failureRate > 0.7 ? 'high' : failureRate > 0.4 ? 'medium' : 'low';

      const integrationAlert: AlertPayload = {
        type: 'flaky_test_detected',
        projectName,
        projectId,
        title: `Flaky Test Detected: ${testName}`,
        description: `Test "${testName}" has been identified as flaky with a ${(failureRate * 100).toFixed(1)}% failure rate and ${(confidence * 100).toFixed(1)}% confidence.`,
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
        data: {
          testName,
          testSuite,
          failureRate: failureRate * 100,
          confidence: confidence * 100,
        },
        timestamp: new Date(),
        dashboardUrl: `${process.env.FRONTEND_URL}/projects/${projectId}?tab=flaky-tests`,
      };

      await IntegrationService.sendAlert(projectId, integrationAlert);

    } catch (error) {
      logger.error('Error sending flaky test alert:', error);
    }
  }

  public async sendQuarantineAlert(
    projectId: string,
    projectName: string,
    testName: string,
    testSuite: string | null,
    reason: string,
    failureRate: number
  ): Promise<void> {
    try {
      logger.info(`Sending quarantine alert for ${testName} in project ${projectName}`);

      const integrationAlert: AlertPayload = {
        type: 'quarantine_triggered',
        projectName,
        projectId,
        title: `Test Quarantined: ${testName}`,
        description: `Test "${testName}" has been automatically quarantined due to ${reason}. Failure rate: ${(failureRate * 100).toFixed(1)}%`,
        severity: 'medium',
        data: {
          testName,
          testSuite,
          reason,
          failureRate: failureRate * 100,
        },
        timestamp: new Date(),
        dashboardUrl: `${process.env.FRONTEND_URL}/projects/${projectId}?tab=quarantine`,
      };

      await IntegrationService.sendAlert(projectId, integrationAlert);

    } catch (error) {
      logger.error('Error sending quarantine alert:', error);
    }
  }

  public async sendCriticalPatternAlert(
    projectId: string,
    projectName: string,
    patternType: string,
    affectedRepos: number,
    severity: string,
    estimatedCost: number
  ): Promise<void> {
    try {
      logger.info(`Sending critical pattern alert for project ${projectName}`);

      const integrationAlert: AlertPayload = {
        type: 'critical_pattern',
        projectName,
        projectId,
        title: `Critical Cross-Repository Pattern Detected`,
        description: `A ${severity} ${patternType} pattern has been detected affecting ${affectedRepos} repositories with an estimated cost impact of $${estimatedCost}.`,
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
        data: {
          patternType,
          affectedRepos,
          estimatedCost,
        },
        timestamp: new Date(),
        dashboardUrl: `${process.env.FRONTEND_URL}/projects/${projectId}?tab=ai-flaky-tests`,
      };

      await IntegrationService.sendAlert(projectId, integrationAlert);

    } catch (error) {
      logger.error('Error sending critical pattern alert:', error);
    }
  }

  public async checkForHighRiskFiles(): Promise<void> {
    try {
      // Get all projects with recent predictions
      const projects = await prisma.project.findMany({
        include: {
          user: true,
          predictiveAnalyses: {
            where: {
              OR: [
                { riskLevel: 'high' },
                { riskLevel: 'critical' }
              ],
              analysisDate: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            },
            orderBy: {
              riskScore: 'desc'
            },
            take: 5
          }
        }
      });

      for (const project of projects) {
        if (project.predictiveAnalyses.length > 0) {
          for (const analysis of project.predictiveAnalyses) {
            const alert: HighRiskAlert = {
              projectId: project.id,
              projectName: project.name,
              filePath: analysis.testFilePath,
              riskScore: analysis.riskScore,
              riskLevel: analysis.riskLevel,
              predictedFailureTypes: analysis.predictedFailureTypes,
              confidence: analysis.confidence,
              estimatedTimeToFlaky: analysis.estimatedTimeToFlaky || undefined
            };

            await this.sendHighRiskAlert(alert, project.user.email);
          }
        }
      }

    } catch (error) {
      logger.error('Error checking for high-risk files:', error);
    }
  }

  public async generateDailySummaries(): Promise<void> {
    try {
      // Get all projects with predictions from the last 24 hours
      const projects = await prisma.project.findMany({
        include: {
          user: true,
          predictiveAnalyses: {
            where: {
              analysisDate: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          }
        }
      });

      for (const project of projects) {
        if (project.predictiveAnalyses.length > 0) {
          const analyses = project.predictiveAnalyses;
          const highRiskFiles = analyses.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical');
          const averageRiskScore = analyses.reduce((sum, a) => sum + a.riskScore, 0) / analyses.length;

          const summary: DailySummary = {
            projectId: project.id,
            projectName: project.name,
            totalFiles: analyses.length,
            newHighRiskFiles: highRiskFiles.length,
            averageRiskScore: Math.round(averageRiskScore * 100) / 100,
            topRiskyFiles: analyses
              .sort((a, b) => b.riskScore - a.riskScore)
              .slice(0, 5)
              .map(a => ({
                filePath: a.testFilePath,
                riskScore: a.riskScore,
                riskLevel: a.riskLevel
              }))
          };

          await this.sendDailySummary(summary, project.user.email);
        }
      }

    } catch (error) {
      logger.error('Error generating daily summaries:', error);
    }
  }

  private async logAlert(alert: HighRiskAlert, userEmail: string): Promise<void> {
    logger.info('HIGH RISK ALERT', {
      userEmail,
      projectName: alert.projectName,
      filePath: alert.filePath,
      riskScore: alert.riskScore,
      riskLevel: alert.riskLevel,
      confidence: alert.confidence,
      predictedFailureTypes: alert.predictedFailureTypes,
      estimatedTimeToFlaky: alert.estimatedTimeToFlaky
    });
  }

  private async sendEmailAlert(alert: HighRiskAlert, userEmail: string): Promise<void> {
    // Mock email implementation
    const emailSubject = `🚨 High Risk Test Detected: ${alert.filePath}`;
    const emailBody = `
    High Risk Test File Detected

    Project: ${alert.projectName}
    File: ${alert.filePath}
    Risk Level: ${alert.riskLevel.toUpperCase()}
    Risk Score: ${alert.riskScore}/1.0
    Confidence: ${Math.round(alert.confidence * 100)}%
    
    Predicted Issues:
    ${alert.predictedFailureTypes.map(type => `- ${type.replace(/_/g, ' ')}`).join('\n')}
    
    ${alert.estimatedTimeToFlaky ? `Estimated time until flaky: ${alert.estimatedTimeToFlaky} days` : ''}
    
    Recommendations:
    - Review the test file for timing dependencies
    - Check for external service calls that need mocking
    - Ensure proper test isolation
    - Consider refactoring complex test logic
    
    View details: ${process.env.FRONTEND_URL}/projects/${alert.projectId}/predictions
    `;

    logger.info(`[EMAIL] To: ${userEmail}, Subject: ${emailSubject}`);
    logger.debug(`[EMAIL] Body: ${emailBody}`);

    // In production, integrate with email service:
    // await emailService.send({
    //   to: userEmail,
    //   subject: emailSubject,
    //   text: emailBody,
    //   html: generateEmailHTML(alert)
    // });
  }

  private async sendWebhookAlert(alert: HighRiskAlert): Promise<void> {
    // Mock webhook implementation
    const webhookPayload = {
      type: 'high_risk_test_detected',
      timestamp: new Date().toISOString(),
      project: {
        id: alert.projectId,
        name: alert.projectName
      },
      test: {
        filePath: alert.filePath,
        riskScore: alert.riskScore,
        riskLevel: alert.riskLevel,
        confidence: alert.confidence,
        predictedFailureTypes: alert.predictedFailureTypes,
        estimatedTimeToFlaky: alert.estimatedTimeToFlaky
      }
    };

    logger.info('[WEBHOOK] High risk alert payload:', webhookPayload);

    // In production, send to configured webhook URLs:
    // const webhookUrl = await this.getWebhookUrl(alert.projectId);
    // if (webhookUrl) {
    //   await axios.post(webhookUrl, webhookPayload, {
    //     headers: { 'Content-Type': 'application/json' }
    //   });
    // }
  }

  private async sendSummaryEmail(summary: DailySummary, userEmail: string): Promise<void> {
    const emailSubject = `📊 Daily Flaky Test Report: ${summary.projectName}`;
    const emailBody = `
    Daily Flaky Test Summary

    Project: ${summary.projectName}
    Date: ${new Date().toLocaleDateString()}
    
    Summary:
    - Total files analyzed: ${summary.totalFiles}
    - New high-risk files: ${summary.newHighRiskFiles}
    - Average risk score: ${summary.averageRiskScore}/1.0
    
    Top Risky Files:
    ${summary.topRiskyFiles.map((file, index) => 
      `${index + 1}. ${file.filePath} (${file.riskScore.toFixed(2)} - ${file.riskLevel.toUpperCase()})`
    ).join('\n')}
    
    ${summary.newHighRiskFiles > 0 ? 
      '⚠️ Action Required: Review high-risk files to prevent future flaky test issues.' : 
      '✅ Good news: No new high-risk test files detected today.'
    }
    
    View full report: ${process.env.FRONTEND_URL}/projects/${summary.projectId}/predictions
    `;

    logger.info(`[EMAIL SUMMARY] To: ${userEmail}, Subject: ${emailSubject}`);
    logger.debug(`[EMAIL SUMMARY] Body: ${emailBody}`);
  }

  public async scheduleNotifications(): Promise<void> {
    // This would typically be called by a cron job or scheduler
    logger.info('Running scheduled notification checks...');

    await Promise.all([
      this.checkForHighRiskFiles(),
      this.generateDailySummaries()
    ]);

    logger.info('Scheduled notification checks completed');
  }
}