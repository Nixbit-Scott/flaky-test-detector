import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { 
  AdminOverviewStats, 
  AdminOrganizationSummary, 
  AdminUserSummary, 
  PlatformMetrics,
  SystemHealth,
  SystemMetric 
} from '../../../shared/dist/index.js';

const prisma = new PrismaClient();

export class AdminService {
  // Dashboard Overview Stats
  static async getOverviewStats(): Promise<AdminOverviewStats> {
    try {
      const [
        totalOrganizations,
        activeUsers,
        testRunsToday,
        activeFlakyTests,
        systemMetrics
      ] = await Promise.all([
        prisma.organization.count(),
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        prisma.testRun.count({
          where: {
            startedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)) // Today
            }
          }
        }),
        prisma.flakyTestPattern.count({
          where: { isActive: true }
        }),
        prisma.systemMetric.findMany({
          where: {
            metricName: {
              in: ['monthly_recurring_revenue', 'system_uptime', 'average_response_time']
            },
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 3
        })
      ]);

      // Calculate MRR from organizations
      const organizations = await prisma.organization.findMany({
        where: { isActive: true },
        select: { plan: true }
      });

      const planPricing = {
        starter: 29,
        team: 99,
        enterprise: 299
      };

      const monthlyRecurringRevenue = organizations.reduce((total, org) => {
        return total + (planPricing[org.plan as keyof typeof planPricing] || 0);
      }, 0);

