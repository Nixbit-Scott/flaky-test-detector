import { prisma } from './database.service';

export interface TeamData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  projectCount: number;
  role?: string; // Current user's role in the team
}

export interface TeamMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface CreateTeamRequest {
  name: string;
  organizationId: string;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'member';
}

export class TeamService {
  /**
   * Create a new team
   */
  static async createTeam(userId: string, request: CreateTeamRequest): Promise<TeamData> {
    const team = await prisma.$transaction(async (tx) => {
      // Create the team
      const newTeam = await tx.team.create({
        data: {
          name: request.name,
          organization: {
            connect: { id: request.organizationId }
          }
        },
      });

      // Add creator as owner
      await tx.teamMember.create({
        data: {
          userId,
          teamId: newTeam.id,
          role: 'owner',
        },
      });

      return newTeam;
    });

    return {
      id: team.id,
      name: team.name,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
      memberCount: 1,
      projectCount: 0,
      role: 'owner',
    };
  }

  /**
   * Get teams for a user
   */
  static async getUserTeams(userId: string): Promise<TeamData[]> {
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
              },
            },
          },
        },
      },
      orderBy: {
        team: {
          createdAt: 'desc',
        },
      },
    });

    return teamMemberships.map(membership => ({
      id: membership.team.id,
      name: membership.team.name,
      createdAt: membership.team.createdAt.toISOString(),
      updatedAt: membership.team.updatedAt.toISOString(),
      memberCount: membership.team._count.members,
      projectCount: membership.team._count.projects,
      role: membership.role as 'owner' | 'admin' | 'member',
    }));
  }

  /**
   * Get team details
   */
  static async getTeam(teamId: string, userId: string): Promise<TeamData & { members: TeamMember[] }> {
    // Check if user is a member of this team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!membership) {
      throw new Error('Team not found or access denied');
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            role: 'asc', // owners first, then admins, then members
          },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const members: TeamMember[] = team.members.map(member => ({
      id: member.id,
      userId: member.userId,
      userName: member.user.name || 'Unknown',
      userEmail: member.user.email,
      role: member.role as 'owner' | 'admin' | 'member',
      joinedAt: team.createdAt.toISOString(),
    }));

    return {
      id: team.id,
      name: team.name,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
      memberCount: team.members.length,
      projectCount: team._count.projects,
      role: membership.role as 'owner' | 'admin' | 'member',
      members,
    };
  }

  /**
   * Invite a member to the team
   */
  static async inviteMember(teamId: string, inviterId: string, request: InviteMemberRequest): Promise<{ invited: boolean; message: string }> {
    // Check if inviter has permission
    const inviterMembership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: inviterId,
          teamId,
        },
      },
    });

    if (!inviterMembership || !['owner', 'admin'].includes(inviterMembership.role)) {
      throw new Error('Insufficient permissions to invite members');
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: request.email },
    });

    if (!user) {
      // In a real app, you'd send an invitation email
      return {
        invited: false,
        message: 'User not found. An invitation email would be sent in production.',
      };
    }

    // Check if user is already a member
    const existingMembership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId,
        },
      },
    });

    if (existingMembership) {
      throw new Error('User is already a member of this team');
    }

    // Add user to team
    await prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId,
        role: request.role,
      },
    });

    return {
      invited: true,
      message: `${user.name || user.email} has been added to the team`,
    };
  }

  /**
   * Update member role
   */
  static async updateMemberRole(teamId: string, updaterId: string, memberId: string, newRole: 'admin' | 'member'): Promise<void> {
    // Check if updater has permission
    const updaterMembership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: updaterId,
          teamId,
        },
      },
    });

    if (!updaterMembership || updaterMembership.role !== 'owner') {
      throw new Error('Only team owners can update member roles');
    }

    // Get the member to update
    const memberToUpdate = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.teamId !== teamId) {
      throw new Error('Member not found');
    }

    if (memberToUpdate.role === 'owner') {
      throw new Error('Cannot change the role of team owner');
    }

    // Update the role
    await prisma.teamMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });
  }

  /**
   * Remove member from team
   */
  static async removeMember(teamId: string, removerId: string, memberId: string): Promise<void> {
    // Check if remover has permission
    const removerMembership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: removerId,
          teamId,
        },
      },
    });

    if (!removerMembership || !['owner', 'admin'].includes(removerMembership.role)) {
      throw new Error('Insufficient permissions to remove members');
    }

    // Get the member to remove
    const memberToRemove = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToRemove || memberToRemove.teamId !== teamId) {
      throw new Error('Member not found');
    }

    if (memberToRemove.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    // Remove the member
    await prisma.teamMember.delete({
      where: { id: memberId },
    });
  }

  /**
   * Leave team
   */
  static async leaveTeam(teamId: string, userId: string): Promise<void> {
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!membership) {
      throw new Error('You are not a member of this team');
    }

    if (membership.role === 'owner') {
      // Check if there are other members
      const memberCount = await prisma.teamMember.count({
        where: { teamId },
      });

      if (memberCount > 1) {
        throw new Error('Cannot leave team as owner. Transfer ownership or remove other members first.');
      }
    }

    // Remove membership
    await prisma.teamMember.delete({
      where: { id: membership.id },
    });

    // If this was the last member and they were the owner, delete the team
    if (membership.role === 'owner') {
      await prisma.team.delete({
        where: { id: teamId },
      });
    }
  }

  /**
   * Update team name
   */
  static async updateTeam(teamId: string, userId: string, updates: { name?: string }): Promise<TeamData> {
    // Check permissions
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions to update team');
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: updates,
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    return {
      id: updatedTeam.id,
      name: updatedTeam.name,
      createdAt: updatedTeam.createdAt.toISOString(),
      updatedAt: updatedTeam.updatedAt.toISOString(),
      memberCount: updatedTeam._count.members,
      projectCount: updatedTeam._count.projects,
      role: membership.role as 'owner' | 'admin' | 'member',
    };
  }

  /**
   * Get team projects
   */
  static async getTeamProjects(teamId: string, userId: string) {
    // Check if user is a member
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!membership) {
      throw new Error('Team not found or access denied');
    }

    const projects = await prisma.project.findMany({
      where: { teamId },
      include: {
        _count: {
          select: {
            testRuns: true,
            flakyTests: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map(project => ({
      id: project.id,
      name: project.name,
      repository: project.repository,
      branch: project.branch,
      createdAt: project.createdAt.toISOString(),
      testRuns: project._count.testRuns,
      flakyTests: project._count.flakyTests,
      retryEnabled: project.retryEnabled,
    }));
  }
}