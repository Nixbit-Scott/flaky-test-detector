import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface ExecutiveSummary {
  organizationId: string;
  organizationName: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
    periodType: 'weekly' | 'monthly' | 'quarterly';
  };
  keyMetrics: {
    totalProjects: number;
    totalFlakyTests: number;
    flakyTestTrend: number; // % change from previous period
    totalTimeWasted: number; // minutes
    estimatedCostImpact: number; // USD
    deploymentsDelayed: number;
    avgResolutionTime: number; // days
    testStabilityScore: number; // 0-100
  };
  riskAssessment: {
    criticalIssues: number;
    highRiskProjects: number;
    improvementOpportunities: number;
    riskTrend: 'increasing' | 'stable' | 'decreasing';
  };
  businessImpact: {
    developerProductivity: {
      timeWastedPerDeveloper: number;
      productivityLoss: number; // %
    };
    deploymentFrequency: {
      current: number;
      potential: number;
      improvement: number; // %
    };
    qualityMetrics: {
      testReliability: number; // %
      ciStability: number; // %
      customerImpact: number; // estimated incidents prevented
    };
  };
  insights: {
    topIssues: Array<{
      category: string;
      description: string;
      impact: string;
      recommendation: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    achievements: Array<{
      description: string;
      impact: string;
      value: number;
    }>;
    recommendations: Array<{
      action: string;
      expectedImpact: string;
      timeline: string;
      effort: 'low' | 'medium' | 'high';
    }>;
  };
}

export interface ProjectPerformanceReport {
  projectId: string;
  projectName: string;
  repository: string;
  metrics: {
    flakyTestCount: number;
    flakyTestTrend: number;
    stabilityScore: number;
    timeWasted: number;
    costImpact: number;
    deploymentsDelayed: number;
    avgResolutionTime: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
}

export interface TeamProductivityReport {
  teamId: string;
  teamName: string;
  memberCount: number;
  metrics: {
    timeWastedPerMember: number;
    productivityImpact: number;
    velocityReduction: number;
    qualityScore: number;
  };
  trends: {
    timeWastedTrend: number;
    productivityTrend: number;
    qualityTrend: number;
  };
  topIssues: Array<{
    projectName: string;
    issueType: string;
    impact: number;
  }>;
}

export interface TechnicalDebtReport {
  organizationId: string;
  totalDebt: {
    estimatedHours: number;
    estimatedCost: number;
    priority: 'high' | 'medium' | 'low';
  };
  categories: Array<{
    category: string;
    count: number;
    estimatedFixTime: number;
    impact: number;
  }>;
  trends: {
    debtAccumulation: number;
    resolutionRate: number;
  };
}

export interface ROIReport {
  organizationId: string;
  investment: {
    toolCost: number;
    implementationTime: number;
    maintenanceTime: number;
  };
  returns: {
    timeRecovered: number;
    costSavings: number;
    productivityGains: number;
    qualityImprovements: number;
  };
  roi: {
    percentage: number;
    paybackPeriod: number; // months
    netBenefit: number;
  };
}

export class ExecutiveDashboardService {
  
