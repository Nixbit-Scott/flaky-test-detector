import * as cron from 'node-cron';
import { prisma } from './database.service';
import { QuarantineService } from './quarantine.service';
import { logger } from '../utils/logger';

export class QuarantineSchedulerService {
  private static scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize quarantine automation scheduling
   */
  static async initializeScheduling(): Promise<void> {
    try {
      // Schedule daily quarantine evaluation for all projects with automation enabled
      cron.schedule('0 2 * * *', async () => { // Run at 2 AM daily
        await this.runDailyQuarantineEvaluation();
      });

      // Schedule hourly unquarantine checks
      cron.schedule('0 * * * *', async () => { // Run every hour
        await this.runHourlyUnquarantineCheck();
      });

      logger.info('Quarantine automation scheduling initialized');
    } catch (error) {
      logger.error('Error initializing quarantine scheduling:', error);
    }
  }

  /**
   * Daily evaluation of all active flaky tests for quarantine
   */
  private static async runDailyQuarantineEvaluation(): Promise<void> {
    try {
      logger.info('Starting daily quarantine evaluation...');

      // Get all projects with automation enabled
      const projects = await prisma.project.findMany({
        where: {
          quarantineAutomationEnabled: true
        },
        select: {
          id: true,
          name: true
        }
      });

      let totalEvaluated = 0;
      let totalQuarantined = 0;

      for (const project of projects) {
        try {
          const flakyTests = await QuarantineService.getActiveFlakyTests(project.id);
          
          for (const test of flakyTests) {
            totalEvaluated++;
            const result = await QuarantineService.autoEvaluateAndQuarantine(
              project.id,
              test.testName,
              test.testSuite,
              test
            );

            if (result.quarantined) {
              totalQuarantined++;
              logger.info(`Auto-quarantined ${test.testName} in ${project.name}`);
            }
          }
        } catch (error) {
          logger.error(`Error evaluating project ${project.name}:`, error);
        }
      }

      logger.info(`Daily quarantine evaluation complete: ${totalQuarantined} quarantined out of ${totalEvaluated} evaluated tests across ${projects.length} projects`);
    } catch (error) {
      logger.error('Error in daily quarantine evaluation:', error);
    }
  }

  /**
   * Hourly check for tests that can be unquarantined
   */
  private static async runHourlyUnquarantineCheck(): Promise<void> {
    try {
      logger.info('Starting hourly unquarantine check...');

      // Get all projects with automation enabled
      const projects = await prisma.project.findMany({
        where: {
          quarantineAutomationEnabled: true
        },
        select: {
          id: true,
          name: true
        }
      });

      let totalUnquarantined = 0;

      for (const project of projects) {
        try {
          const unquarantinedCount = await QuarantineService.autoEvaluateUnquarantine(project.id);
          totalUnquarantined += unquarantinedCount;

          if (unquarantinedCount > 0) {
            logger.info(`Auto-unquarantined ${unquarantinedCount} tests in ${project.name}`);
          }
        } catch (error) {
          logger.error(`Error in unquarantine check for project ${project.name}:`, error);
        }
      }

      if (totalUnquarantined > 0) {
        logger.info(`Hourly unquarantine check complete: ${totalUnquarantined} tests unquarantined across ${projects.length} projects`);
      }
    } catch (error) {
      logger.error('Error in hourly unquarantine check:', error);
    }
  }

  /**
   * Enable automation for a specific project
   */
  static async enableProjectAutomation(projectId: string, schedule: string = 'on_test_failure'): Promise<void> {
    try {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          quarantineAutomationEnabled: true,
          quarantineSchedule: schedule
        }
      });

      // Create default policy if none exists
      await QuarantineService.createDefaultPolicy(projectId);

      logger.info(`Enabled quarantine automation for project ${projectId} with schedule: ${schedule}`);
    } catch (error) {
      logger.error(`Error enabling automation for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Disable automation for a specific project
   */
  static async disableProjectAutomation(projectId: string): Promise<void> {
    try {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          quarantineAutomationEnabled: false
        }
      });

      logger.info(`Disabled quarantine automation for project ${projectId}`);
    } catch (error) {
      logger.error(`Error disabling automation for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Get automation status for all projects
   */
  static async getAutomationStatus(): Promise<Array<{
    projectId: string;
    projectName: string;
    enabled: boolean;
    schedule: string;
    lastEvaluation?: Date;
    totalQuarantined: number;
    totalUnquarantined: number;
  }>> {
    try {
      const projects = await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          quarantineAutomationEnabled: true,
          quarantineSchedule: true,
          _count: {
            select: {
              flakyTestPatterns: {
                where: {
                  isQuarantined: true
                }
              }
            }
          }
        }
      });

      const status = await Promise.all(projects.map(async (project) => {
        // Get quarantine history stats
        const history = await prisma.quarantineHistory.findMany({
          where: {
            flakyTestPattern: {
              projectId: project.id
            },
            triggeredBy: 'auto',
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          select: {
            action: true,
            createdAt: true
          }
        });

        const totalQuarantined = history.filter(h => h.action === 'quarantined').length;
        const totalUnquarantined = history.filter(h => h.action === 'unquarantined').length;
        const lastEvaluation = history.length > 0 ? 
          new Date(Math.max(...history.map(h => h.createdAt.getTime()))) : 
          undefined;

        return {
          projectId: project.id,
          projectName: project.name,
          enabled: project.quarantineAutomationEnabled || false,
          schedule: project.quarantineSchedule || 'on_test_failure',
          lastEvaluation,
          totalQuarantined,
          totalUnquarantined
        };
      }));

      return status;
    } catch (error) {
      logger.error('Error getting automation status:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for immediate evaluation of a specific project
   */
  static async triggerImmediateEvaluation(projectId: string): Promise<{
    evaluated: number;
    quarantined: number;
    unquarantined: number;
  }> {
    try {
      logger.info(`Starting immediate quarantine evaluation for project ${projectId}`);

      // Run quarantine evaluation
      const flakyTests = await QuarantineService.getActiveFlakyTests(projectId);
      let quarantined = 0;

      for (const test of flakyTests) {
        const result = await QuarantineService.autoEvaluateAndQuarantine(
          projectId,
          test.testName,
          test.testSuite,
          test
        );

        if (result.quarantined) {
          quarantined++;
        }
      }

      // Run unquarantine evaluation
      const unquarantined = await QuarantineService.autoEvaluateUnquarantine(projectId);

      logger.info(`Immediate evaluation complete for project ${projectId}: ${quarantined} quarantined, ${unquarantined} unquarantined`);

      return {
        evaluated: flakyTests.length,
        quarantined,
        unquarantined
      };
    } catch (error) {
      logger.error(`Error in immediate evaluation for project ${projectId}:`, error);
      throw error;
    }
  }
}