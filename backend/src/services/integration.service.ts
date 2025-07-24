import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SlackWebhookConfig {
  webhookUrl: string;
  channel: string;
  username?: string;
  iconEmoji?: string;
  enabled: boolean;
}

export interface TeamsWebhookConfig {
  webhookUrl: string;
  enabled: boolean;
}

export interface IntegrationConfig {
  id: string;
  projectId: string;
  name: string;
  type: 'slack' | 'teams';
  config: SlackWebhookConfig | TeamsWebhookConfig;
  alertTypes: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

export interface AlertPayload {
  type: 'flaky_test_detected' | 'critical_pattern' | 'quarantine_triggered' | 'daily_summary' | 'high_risk_alert';
  projectName: string;
  projectId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
  timestamp: Date;
  dashboardUrl?: string;
}

export class IntegrationService {
  
  /**
   * Send alert to Slack
   */
  static async sendSlackAlert(config: SlackWebhookConfig, alert: AlertPayload): Promise<void> {
    try {
      const slackMessage = this.formatSlackMessage(alert);
      
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: config.channel,
          username: config.username || 'Flaky Test Detector',
          icon_emoji: config.iconEmoji || ':warning:',
          ...slackMessage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack webhook failed: ${response.status} - ${errorText}`);
      }

      logger.info(`Slack alert sent successfully for project ${alert.projectId}`);
    } catch (error) {
      logger.error('Failed to send Slack alert:', error);
      throw error;
    }
  }

  /**
   * Send alert to Microsoft Teams
   */
  static async sendTeamsAlert(config: TeamsWebhookConfig, alert: AlertPayload): Promise<void> {
    try {
      const teamsMessage = this.formatTeamsMessage(alert);
      
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamsMessage),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Teams webhook failed: ${response.status} - ${errorText}`);
      }

