/**
 * Customer Success Metrics and Feedback System
 * Tracks user engagement, success metrics, and collects feedback for product improvement
 */

import { prisma } from './database.service';
import { logger } from '../utils/logger';

export interface CustomerSuccessMetrics {
  userId: string;
  organizationId: string;
  period: 'weekly' | 'monthly' | 'quarterly';
  startDate: Date;
  endDate: Date;
  metrics: {
    // Onboarding Success
    onboardingCompleted: boolean;
    timeToFirstValue: number; // Days to first flaky test detection
    integrationSuccess: boolean;
    firstTestRunWithin24h: boolean;
    
    // Feature Adoption
    featuresUsed: string[];
    advancedFeaturesAdopted: number;
    quarantineAutomationEnabled: boolean;
    apiUsage: number;
    dashboardSessions: number;
    
    // Value Realization
    flakyTestsDetected: number;
    testsQuarantined: number;
    ciTimesSaved: number; // Minutes
    developmentTimesSaved: number; // Hours
    falsePositiveReduction: number; // Percentage
    buildReliabilityImprovement: number; // Percentage
    
    // Engagement
    loginFrequency: number; // Logins per week/month
    sessionDuration: number; // Average minutes
    featuresExplored: number;
    documentationAccessed: boolean;
    supportTicketsCreated: number;
    
    // Team Collaboration
    teamMembersInvited: number;
    teamMembersActive: number;
    projectsConnected: number;
    crossTeamSharing: boolean;
    
    // Health Scores
    overallHealthScore: number; // 0-100
    engagementScore: number; // 0-100
    valueRealizationScore: number; // 0-100
    adoptionScore: number; // 0-100
  };
}

export interface FeedbackData {
  userId: string;
  organizationId?: string;
  type: 'nps' | 'feature_request' | 'bug_report' | 'satisfaction' | 'churn_risk';
  score?: number; // For NPS, satisfaction ratings
  feedback: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: {
    currentPlan?: string;
    featureContext?: string;
    userJourney?: string;
    deviceInfo?: any;
  };
  followUpRequired?: boolean;
  actionItems?: string[];
}

export interface SuccessAlert {
  userId: string;
  organizationId: string;
  alertType: 'churn_risk' | 'expansion_opportunity' | 'success_milestone' | 'engagement_drop' | 'value_realization';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestedActions: string[];
  automationPossible: boolean;
  createdAt: Date;
}

export class CustomerSuccessService {
  
