import { PrismaClient } from '@prisma/client';
import { MarketingSignupRequest, UpdateMarketingSignupRequest } from '../../../shared/dist/index.js';

const prisma = new PrismaClient();

export class MarketingService {
  async createSignup(data: MarketingSignupRequest, metadata: { ipAddress: string; userAgent: string }) {
    try {
      // Check if email already exists
      const existingSignup = await prisma.marketingSignup.findUnique({
        where: { email: data.email }
      });

      if (existingSignup) {
        // Update existing signup with new information
        return await prisma.marketingSignup.update({
          where: { email: data.email },
          data: {
            name: data.name || existingSignup.name,
            company: data.company || existingSignup.company,
            teamSize: data.teamSize || existingSignup.teamSize,
            currentPainPoints: data.currentPainPoints || existingSignup.currentPainPoints,
            interestedFeatures: data.interestedFeatures || existingSignup.interestedFeatures,
            source: data.source || existingSignup.source,
            utmParameters: data.utmParameters ? { ...existingSignup.utmParameters as any, ...data.utmParameters } : existingSignup.utmParameters,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            updatedAt: new Date(),
          },
        });
      }

      // Create new signup
      const signup = await prisma.marketingSignup.create({
        data: {
          email: data.email,
          name: data.name,
          company: data.company,
          teamSize: data.teamSize,
          currentPainPoints: data.currentPainPoints || [],
          interestedFeatures: data.interestedFeatures || [],
          source: data.source || 'landing-page',
          utmParameters: data.utmParameters || {},
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });

      return signup;
    } catch (error) {
      console.error('Error creating marketing signup:', error);
      throw new Error('Failed to create marketing signup');
    }
  }

  async getSignup(id: string) {
    return await prisma.marketingSignup.findUnique({
      where: { id },
    });
  }

  async getSignupByEmail(email: string) {
    return await prisma.marketingSignup.findUnique({
      where: { email },
    });
  }

  async getAllSignups(options: {
    page?: number;
    limit?: number;
    converted?: boolean;
    source?: string;
  } = {}) {
    const { page = 1, limit = 50, converted, source } = options;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (typeof converted === 'boolean') {
      where.isConverted = converted;
    }
    if (source) {
      where.source = source;
    }

    const [signups, total] = await Promise.all([
      prisma.marketingSignup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.marketingSignup.count({ where }),
    ]);

    return {
      signups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateSignup(id: string, data: UpdateMarketingSignupRequest) {
    return await prisma.marketingSignup.update({
      where: { id },
      data,
    });
  }

  async markAsConverted(email: string, userId: string) {
    return await prisma.marketingSignup.update({
      where: { email },
      data: {
        isConverted: true,
        convertedAt: new Date(),
        convertedUserId: userId,
      },
    });
  }

  async unsubscribeEmail(email: string) {
    return await prisma.marketingSignup.update({
      where: { email },
      data: {
        emailSubscribed: false,
        unsubscribedAt: new Date(),
      },
    });
  }

  async getSignupStats() {
    const [total, converted, bySource] = await Promise.all([
      prisma.marketingSignup.count(),
      prisma.marketingSignup.count({ where: { isConverted: true } }),
      prisma.marketingSignup.groupBy({
        by: ['source'],
        _count: true,
      }),
    ]);

    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    return {
      total,
      converted,
      conversionRate,
      bySource: bySource.map(item => ({
        source: item.source || 'unknown',
        count: item._count,
      })),
    };
  }

  async calculateLeadScore(signupId: string): Promise<number> {
    const signup = await prisma.marketingSignup.findUnique({
      where: { id: signupId },
    });

    if (!signup) {
      throw new Error('Signup not found');
    }

    let score = 0;

    // Company name provided (+20 points)
    if (signup.company) {
      score += 20;
    }

    // Team size scoring
    switch (signup.teamSize) {
      case '50+':
        score += 40;
        break;
      case '16-50':
        score += 30;
        break;
      case '6-15':
        score += 20;
        break;
      case '1-5':
        score += 10;
        break;
    }

    // Pain points indicated (+5 per pain point, max 25)
    const painPointScore = Math.min((signup.currentPainPoints?.length || 0) * 5, 25);
    score += painPointScore;

    // Interested features (+3 per feature, max 15)
    const featuresScore = Math.min((signup.interestedFeatures?.length || 0) * 3, 15);
    score += featuresScore;

    // Update the score in database
    await prisma.marketingSignup.update({
      where: { id: signupId },
      data: { leadScore: score },
    });

    return score;
  }
}

export const marketingService = new MarketingService();