      logger.info(`Teams alert sent successfully for project ${alert.projectId}`);
    } catch (error) {
      logger.error('Failed to send Teams alert:', error);
      throw error;
    }
  }

  /**
   * Send alert to all configured integrations for a project
   */
  static async sendAlert(projectId: string, alert: AlertPayload): Promise<void> {
    try {
      const integrations = await prisma.integration.findMany({
        where: {
          projectId,
          enabled: true,
          alertTypes: {
            has: alert.type,
          },
        },
      });

      const sendPromises = integrations.map(async (integration) => {
        try {
          if (integration.type === 'slack') {
            await this.sendSlackAlert(integration.config as unknown as SlackWebhookConfig, alert);
          } else if (integration.type === 'teams') {
            await this.sendTeamsAlert(integration.config as unknown as TeamsWebhookConfig, alert);
          }
        } catch (error) {
          logger.error(`Failed to send alert via ${integration.type} integration ${integration.id}:`, error);
        }
      });

      await Promise.all(sendPromises);
    } catch (error) {
      logger.error('Failed to send alerts:', error);
      throw error;
    }
  }

  /**
   * Create new integration
   */
  static async createIntegration(
    projectId: string,
    type: 'slack' | 'teams',
    config: SlackWebhookConfig | TeamsWebhookConfig,
    alertTypes: string[],
    name?: string
  ): Promise<IntegrationConfig> {
    try {
      const integration = await prisma.integration.create({
        data: {
          projectId,
          name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Integration`,
          type,
          config: config as any,
          alertTypes,
          enabled: true,
        },
      });

      logger.info(`Created ${type} integration for project ${projectId}`);
      return integration as unknown as IntegrationConfig;
    } catch (error) {
      logger.error('Failed to create integration:', error);
      throw error;
    }
  }

  /**
   * Update integration
   */
  static async updateIntegration(
    integrationId: string,
    updates: Partial<{
      name: string;
      config: SlackWebhookConfig | TeamsWebhookConfig;
      alertTypes: string[];
      enabled: boolean;
    }>
  ): Promise<IntegrationConfig> {
    try {
      const integration = await prisma.integration.update({
        where: { id: integrationId },
        data: {
          ...updates,
          config: updates.config as any,
          updatedAt: new Date(),
        },
      });

      logger.info(`Updated integration ${integrationId}`);
      return integration as unknown as IntegrationConfig;
    } catch (error) {
      logger.error('Failed to update integration:', error);
      throw error;
    }
  }

  /**
   * Delete integration
   */
  static async deleteIntegration(integrationId: string): Promise<void> {
    try {
      await prisma.integration.delete({
        where: { id: integrationId },
      });

      logger.info(`Deleted integration ${integrationId}`);
    } catch (error) {
      logger.error('Failed to delete integration:', error);
      throw error;
    }
  }

  /**
   * Get integrations for a project
   */
  static async getProjectIntegrations(projectId: string): Promise<IntegrationConfig[]> {
    try {
      const integrations = await prisma.integration.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      return integrations as unknown as IntegrationConfig[];
    } catch (error) {
      logger.error('Failed to get project integrations:', error);
      throw error;
    }
  }

  /**
   * Get integration by ID
   */
  static async getIntegrationById(integrationId: string): Promise<IntegrationConfig | null> {
    try {
      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });

      return integration as unknown as IntegrationConfig | null;
    } catch (error) {
      logger.error('Failed to get integration by ID:', error);
      throw error;
    }
  }

  /**
   * Test integration configuration
   */
  static async testIntegration(
    type: 'slack' | 'teams',
    config: SlackWebhookConfig | TeamsWebhookConfig
  ): Promise<void> {
    const testAlert: AlertPayload = {
      type: 'flaky_test_detected',
      projectName: 'Test Project',
      projectId: 'test-project-id',
      title: 'Test Alert',
      description: 'This is a test alert to verify your integration is working correctly.',
      severity: 'low',
      data: {},
      timestamp: new Date(),
    };

    if (type === 'slack') {
      await this.sendSlackAlert(config as SlackWebhookConfig, testAlert);
    } else if (type === 'teams') {
      await this.sendTeamsAlert(config as TeamsWebhookConfig, testAlert);
    }
  }

  /**
   * Format alert message for Slack
   */
  private static formatSlackMessage(alert: AlertPayload): any {
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);
    
    const attachment = {
      color,
      fields: [
        {
          title: 'Project',
          value: alert.projectName,
          short: true,
        },
        {
          title: 'Severity',
          value: `${emoji} ${alert.severity.toUpperCase()}`,
          short: true,
        },
        {
          title: 'Time',
          value: alert.timestamp.toLocaleString(),
          short: true,
        },
      ],
    };

    // Add specific fields based on alert type
    if (alert.type === 'flaky_test_detected' && alert.data.testName) {
      attachment.fields.push({
        title: 'Test Name',
        value: `\`${alert.data.testName}\``,
        short: false,
      });
    }

    if (alert.data.failureRate) {
      attachment.fields.push({
        title: 'Failure Rate',
        value: `${alert.data.failureRate}%`,
        short: true,
      });
    }

    if (alert.dashboardUrl) {
      attachment.fields.push({
        title: 'Dashboard',
        value: `<${alert.dashboardUrl}|View Details>`,
        short: false,
      });
    }

    return {
      text: `${emoji} *${alert.title}*`,
      attachments: [
        {
          ...attachment,
          text: alert.description,
        },
      ],
    };
  }

  /**
   * Format alert message for Microsoft Teams
   */
  private static formatTeamsMessage(alert: AlertPayload): any {
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);
    
    const facts = [
      {
        name: 'Project',
        value: alert.projectName,
      },
      {
        name: 'Severity',
        value: `${emoji} ${alert.severity.toUpperCase()}`,
      },
      {
        name: 'Time',
        value: alert.timestamp.toLocaleString(),
      },
    ];

    // Add specific facts based on alert type
    if (alert.type === 'flaky_test_detected' && alert.data.testName) {
      facts.push({
        name: 'Test Name',
        value: alert.data.testName,
      });
    }

    if (alert.data.failureRate) {
      facts.push({
        name: 'Failure Rate',
        value: `${alert.data.failureRate}%`,
      });
    }

    const card = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: color,
      summary: alert.title,
      sections: [
        {
          activityTitle: `${emoji} ${alert.title}`,
          activitySubtitle: alert.description,
          facts,
        },
      ],
    };

    if (alert.dashboardUrl) {
      (card as any).potentialAction = [
        {
          '@type': 'OpenUri',
          name: 'View Dashboard',
          targets: [
            {
              os: 'default',
              uri: alert.dashboardUrl,
            },
          ],
        },
      ];
    }

    return card;
  }

  /**
   * Get color based on severity
   */
  private static getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#dc3545';
      case 'high':
        return '#fd7e14';
      case 'medium':
        return '#ffc107';
      case 'low':
        return '#28a745';
      default:
        return '#6c757d';
    }
  }

  /**
   * Get emoji based on severity
   */
  private static getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return '💡';
      default:
        return '📊';
    }
  }
}

export default IntegrationService;