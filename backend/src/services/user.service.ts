import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { prisma } from './database.service';

export interface CreateUserData {
  email: string;
  name?: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class UserService {
  static async createUser(userData: CreateUserData) {
    const { email, name, password } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return user;
  }

  static async authenticateUser(loginData: LoginData) {
    const { email, password } = loginData;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = { 
      userId: user.id, 
      email: user.email 
    };
    
    const token = jwt.sign(payload, jwtSecret, { 
      expiresIn: '7d'
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  static async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }

  static verifyToken(token: string) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      return jwt.verify(token, jwtSecret) as { userId: string; email: string };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static async getUserWithAdminStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isSystemAdmin: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  static async updateLastLogin(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  static async createAdminAuditLog(data: {
    userId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    beforeState?: any;
    afterState?: any;
    severity?: 'info' | 'warn' | 'error' | 'critical';
    category: string;
  }) {
    return prisma.adminAuditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        beforeState: data.beforeState,
        afterState: data.afterState,
        severity: data.severity || 'info',
        category: data.category,
      },
    });
  }

  static async getAllUsers(page: number = 1, limit: number = 50, search?: string) {
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          isSystemAdmin: true,
          lastLoginAt: true,
          createdAt: true,
          organizations: {
            select: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  plan: true,
                },
              },
              role: true,
            },
          },
          projects: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map(user => ({
        ...user,
        organizationCount: user.organizations.length,
        totalProjects: user.projects.length,
        status: user.lastLoginAt && 
          user.lastLoginAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
          ? 'active' as const 
          : 'inactive' as const,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async toggleUserAdminStatus(userId: string, isSystemAdmin: boolean) {
    const beforeState = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSystemAdmin: true, email: true },
    });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isSystemAdmin },
      select: {
        id: true,
        email: true,
        name: true,
        isSystemAdmin: true,
      },
    });

    return { user, beforeState };
  }
}

// Create service instance with non-static methods
class UserServiceInstance {
  async findByEmail(email: string) {
    return UserService.getUserByEmail(email);
  }
  
  async createUser(userData: CreateUserData) {
    return UserService.createUser(userData);
  }
}

export const userService = new UserServiceInstance();