  /**
   * Calculate comprehensive success metrics for a customer
   */
  static async calculateSuccessMetrics(
    userId: string, 
    organizationId: string, 
    period: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
  ): Promise<CustomerSuccessMetrics> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'weekly':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
    }

    try {
      // Gather data from multiple sources
      const [
        user,
        organization,
        projects,
        testRuns,
        flakyPatterns,
        quarantineHistory,
        apiUsage,
        loginHistory,
        onboardingProgress
      ] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.organization.findUnique({ 
          where: { id: organizationId },
          include: { members: true }
        }),
        prisma.project.findMany({ 
          where: { 
            user: { organizations: { some: { organizationId } } }
          }
        }),
        prisma.testRun.findMany({
          where: {
            project: { user: { organizations: { some: { organizationId } } } },
            createdAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.flakyTestPattern.findMany({
          where: {
            project: { user: { organizations: { some: { organizationId } } } },
            createdAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.quarantineHistory.findMany({
          where: {
            flakyTestPattern: {
              project: { user: { organizations: { some: { organizationId } } } }
            },
            createdAt: { gte: startDate, lte: endDate }
          }
        }),
        this.getApiUsageStats(organizationId, startDate, endDate),
        this.getLoginHistory(userId, startDate, endDate),
        this.getOnboardingProgress(userId)
      ]);

      // Calculate metrics
      const metrics = await this.computeMetrics({
        user,
        organization,
        projects,
        testRuns,
        flakyPatterns,
        quarantineHistory,
        apiUsage,
        loginHistory,
        onboardingProgress,
        startDate,
        endDate
      });

      return {
        userId,
        organizationId,
        period,
        startDate,
        endDate,
        metrics
      };

    } catch (error) {
      logger.error('Error calculating success metrics:', error);
      throw error;
    }
  }

  /**
   * Collect and store customer feedback
   */
  static async collectFeedback(feedbackData: FeedbackData): Promise<void> {
    try {
      // Store feedback in database
      await prisma.customerFeedback.create({
        data: {
          userId: feedbackData.userId,
          organizationId: feedbackData.organizationId,
          type: feedbackData.type,
          score: feedbackData.score,
          feedback: feedbackData.feedback,
          category: feedbackData.category,
          priority: feedbackData.priority || 'medium',
          metadata: feedbackData.metadata || {},
          followUpRequired: feedbackData.followUpRequired || false,
          actionItems: feedbackData.actionItems || []
        }
      });

      // Process feedback for immediate actions
      await this.processFeedback(feedbackData);

      // Track feedback collection metrics
      this.trackFeedbackMetrics(feedbackData);

    } catch (error) {
      logger.error('Error collecting feedback:', error);
      throw error;
    }
  }

  /**
   * Generate success alerts based on customer behavior
   */
  static async generateSuccessAlerts(userId: string, organizationId: string): Promise<SuccessAlert[]> {
    const alerts: SuccessAlert[] = [];
    const metrics = await this.calculateSuccessMetrics(userId, organizationId);

    try {
      // Churn Risk Detection
      if (metrics.metrics.engagementScore < 30) {
        alerts.push({
          userId,
          organizationId,
          alertType: 'churn_risk',
          severity: 'high',
          title: 'Low Engagement - Churn Risk',
          description: `User engagement has dropped to ${metrics.metrics.engagementScore}%. Last login was ${this.getLastLoginDays(userId)} days ago.`,
          suggestedActions: [
            'Send personalized re-engagement email',
            'Schedule success manager call',
            'Offer additional onboarding support',
            'Provide relevant feature tutorials'
          ],
          automationPossible: true,
          createdAt: new Date()
        });
      }

      // Expansion Opportunity
      if (metrics.metrics.valueRealizationScore > 80 && metrics.metrics.featuresUsed.length > 8) {
        alerts.push({
          userId,
          organizationId,
          alertType: 'expansion_opportunity',
          severity: 'medium',
          title: 'High Value User - Expansion Opportunity',
          description: 'Customer is highly engaged and getting significant value. Consider upgrade opportunity.',
          suggestedActions: [
            'Reach out about Enterprise features',
            'Discuss additional team members',
            'Present ROI case study',
            'Offer custom integration consultation'
          ],
          automationPossible: false,
          createdAt: new Date()
        });
      }

      // Success Milestone
      if (metrics.metrics.flakyTestsDetected >= 10 && !this.hasReachedMilestone(userId, 'first_10_flaky_tests')) {
        alerts.push({
          userId,
          organizationId,
          alertType: 'success_milestone',
          severity: 'low',
          title: 'Success Milestone: 10 Flaky Tests Detected',
          description: 'Customer has successfully detected 10 flaky tests and is seeing real value.',
          suggestedActions: [
            'Send congratulations email',
            'Share success story template',
            'Invite to customer success webinar',
            'Request testimonial or case study'
          ],
          automationPossible: true,
          createdAt: new Date()
        });
      }

      // Value Realization Alert
      if (metrics.metrics.ciTimesSaved > 0 && metrics.metrics.developmentTimesSaved > 10) {
        const totalTimeSaved = metrics.metrics.ciTimesSaved / 60 + metrics.metrics.developmentTimesSaved;
        alerts.push({
          userId,
          organizationId,
          alertType: 'value_realization',
          severity: 'medium',
          title: 'Significant Time Savings Achieved',
          description: `Customer has saved ${totalTimeSaved.toFixed(1)} hours this month through flaky test management.`,
          suggestedActions: [
            'Share ROI calculation',
            'Encourage team expansion',
            'Request success story participation',
            'Suggest advanced automation features'
          ],
          automationPossible: true,
          createdAt: new Date()
        });
      }

      // Store alerts
      for (const alert of alerts) {
        await prisma.successAlert.create({ data: alert });
      }

      return alerts;

    } catch (error) {
      logger.error('Error generating success alerts:', error);
      return [];
    }
  }

  /**
   * Get customer health score dashboard
   */
  static async getHealthScoreDashboard(organizationId: string): Promise<{
    overallHealth: number;
    healthTrend: 'improving' | 'stable' | 'declining';
    keyMetrics: any;
    recommendations: string[];
    alerts: SuccessAlert[];
  }> {
    try {
      const members = await prisma.organizationMember.findMany({
        where: { organizationId },
        include: { user: true }
      });

      const memberMetrics = await Promise.all(
        members.map(member => this.calculateSuccessMetrics(member.userId, organizationId))
      );

      const avgHealth = memberMetrics.reduce((sum, m) => sum + m.metrics.overallHealthScore, 0) / memberMetrics.length;
      
      // Calculate trend by comparing with previous period
      const previousMetrics = await Promise.all(
        members.map(member => this.calculateSuccessMetrics(member.userId, organizationId, 'monthly'))
      );
      
      const previousAvgHealth = previousMetrics.reduce((sum, m) => sum + m.metrics.overallHealthScore, 0) / previousMetrics.length;
      
      const healthTrend = avgHealth > previousAvgHealth + 5 ? 'improving' :
                         avgHealth < previousAvgHealth - 5 ? 'declining' : 'stable';

      // Get recent alerts
      const alerts = await prisma.successAlert.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(memberMetrics, alerts);

      return {
        overallHealth: Math.round(avgHealth),
        healthTrend,
        keyMetrics: {
          totalUsers: members.length,
          activeUsers: memberMetrics.filter(m => m.metrics.engagementScore > 50).length,
          avgValueRealization: Math.round(memberMetrics.reduce((sum, m) => sum + m.metrics.valueRealizationScore, 0) / memberMetrics.length),
          totalTimeSaved: memberMetrics.reduce((sum, m) => sum + m.metrics.developmentTimesSaved, 0),
          flakyTestsDetected: memberMetrics.reduce((sum, m) => sum + m.metrics.flakyTestsDetected, 0)
        },
        recommendations,
        alerts
      };

    } catch (error) {
      logger.error('Error getting health score dashboard:', error);
      throw error;
    }
  }

  /**
   * Track feature adoption and usage patterns
   */
  static async trackFeatureUsage(userId: string, feature: string, metadata?: any): Promise<void> {
    try {
      await prisma.featureUsage.upsert({
        where: {
          userId_feature: { userId, feature }
        },
        create: {
          userId,
          feature,
          usageCount: 1,
          firstUsedAt: new Date(),
          lastUsedAt: new Date(),
          metadata: metadata || {}
        },
        update: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
          metadata: metadata || {}
        }
      });

      // Check for adoption milestones
      const usage = await prisma.featureUsage.findUnique({
        where: { userId_feature: { userId, feature } }
      });

      if (usage && this.isAdoptionMilestone(usage.usageCount)) {
        await this.trackAdoptionMilestone(userId, feature, usage.usageCount);
      }

    } catch (error) {
      logger.error('Error tracking feature usage:', error);
    }
  }

  /**
   * Generate NPS survey for eligible users
   */
  static async generateNPSSurvey(userId: string): Promise<{
    eligible: boolean;
    survey?: {
      id: string;
      question: string;
      followUpQuestions: string[];
      metadata: any;
    };
  }> {
    try {
      // Check eligibility (has been using for 30+ days, hasn't been surveyed recently)
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const lastSurvey = await prisma.customerFeedback.findFirst({
        where: { userId, type: 'nps' },
        orderBy: { createdAt: 'desc' }
      });

      const daysSinceSignup = user ? (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
      const daysSinceLastSurvey = lastSurvey ? (Date.now() - lastSurvey.createdAt.getTime()) / (1000 * 60 * 60 * 24) : 365;

      if (daysSinceSignup < 30 || daysSinceLastSurvey < 90) {
        return { eligible: false };
      }

      // Generate personalized survey
      const metrics = await this.calculateSuccessMetrics(userId, user?.id || '', 'monthly');
      
      const survey = {
        id: `nps_${userId}_${Date.now()}`,
        question: "How likely are you to recommend Nixbit to a friend or colleague?",
        followUpQuestions: [
          "What's the primary reason for your score?",
          "What could we do to improve your experience?",
          "Which feature has been most valuable to your team?"
        ],
        metadata: {
          userMetrics: metrics.metrics,
          suggestedContext: this.getNPSContext(metrics.metrics)
        }
      };

      return { eligible: true, survey };

    } catch (error) {
      logger.error('Error generating NPS survey:', error);
      return { eligible: false };
    }
  }

  // Helper methods
  private static async computeMetrics(data: any): Promise<CustomerSuccessMetrics['metrics']> {
    const {
      user,
      organization,
      projects,
      testRuns,
      flakyPatterns,
      quarantineHistory,
      apiUsage,
      loginHistory,
      onboardingProgress
    } = data;

    // Onboarding metrics
    const onboardingCompleted = onboardingProgress?.completed || false;
    const timeToFirstValue = onboardingProgress?.timeToFirstValue || 0;
    const integrationSuccess = projects.length > 0 && testRuns.length > 0;
    const firstTestRunWithin24h = onboardingProgress?.firstTestRunWithin24h || false;

    // Feature adoption
    const featuresUsed = await this.getUsedFeatures(user.id);
    const advancedFeaturesAdopted = this.countAdvancedFeatures(featuresUsed);
    const quarantineAutomationEnabled = projects.some(p => p.quarantineAutomationEnabled);

    // Value metrics
    const flakyTestsDetected = flakyPatterns.length;
    const testsQuarantined = quarantineHistory.filter(h => h.action === 'quarantined').length;
    const ciTimesSaved = this.calculateCITimeSaved(quarantineHistory);
    const developmentTimesSaved = this.calculateDevTimeSaved(flakyPatterns);

    // Engagement metrics
    const loginFrequency = loginHistory.length;
    const sessionDuration = this.calculateAvgSessionDuration(loginHistory);

    // Health scores
    const engagementScore = this.calculateEngagementScore({
      loginFrequency,
      sessionDuration,
      featuresUsed: featuresUsed.length
    });

    const valueRealizationScore = this.calculateValueScore({
      flakyTestsDetected,
      ciTimesSaved,
      developmentTimesSaved
    });

    const adoptionScore = this.calculateAdoptionScore({
      featuresUsed: featuresUsed.length,
      advancedFeaturesAdopted,
      quarantineAutomationEnabled
    });

    const overallHealthScore = Math.round((engagementScore + valueRealizationScore + adoptionScore) / 3);

    return {
      onboardingCompleted,
      timeToFirstValue,
      integrationSuccess,
      firstTestRunWithin24h,
      featuresUsed,
      advancedFeaturesAdopted,
      quarantineAutomationEnabled,
      apiUsage: apiUsage.totalRequests || 0,
      dashboardSessions: loginHistory.length,
      flakyTestsDetected,
      testsQuarantined,
      ciTimesSaved,
      developmentTimesSaved,
      falsePositiveReduction: this.calculateFalsePositiveReduction(quarantineHistory),
      buildReliabilityImprovement: this.calculateReliabilityImprovement(testRuns),
      loginFrequency,
      sessionDuration,
      featuresExplored: featuresUsed.length,
      documentationAccessed: apiUsage.docRequests > 0,
      supportTicketsCreated: 0, // Would come from support system
      teamMembersInvited: organization?.members.length || 1,
      teamMembersActive: organization?.members.filter((m: any) => m.lastActiveAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length || 1,
      projectsConnected: projects.length,
      crossTeamSharing: projects.length > 1,
      overallHealthScore,
      engagementScore,
      valueRealizationScore,
      adoptionScore
    };
  }

  private static async getApiUsageStats(organizationId: string, startDate: Date, endDate: Date): Promise<any> {
    // This would integrate with API analytics system
    return {
      totalRequests: Math.floor(Math.random() * 1000),
      docRequests: Math.floor(Math.random() * 50)
    };
  }

  private static async getLoginHistory(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // This would come from authentication logs
    return [];
  }

  private static async getOnboardingProgress(userId: string): Promise<any> {
    // This would come from onboarding tracking
    return {
      completed: true,
      timeToFirstValue: 2,
      firstTestRunWithin24h: true
    };
  }

  private static async getUsedFeatures(userId: string): Promise<string[]> {
    const usage = await prisma.featureUsage.findMany({
      where: { userId },
      select: { feature: true }
    });
    return usage.map(u => u.feature);
  }

  private static countAdvancedFeatures(features: string[]): number {
    const advancedFeatures = ['ai-analysis', 'quarantine-automation', 'custom-policies', 'api-integration'];
    return features.filter(f => advancedFeatures.includes(f)).length;
  }

  private static calculateCITimeSaved(quarantineHistory: any[]): number {
    // Estimate CI time saved based on quarantine actions
    return quarantineHistory.filter(h => h.action === 'quarantined').length * 5; // 5 minutes per quarantined test
  }

  private static calculateDevTimeSaved(flakyPatterns: any[]): number {
    // Estimate development time saved based on flaky tests detected
    return flakyPatterns.length * 0.5; // 30 minutes per flaky test detected
  }

  private static calculateEngagementScore(data: any): number {
    const { loginFrequency, sessionDuration, featuresUsed } = data;
    
    let score = 0;
    score += Math.min(loginFrequency * 10, 40); // Up to 40 points for login frequency
    score += Math.min(sessionDuration / 5, 30); // Up to 30 points for session duration
    score += Math.min(featuresUsed * 3, 30); // Up to 30 points for feature usage
    
    return Math.min(score, 100);
  }

  private static calculateValueScore(data: any): number {
    const { flakyTestsDetected, ciTimesSaved, developmentTimesSaved } = data;
    
    let score = 0;
    score += Math.min(flakyTestsDetected * 5, 40); // Up to 40 points for detection
    score += Math.min(ciTimesSaved, 30); // Up to 30 points for CI time saved
    score += Math.min(developmentTimesSaved * 2, 30); // Up to 30 points for dev time saved
    
    return Math.min(score, 100);
  }

  private static calculateAdoptionScore(data: any): number {
    const { featuresUsed, advancedFeaturesAdopted, quarantineAutomationEnabled } = data;
    
    let score = 0;
    score += Math.min(featuresUsed * 8, 50); // Up to 50 points for basic features
    score += advancedFeaturesAdopted * 10; // 10 points per advanced feature
    score += quarantineAutomationEnabled ? 20 : 0; // 20 points for automation
    
    return Math.min(score, 100);
  }

  private static calculateFalsePositiveReduction(quarantineHistory: any[]): number {
    // Calculate false positive reduction percentage
    return Math.random() * 30 + 20; // Placeholder: 20-50% reduction
  }

  private static calculateReliabilityImprovement(testRuns: any[]): number {
    // Calculate build reliability improvement
    return Math.random() * 40 + 10; // Placeholder: 10-50% improvement
  }

  private static calculateAvgSessionDuration(loginHistory: any[]): number {
    // Calculate average session duration in minutes
    return Math.random() * 45 + 15; // Placeholder: 15-60 minutes
  }

  private static async processFeedback(feedback: FeedbackData): Promise<void> {
    // Process feedback for immediate actions (notifications, alerts, etc.)
    if (feedback.type === 'nps' && feedback.score !== undefined && feedback.score <= 6) {
      // Low NPS score - create alert
      logger.info(`Low NPS score detected for user ${feedback.userId}: ${feedback.score}`);
    }
  }

  private static trackFeedbackMetrics(feedback: FeedbackData): void {
    // Track feedback collection metrics for analytics
    if (window && (window as any).gtag) {
      (window as any).gtag('event', 'feedback_collected', {
        feedback_type: feedback.type,
        user_id: feedback.userId
      });
    }
  }

  private static async getLastLoginDays(userId: string): Promise<number> {
    // Get days since last login
    return Math.floor(Math.random() * 14); // Placeholder
  }

  private static async hasReachedMilestone(userId: string, milestone: string): Promise<boolean> {
    const existing = await prisma.successMilestone.findFirst({
      where: { userId, milestone }
    });
    return !!existing;
  }

  private static generateHealthRecommendations(metrics: CustomerSuccessMetrics[], alerts: any[]): string[] {
    const recommendations: string[] = [];
    
    const avgEngagement = metrics.reduce((sum, m) => sum + m.metrics.engagementScore, 0) / metrics.length;
    const avgValue = metrics.reduce((sum, m) => sum + m.metrics.valueRealizationScore, 0) / metrics.length;
    
    if (avgEngagement < 50) {
      recommendations.push('Focus on user engagement - consider additional training or support');
    }
    
    if (avgValue < 40) {
      recommendations.push('Help users realize more value - review onboarding and feature adoption');
    }
    
    if (alerts.filter(a => a.alertType === 'churn_risk').length > 0) {
      recommendations.push('Address churn risk users with personalized outreach');
    }
    
    return recommendations;
  }

  private static isAdoptionMilestone(count: number): boolean {
    return [1, 5, 10, 25, 50, 100].includes(count);
  }

  private static async trackAdoptionMilestone(userId: string, feature: string, count: number): Promise<void> {
    await prisma.successMilestone.create({
      data: {
        userId,
        milestone: `${feature}_${count}_uses`,
        achievedAt: new Date(),
        metadata: { feature, usageCount: count }
      }
    });
  }

  private static getNPSContext(metrics: CustomerSuccessMetrics['metrics']): string {
    if (metrics.valueRealizationScore > 80) {
      return 'High value user - likely promoter';
    } else if (metrics.engagementScore < 30) {
      return 'Low engagement - risk of detractor';
    } else {
      return 'Moderate engagement - likely passive';
    }
  }
}

export default CustomerSuccessService;