      return {
        totalOrganizations,
        activeUsers,
        testRunsToday,
        activeFlakyTests,
        monthlyRecurringRevenue,
        systemUptime: systemMetrics.find(m => m.metricName === 'system_uptime')?.value || 99.9,
        averageResponseTime: systemMetrics.find(m => m.metricName === 'average_response_time')?.value || 150
      };
    } catch (error) {
      logger.error('Failed to get overview stats', { error });
      throw error;
    }
  }

  // Platform Metrics
  static async getPlatformMetrics(): Promise<PlatformMetrics> {
    try {
      const [
        totalTestRuns,
        successfulTestRuns,
        totalOrganizations,
        activeOrganizations,
        currentMRR,
        lastMonthMRR
      ] = await Promise.all([
        prisma.testRun.count({
          where: {
            startedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.testRun.count({
          where: {
            status: 'completed',
            startedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.organization.count(),
        prisma.organization.count({
          where: {
            isActive: true,
            members: {
              some: {
                user: {
                  lastLoginAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            }
          }
        }),
        this.calculateMRR(),
        this.calculateMRR(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ]);

      const successRate = totalTestRuns > 0 ? (successfulTestRuns / totalTestRuns) * 100 : 0;
      const customerHealth = totalOrganizations > 0 ? (activeOrganizations / totalOrganizations) * 100 : 0;
      const revenueGrowth = lastMonthMRR > 0 ? ((currentMRR - lastMonthMRR) / lastMonthMRR) * 100 : 0;
      const churnRate = await this.calculateChurnRate();

      return {
        successRate,
        uptime: 99.9, // This should come from actual monitoring
        customerHealth,
        revenueGrowth,
        totalRevenue: currentMRR,
        churnRate
      };
    } catch (error) {
      logger.error('Failed to get platform metrics', { error });
      throw error;
    }
  }

  // Organization Management
  static async getAllOrganizations(
    page: number = 1, 
    limit: number = 50, 
    search?: string,
    status?: 'active' | 'inactive' | 'suspended'
  ) {
    try {
      const skip = (page - 1) * limit;
      
      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { billingEmail: { contains: search, mode: 'insensitive' } },
          { domain: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (status) {
        if (status === 'active') {
          where.isActive = true;
          where.subscriptionStatus = 'active';
        } else if (status === 'inactive') {
          where.OR = [
            { isActive: false },
            { subscriptionStatus: { in: ['cancelled', 'past_due'] } }
          ];
        }
      }

      const [organizations, total] = await Promise.all([
        prisma.organization.findMany({
          where,
          include: {
            members: {
              include: { user: true }
            },
            teams: {
              include: {
                projects: true
              }
            }
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.organization.count({ where })
      ]);

      const orgSummaries: AdminOrganizationSummary[] = organizations.map(org => {
        const projectCount = org.teams.reduce((total, team) => total + team.projects.length, 0);
        const lastActivity = org.members.reduce((latest, member) => {
          const userLastLogin = member.user.lastLoginAt;
          if (!userLastLogin) return latest;
          return !latest || userLastLogin > latest ? userLastLogin : latest;
        }, null as Date | null);

        return {
          id: org.id,
          name: org.name,
          plan: org.plan,
          memberCount: org.members.length,
          projectCount,
          healthScore: this.calculateOrganizationHealth(org, projectCount),
          monthlyRevenue: this.getPlanPrice(org.plan),
          status: org.isActive && org.subscriptionStatus === 'active' ? 'active' : 'inactive',
          lastActivity: lastActivity || org.createdAt
        };
      });

      return {
        organizations: orgSummaries,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get organizations', { error });
      throw error;
    }
  }

  static async suspendOrganization(organizationId: string, reason?: string) {
    try {
      const beforeState = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: { 
          isActive: false,
          subscriptionStatus: 'cancelled'
        }
      });

      return { organization, beforeState };
    } catch (error) {
      logger.error('Failed to suspend organization', { error, organizationId });
      throw error;
    }
  }

  static async reactivateOrganization(organizationId: string) {
    try {
      const beforeState = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: { 
          isActive: true,
          subscriptionStatus: 'active'
        }
      });

      return { organization, beforeState };
    } catch (error) {
      logger.error('Failed to reactivate organization', { error, organizationId });
      throw error;
    }
  }

  static async getOrganizationDetails(organizationId: string) {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  lastLoginAt: true
                }
              }
            }
          },
          teams: {
            include: {
              projects: {
                include: {
                  testRuns: {
                    take: 5,
                    orderBy: { startedAt: 'desc' }
                  },
                  flakyTests: {
                    where: { isActive: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      return organization;
    } catch (error) {
      logger.error('Failed to get organization details', { error, organizationId });
      throw error;
    }
  }

  // System Health
  static async getSystemHealth(): Promise<SystemHealth[]> {
    try {
      const healthRecords = await prisma.systemHealth.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 50
      });
      
      return healthRecords.map(record => ({
        ...record,
        status: record.status as 'healthy' | 'degraded' | 'unhealthy'
      }));
    } catch (error) {
      logger.error('Failed to get system health', { error });
      throw error;
    }
  }

  static async updateSystemHealth(serviceName: string, status: 'healthy' | 'degraded' | 'unhealthy', metadata?: any) {
    try {
      return await prisma.systemHealth.create({
        data: {
          serviceName,
          status,
          metadata,
          lastHealthyAt: status === 'healthy' ? new Date() : undefined,
          lastUnhealthyAt: status === 'unhealthy' ? new Date() : undefined
        }
      });
    } catch (error) {
      logger.error('Failed to update system health', { error });
      throw error;
    }
  }

  // System Metrics
  static async recordSystemMetric(
    metricName: string,
    value: number,
    metricType: 'count' | 'gauge' | 'histogram' = 'gauge',
    unit?: string,
    labels?: any
  ) {
    try {
      return await prisma.systemMetric.create({
        data: {
          metricName,
          metricType,
          value,
          unit,
          labels
        }
      });
    } catch (error) {
      logger.error('Failed to record system metric', { error });
      throw error;
    }
  }

  static async getSystemMetrics(
    metricNames: string[],
    timeRange: { from: Date; to: Date },
    intervalType: 'point' | 'hourly' | 'daily' | 'weekly' | 'monthly' = 'hourly'
  ) {
    try {
      return await prisma.systemMetric.findMany({
        where: {
          metricName: { in: metricNames },
          timestamp: {
            gte: timeRange.from,
            lte: timeRange.to
          },
          intervalType
        },
        orderBy: { timestamp: 'asc' }
      });
    } catch (error) {
      logger.error('Failed to get system metrics', { error });
      throw error;
    }
  }

  // Audit Logs
  static async getAuditLogs(
    page: number = 1,
    limit: number = 100,
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      category?: string;
      severity?: string;
      dateRange?: { from: Date; to: Date };
    }
  ) {
    try {
      const skip = (page - 1) * limit;
      
      const where: any = {};
      
      if (filters) {
        if (filters.userId) where.userId = filters.userId;
        if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
        if (filters.resourceType) where.resourceType = filters.resourceType;
        if (filters.category) where.category = filters.category;
        if (filters.severity) where.severity = filters.severity;
        if (filters.dateRange) {
          where.createdAt = {
            gte: filters.dateRange.from,
            lte: filters.dateRange.to
          };
        }
      }

      const [logs, total] = await Promise.all([
        prisma.adminAuditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.adminAuditLog.count({ where })
      ]);

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get audit logs', { error });
      throw error;
    }
  }

  // Helper methods
  private static calculateOrganizationHealth(org: any, projectCount: number): number {
    let score = 100;
    
    // Reduce score based on plan usage
    const planLimits = {
      starter: { projects: 5, members: 3 },
      team: { projects: 15, members: 10 },
      enterprise: { projects: 100, members: 100 }
    };
    
    const limits = planLimits[org.plan as keyof typeof planLimits];
    if (limits) {
      const projectUsage = projectCount / limits.projects;
      const memberUsage = org.members.length / limits.members;
      
      if (projectUsage > 0.9 || memberUsage > 0.9) score -= 20;
      else if (projectUsage > 0.7 || memberUsage > 0.7) score -= 10;
    }
    
    // Reduce score for inactive subscription
    if (!org.isActive || org.subscriptionStatus !== 'active') score -= 50;
    
    // Reduce score for no recent activity
    const hasRecentActivity = org.members.some((member: any) => 
      member.user.lastLoginAt && 
      member.user.lastLoginAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (!hasRecentActivity) score -= 30;
    
    return Math.max(0, score);
  }

  private static getPlanPrice(plan: string): number {
    const pricing = {
      starter: 29,
      team: 99,
      enterprise: 299
    };
    return pricing[plan as keyof typeof pricing] || 0;
  }

  private static async calculateMRR(asOfDate?: Date): Promise<number> {
    const where: any = { isActive: true };
    if (asOfDate) {
      where.createdAt = { lte: asOfDate };
    }

    const organizations = await prisma.organization.findMany({
      where,
      select: { plan: true }
    });

    return organizations.reduce((total, org) => {
      return total + this.getPlanPrice(org.plan);
    }, 0);
  }

  private static async calculateChurnRate(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [totalAtStart, cancelledInPeriod] = await Promise.all([
      prisma.organization.count({
        where: {
          createdAt: { lte: thirtyDaysAgo },
          isActive: true
        }
      }),
      prisma.organization.count({
        where: {
          updatedAt: { gte: thirtyDaysAgo },
          isActive: false
        }
      })
    ]);

    return totalAtStart > 0 ? (cancelledInPeriod / totalAtStart) * 100 : 0;
  }

  // Support Ticket Management
  static async getSupportTickets(
    page: number = 1,
    limit: number = 25,
    filters?: {
      status?: string;
      priority?: string;
      category?: string;
      search?: string;
      dateRange?: { from: Date; to: Date };
    }
  ) {
    try {
      const skip = (page - 1) * limit;
      
      const where: any = {};
      
      if (filters) {
        if (filters.status) where.status = filters.status;
        if (filters.priority) where.priority = filters.priority;
        if (filters.category) where.category = filters.category;
        if (filters.search) {
          where.OR = [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
            { customerEmail: { contains: filters.search, mode: 'insensitive' } },
            { ticketNumber: { contains: filters.search, mode: 'insensitive' } }
          ];
        }
        if (filters.dateRange) {
          where.createdAt = {
            gte: filters.dateRange.from,
            lte: filters.dateRange.to
          };
        }
      }

      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
          ]
        }),
        prisma.supportTicket.count({ where })
      ]);

      return {
        tickets,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get support tickets', { error });
      throw error;
    }
  }

  static async getSupportTicketById(id: string) {
    try {
      return await prisma.supportTicket.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Failed to get support ticket', { error, ticketId: id });
      throw error;
    }
  }

  static async createSupportTicket(data: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    customerEmail: string;
    organizationId?: string;
    userId?: string;
    source?: string;
    tags?: string[];
  }) {
    try {
      // Generate unique ticket number
      const ticketCount = await prisma.supportTicket.count();
      const ticketNumber = `FLAKY-${(ticketCount + 1).toString().padStart(6, '0')}`;

      return await prisma.supportTicket.create({
        data: {
          ...data,
          ticketNumber,
          firstResponseSla: this.getFirstResponseSLA(data.priority),
          resolutionSla: this.getResolutionSLA(data.priority)
        }
      });
    } catch (error) {
      logger.error('Failed to create support ticket', { error });
      throw error;
    }
  }

  static async updateSupportTicket(
    id: string, 
    data: {
      status?: string;
      priority?: string;
      assignedToUserId?: string;
      resolution?: string;
      tags?: string[];
    }
  ) {
    try {
      const updateData: any = { ...data };

      if (data.status === 'resolved' && !data.resolution) {
        throw new Error('Resolution is required when closing a ticket');
      }

      if (data.status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      return await prisma.supportTicket.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      logger.error('Failed to update support ticket', { error, ticketId: id });
      throw error;
    }
  }

  static async addFirstResponse(ticketId: string) {
    try {
      return await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          firstResponseAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to add first response', { error, ticketId });
      throw error;
    }
  }

  static async getSupportTicketStats() {
    try {
      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        urgentTickets,
        avgResponseTime,
        avgResolutionTime
      ] = await Promise.all([
        prisma.supportTicket.count(),
        prisma.supportTicket.count({ where: { status: 'open' } }),
        prisma.supportTicket.count({ where: { status: 'in_progress' } }),
        prisma.supportTicket.count({ where: { status: 'resolved' } }),
        prisma.supportTicket.count({ where: { priority: 'urgent', status: { not: 'resolved' } } }),
        this.calculateAverageResponseTime(),
        this.calculateAverageResolutionTime()
      ]);

      return {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        urgentTickets,
        avgResponseTime,
        avgResolutionTime
      };
    } catch (error) {
      logger.error('Failed to get support ticket stats', { error });
      throw error;
    }
  }

  private static getFirstResponseSLA(priority: string): number {
    // SLA in minutes
    switch (priority) {
      case 'urgent': return 60; // 1 hour
      case 'high': return 4 * 60; // 4 hours
      case 'medium': return 24 * 60; // 24 hours
      case 'low': return 48 * 60; // 48 hours
      default: return 24 * 60;
    }
  }

  private static getResolutionSLA(priority: string): number {
    // SLA in minutes
    switch (priority) {
      case 'urgent': return 4 * 60; // 4 hours
      case 'high': return 24 * 60; // 24 hours
      case 'medium': return 72 * 60; // 72 hours
      case 'low': return 7 * 24 * 60; // 7 days
      default: return 72 * 60;
    }
  }

  private static async calculateAverageResponseTime(): Promise<number> {
    try {
      const tickets = await prisma.supportTicket.findMany({
        where: {
          firstResponseAt: { not: null }
        },
        select: {
          createdAt: true,
          firstResponseAt: true
        }
      });

      if (tickets.length === 0) return 0;

      const totalResponseTime = tickets.reduce((total, ticket) => {
        const responseTime = ticket.firstResponseAt!.getTime() - ticket.createdAt.getTime();
        return total + responseTime;
      }, 0);

      return Math.round(totalResponseTime / tickets.length / (1000 * 60)); // Return in minutes
    } catch (error) {
      logger.error('Failed to calculate average response time', { error });
      return 0;
    }
  }

  private static async calculateAverageResolutionTime(): Promise<number> {
    try {
      const tickets = await prisma.supportTicket.findMany({
        where: {
          resolvedAt: { not: null }
        },
        select: {
          createdAt: true,
          resolvedAt: true
        }
      });

      if (tickets.length === 0) return 0;

      const totalResolutionTime = tickets.reduce((total, ticket) => {
        const resolutionTime = ticket.resolvedAt!.getTime() - ticket.createdAt.getTime();
        return total + resolutionTime;
      }, 0);

      return Math.round(totalResolutionTime / tickets.length / (1000 * 60)); // Return in minutes
    } catch (error) {
      logger.error('Failed to calculate average resolution time', { error });
      return 0;
    }
  }
}

export const adminService = new AdminService();