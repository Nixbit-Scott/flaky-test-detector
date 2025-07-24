import { prisma } from './database.service';

export interface CreateProjectData {
  name: string;
  repository: string;
  branch?: string;
  userId: string;
  teamId?: string;
  // CI/CD Integration settings
  githubInstallationId?: string;
  gitlabProjectId?: string;
  jenkinsJobUrl?: string;
  // Flaky test settings
  retryEnabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  flakyThreshold?: number;
}

export interface UpdateProjectData {
  name?: string;
  repository?: string;
  branch?: string;
  // CI/CD Integration settings
  githubInstallationId?: string;
  gitlabProjectId?: string;
  jenkinsJobUrl?: string;
  // Flaky test settings
  retryEnabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  flakyThreshold?: number;
}

export class ProjectService {
  static async createProject(projectData: CreateProjectData) {
    const {
      name,
      repository,
      branch = 'main',
      userId,
      teamId,
      githubInstallationId,
      gitlabProjectId,
      jenkinsJobUrl,
      retryEnabled = true,
      maxRetries = 3,
      retryDelay = 30,
      flakyThreshold = 0.3,
    } = projectData;

    // Check if project with same repository already exists for user
    const existingProject = await prisma.project.findFirst({
      where: {
        repository,
        userId,
      },
    });

    if (existingProject) {
      throw new Error('Project with this repository already exists');
    }

    const project = await prisma.project.create({
      data: {
        name,
        repository,
        branch,
        userId,
        teamId,
        githubInstallationId,
        gitlabProjectId,
        jenkinsJobUrl,
        retryEnabled,
        maxRetries,
        retryDelay,
        flakyThreshold,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return project;
  }

  static async getProjectsByUser(userId: string) {
    const projects = await prisma.project.findMany({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            testRuns: true,
            flakyTests: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return projects;
  }

  static async getProjectById(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId, // Ensure user owns the project
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            testRuns: true,
            flakyTests: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    return project;
  }

  static async updateProject(projectId: string, userId: string, updateData: UpdateProjectData) {
    // First check if project exists and user owns it
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!existingProject) {
      throw new Error('Project not found or access denied');
    }

    const updatedProject = await prisma.project.update({
      where: {
        id: projectId,
      },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updatedProject;
  }

  static async deleteProject(projectId: string, userId: string) {
    // First check if project exists and user owns it
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!existingProject) {
      throw new Error('Project not found or access denied');
    }

    await prisma.project.delete({
      where: {
        id: projectId,
      },
    });

    return { message: 'Project deleted successfully' };
  }

  static async generateApiKey(projectId: string, userId: string, keyName: string) {
    // First check if project exists and user owns it
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!existingProject) {
      throw new Error('Project not found or access denied');
    }

    // Generate a random API key
    const apiKey = `ftd_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    const createdApiKey = await prisma.apiKey.create({
      data: {
        name: keyName,
        key: apiKey,
        userId,
      },
      select: {
        id: true,
        name: true,
        key: true,
        createdAt: true,
      },
    });

    return createdApiKey;
  }

  static async getProjectApiKeys(projectId: string, userId: string) {
    // First check if project exists and user owns it
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!existingProject) {
      throw new Error('Project not found or access denied');
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        name: true,
        key: true,
        lastUsed: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return apiKeys;
  }
}