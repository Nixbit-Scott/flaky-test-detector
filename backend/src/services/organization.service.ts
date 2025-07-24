import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { CreateOrganizationRequest, UpdateOrganizationRequest } from '../../../shared/dist/index.js';

const prisma = new PrismaClient();

export class OrganizationService {
  async createOrganization(data: CreateOrganizationRequest, ownerId: string) {
    try {
      const organization = await prisma.organization.create({
        data: {
          name: data.name,
          domain: data.domain,
          billingEmail: data.billingEmail,
          plan: data.plan,
          maxProjects: this.getMaxProjectsForPlan(data.plan),
          maxMembers: this.getMaxMembersForPlan(data.plan),
          members: {
            create: {
              userId: ownerId,
              role: 'owner',
            },
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          teams: true,
        },
      });

      logger.info('Organization created', { 
        organizationId: organization.id, 
        ownerId,
        plan: data.plan 
      });

      return organization;
    } catch (error) {
      logger.error('Failed to create organization', { error, data, ownerId });
      throw error;
    }
  }

  async getOrganization(organizationId: string) {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          teams: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      return organization;
    } catch (error) {
      logger.error('Failed to get organization', { error, organizationId });
      throw error;
    }
  }

  async updateOrganization(organizationId: string, data: UpdateOrganizationRequest) {
    try {
      const updateData: any = {
        ...data,
      };

      // Update limits if plan changed
      if (data.plan) {
        updateData.maxProjects = this.getMaxProjectsForPlan(data.plan);
        updateData.maxMembers = this.getMaxMembersForPlan(data.plan);
      }

      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
        include: {
          members: {
            include: {
              user: true,
            },
          },
          teams: true,
        },
      });

      logger.info('Organization updated', { organizationId, data });

      return organization;
    } catch (error) {
      logger.error('Failed to update organization', { error, organizationId, data });
      throw error;
    }
  }

  async deleteOrganization(organizationId: string) {
    try {
      await prisma.organization.delete({
        where: { id: organizationId },
      });

      logger.info('Organization deleted', { organizationId });
    } catch (error) {
      logger.error('Failed to delete organization', { error, organizationId });
      throw error;
    }
  }

  async getUserOrganizations(userId: string) {
    try {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId },
        include: {
          organization: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
              teams: true,
            },
          },
        },
      });

      return memberships.map(m => m.organization);
    } catch (error) {
      logger.error('Failed to get user organizations', { error, userId });
      throw error;
    }
  }

  async addMember(organizationId: string, userId: string, role: 'admin' | 'member' = 'member') {
    try {
      // Check if organization has space for new member
      const organization = await this.getOrganization(organizationId);
      if (organization.members.length >= organization.maxMembers) {
        throw new Error('Organization has reached maximum member limit');
      }

      const member = await prisma.organizationMember.create({
        data: {
          userId,
          organizationId,
          role,
        },
        include: {
          user: true,
        },
      });

      logger.info('Member added to organization', { organizationId, userId, role });

      return member;
    } catch (error) {
      logger.error('Failed to add member to organization', { error, organizationId, userId });
      throw error;
    }
  }

  async removeMember(organizationId: string, userId: string) {
    try {
      await prisma.organizationMember.delete({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });

      logger.info('Member removed from organization', { organizationId, userId });
    } catch (error) {
      logger.error('Failed to remove member from organization', { error, organizationId, userId });
      throw error;
    }
  }

  async updateMemberRole(organizationId: string, userId: string, role: 'owner' | 'admin' | 'member') {
    try {
      const member = await prisma.organizationMember.update({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        data: { role },
        include: {
          user: true,
        },
      });

      logger.info('Member role updated', { organizationId, userId, role });

      return member;
    } catch (error) {
      logger.error('Failed to update member role', { error, organizationId, userId, role });
      throw error;
    }
  }

  async checkMemberPermission(organizationId: string, userId: string, requiredRole: 'owner' | 'admin' | 'member') {
    try {
      const member = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });

      if (!member) {
        return false;
      }

      const roleHierarchy = { owner: 3, admin: 2, member: 1 };
      return roleHierarchy[member.role as keyof typeof roleHierarchy] >= roleHierarchy[requiredRole];
    } catch (error) {
      logger.error('Failed to check member permission', { error, organizationId, userId, requiredRole });
      return false;
    }
  }

  private getMaxProjectsForPlan(plan: string): number {
    switch (plan) {
      case 'starter':
        return 5;
      case 'team':
        return 15;
      case 'enterprise':
        return 100;
      default:
        return 5;
    }
  }

  private getMaxMembersForPlan(plan: string): number {
    switch (plan) {
      case 'starter':
        return 3;
      case 'team':
        return 10;
      case 'enterprise':
        return 100;
      default:
        return 3;
    }
  }
}

export const organizationService = new OrganizationService();