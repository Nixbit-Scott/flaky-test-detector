import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { addDays } from 'date-fns';
import { logger } from '../utils/logger';
import { InviteUserRequest, AcceptInvitationRequest } from '../../../shared/dist/index.js';
import { organizationService } from './organization.service';
import { userService } from './user.service';

const prisma = new PrismaClient();

export class InvitationService {
  async inviteUser(organizationId: string, data: InviteUserRequest, invitedBy: string) {
    try {
      // Check if organization has space for new member
      const organization = await organizationService.getOrganization(organizationId);
      if (organization.members.length >= organization.maxMembers) {
        throw new Error('Organization has reached maximum member limit');
      }

      // Check if user is already a member
      const existingUser = await userService.findByEmail(data.email);
      if (existingUser) {
        const existingMember = await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId,
            },
          },
        });

        if (existingMember) {
          throw new Error('User is already a member of this organization');
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email: data.email,
          organizationId,
          status: 'pending',
        },
      });

      if (existingInvitation) {
        throw new Error('Invitation already sent to this email');
      }

      // Create invitation
      const token = this.generateInvitationToken();
      const expiresAt = addDays(new Date(), 7); // 7 days expiry

      const invitation = await prisma.invitation.create({
        data: {
          email: data.email,
          organizationId,
          teamId: data.teamId,
          role: data.role,
          token,
          invitedBy,
          expiresAt,
        },
        include: {
          organization: true,
        },
      });

      // TODO: Send invitation email
      await this.sendInvitationEmail(invitation);

      logger.info('User invited to organization', {
        invitationId: invitation.id,
        email: data.email,
        organizationId,
        invitedBy,
      });

      return invitation;
    } catch (error) {
      logger.error('Failed to invite user', { error, organizationId, data, invitedBy });
      throw error;
    }
  }

  async acceptInvitation(token: string, data: AcceptInvitationRequest) {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new Error('Invalid invitation token');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Invitation has already been processed');
      }

      if (new Date() > invitation.expiresAt) {
        throw new Error('Invitation has expired');
      }

      // Check if user exists
      let user = await userService.findByEmail(invitation.email);

      // If user doesn't exist and name/password provided, create new user
      if (!user && data.name && data.password) {
        user = await userService.createUser({
          email: invitation.email,
          name: data.name,
          password: data.password,
        });
      } else if (!user) {
        throw new Error('User not found. Please provide name and password to create account.');
      }

      // Add user to organization
      await organizationService.addMember(invitation.organizationId, user.id, invitation.role as 'admin' | 'member');

      // Add user to specific team if specified
      if (invitation.teamId) {
        await prisma.teamMember.create({
          data: {
            userId: user.id,
            teamId: invitation.teamId,
            role: invitation.role === 'admin' ? 'admin' : 'member',
          },
        });
      }

      // Update invitation status
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });

      logger.info('Invitation accepted', {
        invitationId: invitation.id,
        userId: user.id,
        organizationId: invitation.organizationId,
      });

      return { user, organization: invitation.organization };
    } catch (error) {
      logger.error('Failed to accept invitation', { error, token });
      throw error;
    }
  }

  async getInvitation(token: string) {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new Error('Invalid invitation token');
      }

      return invitation;
    } catch (error) {
      logger.error('Failed to get invitation', { error, token });
      throw error;
    }
  }

  async getOrganizationInvitations(organizationId: string) {
    try {
      const invitations = await prisma.invitation.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      return invitations;
    } catch (error) {
      logger.error('Failed to get organization invitations', { error, organizationId });
      throw error;
    }
  }

  async cancelInvitation(invitationId: string) {
    try {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'declined' },
      });

      logger.info('Invitation cancelled', { invitationId });
    } catch (error) {
      logger.error('Failed to cancel invitation', { error, invitationId });
      throw error;
    }
  }

  async resendInvitation(invitationId: string) {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only resend pending invitations');
      }

      // Update expiry date
      const expiresAt = addDays(new Date(), 7);
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { expiresAt },
      });

      // Resend email
      await this.sendInvitationEmail(invitation);

      logger.info('Invitation resent', { invitationId });
    } catch (error) {
      logger.error('Failed to resend invitation', { error, invitationId });
      throw error;
    }
  }

  private generateInvitationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async sendInvitationEmail(invitation: any) {
    // TODO: Implement email sending using your preferred email service
    // For now, just log the invitation details
    logger.info('Invitation email would be sent', {
      to: invitation.email,
      organizationName: invitation.organization.name,
      invitationLink: `${process.env.FRONTEND_URL}/invite/${invitation.token}`,
    });

    // Example implementation with nodemailer:
    /*
    const transporter = nodemailer.createTransporter({
      // email config
    });

    await transporter.sendMail({
      to: invitation.email,
      subject: `You're invited to join ${invitation.organization.name}`,
      html: `
        <h2>You've been invited to join ${invitation.organization.name}</h2>
        <p>Click the link below to accept your invitation:</p>
        <a href="${process.env.FRONTEND_URL}/invite/${invitation.token}">
          Accept Invitation
        </a>
        <p>This invitation expires in 7 days.</p>
      `,
    });
    */
  }
}

export const invitationService = new InvitationService();