  /**
   * Generate executive summary report
   */
  static async generateExecutiveSummary(
    organizationId: string,
    periodType: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
  ): Promise<ExecutiveSummary> {
    try {
      const { startDate, endDate } = this.getPeriodDates(periodType);
      
      // Get organization info
      const organization = await prisma.team.findUnique({
        where: { id: organizationId },
        include: {
          projects: {
            include: {
              flakyTests: {
                where: {
                  lastSeen: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
              },
              impactCalculations: {
                where: {
                  calculationDate: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
                orderBy: { calculationDate: 'desc' },
                take: 1,
              },
              stabilityReports: {
                where: {
                  generatedAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
                orderBy: { generatedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Calculate key metrics
      const keyMetrics = await this.calculateKeyMetrics(organization, startDate, endDate);
      const riskAssessment = await this.calculateRiskAssessment(organization, startDate, endDate);
      const businessImpact = await this.calculateBusinessImpact(organization, startDate, endDate);
      const insights = await this.generateInsights(organization, startDate, endDate);

      return {
        organizationId,
        organizationName: organization.name,
        reportPeriod: {
          startDate,
          endDate,
          periodType,
        },
        keyMetrics,
        riskAssessment,
        businessImpact,
        insights,
      };
    } catch (error) {
      logger.error('Error generating executive summary:', error);
      throw error;
    }
  }

  /**
   * Generate project performance report
   */
  static async generateProjectPerformanceReport(
    organizationId: string,
    periodType: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
  ): Promise<ProjectPerformanceReport[]> {
    try {
      const { startDate, endDate } = this.getPeriodDates(periodType);
      
      const projects = await prisma.project.findMany({
        where: { teamId: organizationId },
        include: {
          flakyTests: {
            where: {
              lastSeen: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
          impactCalculations: {
            where: {
              calculationDate: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { calculationDate: 'desc' },
            take: 1,
          },
          stabilityReports: {
            where: {
              generatedAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { generatedAt: 'desc' },
            take: 1,
          },
        },
      });

      const reports = projects.map(project => {
        const latestImpact = project.impactCalculations[0];
        const latestStability = project.stabilityReports[0];
        
        const flakyTestCount = project.flakyTests.length;
        const timeWasted = latestImpact?.totalTimeWasted || 0;
        const costImpact = latestImpact?.estimatedCostImpact || 0;
        const stabilityScore = latestStability?.overallStability || 0;
        
        // Calculate risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (flakyTestCount > 10 || costImpact > 5000) riskLevel = 'critical';
        else if (flakyTestCount > 5 || costImpact > 2000) riskLevel = 'high';
        else if (flakyTestCount > 2 || costImpact > 500) riskLevel = 'medium';

        return {
          projectId: project.id,
          projectName: project.name,
          repository: project.repository,
          metrics: {
            flakyTestCount,
            flakyTestTrend: 0, // TODO: Calculate trend
            stabilityScore,
            timeWasted,
            costImpact,
            deploymentsDelayed: latestImpact?.deploymentsDelayed || 0,
            avgResolutionTime: 0, // TODO: Calculate from quarantine history
          },
          riskLevel,
          lastUpdated: new Date(),
        };
      });

      return reports.sort((a, b) => b.metrics.costImpact - a.metrics.costImpact);
    } catch (error) {
      logger.error('Error generating project performance report:', error);
      throw error;
    }
  }

  /**
   * Generate team productivity report
   */
  static async generateTeamProductivityReport(
    organizationId: string,
    periodType: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
  ): Promise<TeamProductivityReport[]> {
    try {
      const { startDate, endDate } = this.getPeriodDates(periodType);
      
      const teams = await prisma.team.findMany({
        where: { id: organizationId },
        include: {
          members: true,
          projects: {
            include: {
              impactCalculations: {
                where: {
                  calculationDate: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
                orderBy: { calculationDate: 'desc' },
                take: 1,
              },
              flakyTests: {
                where: {
                  lastSeen: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
              },
            },
          },
        },
      });

      const reports = teams.map(team => {
        const memberCount = team.members.length;
        const totalTimeWasted = team.projects.reduce((sum, project) => {
          return sum + (project.impactCalculations[0]?.totalTimeWasted || 0);
        }, 0);
        
        const timeWastedPerMember = memberCount > 0 ? totalTimeWasted / memberCount : 0;
        const productivityImpact = Math.min(timeWastedPerMember / 40, 1); // Assume 40 hours per week
        
        const topIssues = team.projects
          .map(project => ({
            projectName: project.name,
            issueType: 'flaky_tests',
            impact: project.impactCalculations[0]?.estimatedCostImpact || 0,
          }))
          .sort((a, b) => b.impact - a.impact)
          .slice(0, 5);

        return {
          teamId: team.id,
          teamName: team.name,
          memberCount,
          metrics: {
            timeWastedPerMember,
            productivityImpact: productivityImpact * 100,
            velocityReduction: productivityImpact * 20, // Estimate 20% velocity impact
            qualityScore: 100 - (productivityImpact * 30), // Estimate quality impact
          },
          trends: {
            timeWastedTrend: 0, // TODO: Calculate trend
            productivityTrend: 0,
            qualityTrend: 0,
          },
          topIssues,
        };
      });

      return reports;
    } catch (error) {
      logger.error('Error generating team productivity report:', error);
      throw error;
    }
  }

  /**
   * Generate technical debt report
   */
  static async generateTechnicalDebtReport(organizationId: string): Promise<TechnicalDebtReport> {
    try {
      const flakyTests = await prisma.flakyTestPattern.findMany({
        where: {
          project: {
            teamId: organizationId,
          },
          isActive: true,
        },
        include: {
          project: true,
          rootCauseAnalyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const categories = new Map<string, { count: number; estimatedFixTime: number; impact: number }>();
      let totalEstimatedHours = 0;
      
      flakyTests.forEach(test => {
        const rootCause = test.rootCauseAnalyses[0];
        const category = rootCause?.primaryCategory || 'unknown';
        
        const fixTime = this.estimateFixTime(test.confidence, rootCause?.estimatedFixEffort);
        const impact = test.failureRate * 100;
        
        if (!categories.has(category)) {
          categories.set(category, { count: 0, estimatedFixTime: 0, impact: 0 });
        }
        
        const categoryData = categories.get(category)!;
        categoryData.count++;
        categoryData.estimatedFixTime += fixTime;
        categoryData.impact += impact;
        
        totalEstimatedHours += fixTime;
      });

      const estimatedCost = totalEstimatedHours * 100; // $100/hour estimate
      
      return {
        organizationId,
        totalDebt: {
          estimatedHours: totalEstimatedHours,
          estimatedCost,
          priority: estimatedCost > 10000 ? 'high' : estimatedCost > 5000 ? 'medium' : 'low',
        },
        categories: Array.from(categories.entries()).map(([category, data]) => ({
          category,
          count: data.count,
          estimatedFixTime: data.estimatedFixTime,
          impact: data.impact,
        })),
        trends: {
          debtAccumulation: 0, // TODO: Calculate trend
          resolutionRate: 0,
        },
      };
    } catch (error) {
      logger.error('Error generating technical debt report:', error);
      throw error;
    }
  }

  /**
   * Generate ROI report
   */
  static async generateROIReport(
    organizationId: string,
    toolCost: number = 99, // Monthly cost
    implementationTime: number = 40 // Hours
  ): Promise<ROIReport> {
    try {
      const { startDate, endDate } = this.getPeriodDates('monthly');
      
      const projects = await prisma.project.findMany({
        where: { teamId: organizationId },
        include: {
          impactCalculations: {
            where: {
              calculationDate: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { calculationDate: 'desc' },
            take: 1,
          },
        },
      });

      const totalCostSavings = projects.reduce((sum, project) => {
        return sum + (project.impactCalculations[0]?.estimatedCostImpact || 0);
      }, 0);

      const totalTimeRecovered = projects.reduce((sum, project) => {
        return sum + (project.impactCalculations[0]?.totalTimeWasted || 0);
      }, 0);

      const productivityGains = totalTimeRecovered * 1.5; // Estimate 1.5x productivity multiplier
      const qualityImprovements = totalCostSavings * 0.3; // Estimate 30% quality improvement value

      const totalInvestment = toolCost + (implementationTime * 100) + (toolCost * 0.1); // 10% maintenance
      const totalReturns = totalCostSavings + productivityGains + qualityImprovements;
      
      const roi = ((totalReturns - totalInvestment) / totalInvestment) * 100;
      const paybackPeriod = totalInvestment / (totalReturns / 12); // Months to payback

      return {
        organizationId,
        investment: {
          toolCost,
          implementationTime,
          maintenanceTime: implementationTime * 0.1,
        },
        returns: {
          timeRecovered: totalTimeRecovered,
          costSavings: totalCostSavings,
          productivityGains,
          qualityImprovements,
        },
        roi: {
          percentage: roi,
          paybackPeriod,
          netBenefit: totalReturns - totalInvestment,
        },
      };
    } catch (error) {
      logger.error('Error generating ROI report:', error);
      throw error;
    }
  }

  /**
   * Export executive report to PDF
   */
  static async exportExecutiveReport(
    organizationId: string,
    reportType: 'executive' | 'project' | 'team' | 'technical-debt' | 'roi',
    periodType: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
  ): Promise<Buffer> {
    try {
      // This would integrate with a PDF generation library like puppeteer or jsPDF
      // For now, we'll return a mock buffer
      logger.info(`Generating PDF report: ${reportType} for organization ${organizationId}`);
      
      // Mock PDF generation
      const mockPdfContent = `Executive Report - ${reportType.toUpperCase()}\n\nGenerated on: ${new Date().toISOString()}\nOrganization: ${organizationId}\nPeriod: ${periodType}`;
      
      return Buffer.from(mockPdfContent, 'utf8');
    } catch (error) {
      logger.error('Error exporting executive report:', error);
      throw error;
    }
  }

  // Helper methods
  private static getPeriodDates(periodType: 'weekly' | 'monthly' | 'quarterly') {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (periodType) {
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
    
    return { startDate, endDate };
  }

  private static async calculateKeyMetrics(organization: any, startDate: Date, endDate: Date) {
    const totalProjects = organization.projects.length;
    const totalFlakyTests = organization.projects.reduce((sum: number, project: any) => {
      return sum + project.flakyTests.length;
    }, 0);
    
    const totalTimeWasted = organization.projects.reduce((sum: number, project: any) => {
      return sum + (project.impactCalculations[0]?.totalTimeWasted || 0);
    }, 0);
    
    const estimatedCostImpact = organization.projects.reduce((sum: number, project: any) => {
      return sum + (project.impactCalculations[0]?.estimatedCostImpact || 0);
    }, 0);
    
    const avgStability = organization.projects.reduce((sum: number, project: any) => {
      return sum + (project.stabilityReports[0]?.overallStability || 0);
    }, 0) / Math.max(totalProjects, 1);

    return {
      totalProjects,
      totalFlakyTests,
      flakyTestTrend: 0, // TODO: Calculate trend
      totalTimeWasted,
      estimatedCostImpact,
      deploymentsDelayed: 0, // TODO: Calculate
      avgResolutionTime: 0, // TODO: Calculate
      testStabilityScore: avgStability,
    };
  }

  private static async calculateRiskAssessment(organization: any, startDate: Date, endDate: Date) {
    const projects = organization.projects;
    const criticalIssues = projects.filter((p: any) => p.flakyTests.length > 10).length;
    const highRiskProjects = projects.filter((p: any) => p.flakyTests.length > 5).length;
    
    return {
      criticalIssues,
      highRiskProjects,
      improvementOpportunities: projects.length - highRiskProjects,
      riskTrend: 'stable' as const,
    };
  }

  private static async calculateBusinessImpact(organization: any, startDate: Date, endDate: Date) {
    const memberCount = organization.members?.length || 10; // Default estimate
    const totalTimeWasted = organization.projects.reduce((sum: number, project: any) => {
      return sum + (project.impactCalculations[0]?.totalTimeWasted || 0);
    }, 0);
    
    const timeWastedPerDeveloper = totalTimeWasted / memberCount;
    const productivityLoss = Math.min(timeWastedPerDeveloper / 160, 0.5) * 100; // Max 50% loss
    
    return {
      developerProductivity: {
        timeWastedPerDeveloper,
        productivityLoss,
      },
      deploymentFrequency: {
        current: 10, // Estimate
        potential: 15, // Estimate
        improvement: 50,
      },
      qualityMetrics: {
        testReliability: 85,
        ciStability: 90,
        customerImpact: 5,
      },
    };
  }

  private static async generateInsights(organization: any, startDate: Date, endDate: Date) {
    const topIssues = [
      {
        category: 'Test Reliability',
        description: 'High failure rate in integration tests',
        impact: 'Delaying releases by 2-3 days',
        recommendation: 'Implement retry logic and improve test isolation',
        priority: 'high' as const,
      },
      {
        category: 'CI/CD Pipeline',
        description: 'Inconsistent test environment setup',
        impact: 'Causing 30% of flaky test failures',
        recommendation: 'Standardize environment configuration',
        priority: 'medium' as const,
      },
    ];

    const achievements = [
      {
        description: 'Reduced flaky test count by 25%',
        impact: 'Saved 40 hours of debugging time',
        value: 4000,
      },
    ];

    const recommendations = [
      {
        action: 'Implement automated test quarantine',
        expectedImpact: 'Reduce CI failures by 50%',
        timeline: '2 weeks',
        effort: 'medium' as const,
      },
      {
        action: 'Set up real-time Slack notifications',
        expectedImpact: 'Improve response time by 3x',
        timeline: '1 week',
        effort: 'low' as const,
      },
    ];

    return {
      topIssues,
      achievements,
      recommendations,
    };
  }

  private static estimateFixTime(confidence: number, effort: string | null): number {
    let baseTime = 2; // Base 2 hours
    
    if (effort === 'high') baseTime = 8;
    else if (effort === 'medium') baseTime = 4;
    else if (effort === 'low') baseTime = 1;
    
    // Adjust based on confidence
    const multiplier = confidence < 0.5 ? 2 : confidence < 0.8 ? 1.5 : 1;
    
    return baseTime * multiplier;
  }
}

export default ExecutiveDashboardService;