import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

interface SubscriptionLimits {
  maxProjects: number;
  maxMembers: number;
  maxTeams: number;
  features: string[];
}

export class SubscriptionEnforcementService {
  private static readonly PLAN_LIMITS: Record<string, SubscriptionLimits> = {
    starter: {
      maxProjects: 5,
      maxMembers: 3,
      maxTeams: 2,
      features: ['basic_analytics', 'email_notifications'],
    },
    team: {
      maxProjects: 15,
      maxMembers: 10,
      maxTeams: 5,
      features: ['basic_analytics', 'email_notifications', 'advanced_analytics', 'integrations'],
    },
    enterprise: {
      maxProjects: 999,
      maxMembers: 999,
      maxTeams: 50,
      features: ['basic_analytics', 'email_notifications', 'advanced_analytics', 'integrations', 'custom_rules', 'priority_support'],
    },
  };

  static async getUserOrganization(userId: string): Promise<any> {
    try {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId },
        include: {
          organization: {
            include: {
              members: true,
              teams: true,
            },
          },
        },
      });

      return membership?.organization || null;
    } catch (error) {
      logger.error('Failed to get user organization', { error, userId });
      return null;
    }
  }

  static getLimitsForPlan(plan: string): SubscriptionLimits {
    return this.PLAN_LIMITS[plan] || this.PLAN_LIMITS.starter;
  }

  static async checkProjectLimit(organizationId: string): Promise<boolean> {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          _count: {
            select: { teams: true },
          },
        },
      });

      if (!organization) {
        return false;
      }

      const limits = this.getLimitsForPlan(organization.plan);
      const currentProjects = await prisma.project.count({
        where: {
          team: {
            organizationId: organizationId,
          },
        },
      });

      return currentProjects < limits.maxProjects;
    } catch (error) {
      logger.error('Failed to check project limit', { error, organizationId });
      return false;
    }
  }

  static async checkMemberLimit(organizationId: string): Promise<boolean> {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      if (!organization) {
        return false;
      }

      const limits = this.getLimitsForPlan(organization.plan);
      return organization._count.members < limits.maxMembers;
    } catch (error) {
      logger.error('Failed to check member limit', { error, organizationId });
      return false;
    }
  }

  static async checkTeamLimit(organizationId: string): Promise<boolean> {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          _count: {
            select: { teams: true },
          },
        },
      });

      if (!organization) {
        return false;
      }

      const limits = this.getLimitsForPlan(organization.plan);
      return organization._count.teams < limits.maxTeams;
    } catch (error) {
      logger.error('Failed to check team limit', { error, organizationId });
      return false;
    }
  }

  static async checkFeatureAccess(organizationId: string, feature: string): Promise<boolean> {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return false;
      }

      const limits = this.getLimitsForPlan(organization.plan);
      return limits.features.includes(feature);
    } catch (error) {
      logger.error('Failed to check feature access', { error, organizationId, feature });
      return false;
    }
  }
}

// Middleware to enforce project creation limits
export const enforceProjectLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const organization = await SubscriptionEnforcementService.getUserOrganization(userId);

    if (!organization) {
      return res.status(403).json({ 
        error: 'Organization not found',
        code: 'NO_ORGANIZATION' 
      });
    }

    const canCreateProject = await SubscriptionEnforcementService.checkProjectLimit(organization.id);

    if (!canCreateProject) {
      const limits = SubscriptionEnforcementService.getLimitsForPlan(organization.plan);
      return res.status(403).json({
        error: 'Project limit exceeded',
        code: 'PROJECT_LIMIT_EXCEEDED',
        currentPlan: organization.plan,
        limit: limits.maxProjects,
        upgradeRequired: true,
      });
    }

    next();
  } catch (error) {
    logger.error('Project limit enforcement failed', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to enforce member invitation limits
export const enforceMemberLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.params;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const canAddMember = await SubscriptionEnforcementService.checkMemberLimit(organizationId);

    if (!canAddMember) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const limits = SubscriptionEnforcementService.getLimitsForPlan(organization.plan);
      return res.status(403).json({
        error: 'Member limit exceeded',
        code: 'MEMBER_LIMIT_EXCEEDED',
        currentPlan: organization.plan,
        limit: limits.maxMembers,
        upgradeRequired: true,
      });
    }

    next();
  } catch (error) {
    logger.error('Member limit enforcement failed', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to enforce team creation limits
export const enforceTeamLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const canCreateTeam = await SubscriptionEnforcementService.checkTeamLimit(organizationId);

    if (!canCreateTeam) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const limits = SubscriptionEnforcementService.getLimitsForPlan(organization.plan);
      return res.status(403).json({
        error: 'Team limit exceeded',
        code: 'TEAM_LIMIT_EXCEEDED',
        currentPlan: organization.plan,
        limit: limits.maxTeams,
        upgradeRequired: true,
      });
    }

    next();
  } catch (error) {
    logger.error('Team limit enforcement failed', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to enforce feature access
export const enforceFeatureAccess = (requiredFeature: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const organization = await SubscriptionEnforcementService.getUserOrganization(userId);

      if (!organization) {
        return res.status(403).json({ 
          error: 'Organization not found',
          code: 'NO_ORGANIZATION' 
        });
      }

      const hasAccess = await SubscriptionEnforcementService.checkFeatureAccess(organization.id, requiredFeature);

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Feature not available',
          code: 'FEATURE_NOT_AVAILABLE',
          feature: requiredFeature,
          currentPlan: organization.plan,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      logger.error('Feature access enforcement failed', { error, feature: requiredFeature });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Middleware to check subscription status
export const enforceActiveSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const organization = await SubscriptionEnforcementService.getUserOrganization(userId);

    if (!organization) {
      return res.status(403).json({ 
        error: 'Organization not found',
        code: 'NO_ORGANIZATION' 
      });
    }

    // Check if subscription is active
    if (!organization.isActive || organization.subscriptionStatus === 'cancelled') {
      return res.status(403).json({
        error: 'Subscription inactive',
        code: 'SUBSCRIPTION_INACTIVE',
        subscriptionStatus: organization.subscriptionStatus,
        paymentRequired: true,
      });
    }

    // Check if subscription is past due
    if (organization.subscriptionStatus === 'past_due') {
      return res.status(403).json({
        error: 'Payment overdue',
        code: 'PAYMENT_OVERDUE',
        subscriptionStatus: organization.subscriptionStatus,
        paymentRequired: true,
      });
    }

    next();
  } catch (error) {
    logger.error('Subscription status enforcement failed', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to get usage statistics for an organization
export const getOrganizationUsage = async (organizationId: string) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            members: true,
            teams: true,
          },
        },
      },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const projectCount = await prisma.project.count({
      where: {
        team: {
          organizationId: organizationId,
        },
      },
    });

    const limits = SubscriptionEnforcementService.getLimitsForPlan(organization.plan);

    return {
      plan: organization.plan,
      limits,
      usage: {
        members: organization._count.members,
        teams: organization._count.teams,
        projects: projectCount,
      },
      percentages: {
        members: Math.round((organization._count.members / limits.maxMembers) * 100),
        teams: Math.round((organization._count.teams / limits.maxTeams) * 100),
        projects: Math.round((projectCount / limits.maxProjects) * 100),
      },
      subscriptionStatus: organization.subscriptionStatus,
      isActive: organization.isActive,
    };
  } catch (error) {
    logger.error('Failed to get organization usage', { error, organizationId });
    throw error;
  }
};