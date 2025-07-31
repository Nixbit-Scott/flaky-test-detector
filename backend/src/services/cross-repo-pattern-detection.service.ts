import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CrossRepoPattern {
  id: string;
  patternType: 'infrastructure' | 'dependency' | 'environmental' | 'temporal' | 'framework' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  affectedRepos: string[];
  affectedTests: Array<{
    projectId: string;
    projectName: string;
    testName: string;
    testSuite?: string;
    failureRate: number;
    lastFailure: Date;
  }>;
  commonFactors: {
    timePatterns?: string[]; // Common failure times
    errorPatterns?: string[]; // Similar error messages
    environmentFactors?: string[]; // Common infrastructure/env issues
    dependencyPatterns?: string[]; // Shared dependencies
    frameworkPatterns?: string[]; // Similar test frameworks
    mlInsights?: string[]; // ML-generated insights
  };
  rootCause: {
    primaryCause: string;
    secondaryCauses: string[];
    evidenceStrength: number; // 0-1
    suggestedFixes: string[];
  };
  impactMetrics: {
    totalFailures: number;
    affectedProjectsCount: number;
    estimatedCostImpact: number;
    timeToResolution: number; // estimated days
  };
  detectedAt: Date;
  lastUpdated: Date;
}

export interface PatternAnalysisResult {
  organizationId: string;
  analysisDate: Date;
  detectedPatterns: CrossRepoPattern[];
  patternSummary: {
    totalPatterns: number;
    criticalPatterns: number;
    highImpactPatterns: number;
    mostCommonPatternType: string;
    totalAffectedRepos: number;
    totalEstimatedCost: number;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  trends: {
    newPatternsThisWeek: number;
    resolvedPatternsThisWeek: number;
    avgTimeToResolution: number;
  };
}

export class CrossRepoPatternDetectionService {
  
  public async analyzeOrganizationPatterns(
    organizationId: string,
    timeWindowDays: number = 30
  ): Promise<PatternAnalysisResult> {
    logger.info(`Starting cross-repo pattern analysis for organization ${organizationId}`);

    const since = new Date();
    since.setDate(since.getDate() - timeWindowDays);

    // Get all projects for the organization
    const projects = await this.getOrganizationProjects(organizationId);
    
    if (projects.length < 2) {
      logger.info(`Organization ${organizationId} has fewer than 2 projects, skipping cross-repo analysis`);
      return this.getEmptyAnalysisResult(organizationId);
    }

    // Get flaky test data across all projects
    const flakyTestData = await this.getFlakyTestDataAcrossProjects(projects, since);
    
    // Detect various types of patterns
    const patterns = await this.detectPatterns(flakyTestData, projects);
    
    // Calculate impact metrics and generate recommendations
    const patternSummary = this.calculatePatternSummary(patterns);
    const recommendations = this.generateRecommendations(patterns);
    const trends = await this.calculateTrends(organizationId, timeWindowDays);

    // Store the analysis results
    await this.storePatternAnalysis(organizationId, patterns);

    const result: PatternAnalysisResult = {
      organizationId,
      analysisDate: new Date(),
      detectedPatterns: patterns,
      patternSummary,
      recommendations,
      trends
    };

    logger.info(`Completed cross-repo analysis for ${organizationId}: found ${patterns.length} patterns affecting ${patternSummary.totalAffectedRepos} repos`);
    
    return result;
  }

  private async getOrganizationProjects(organizationId: string) {
    // For now, we'll use teamId as organizationId since we don't have a separate organization entity
    // In a real implementation, you'd have an Organization -> Teams -> Projects hierarchy
    const projects = await prisma.project.findMany({
      where: {
        teamId: organizationId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return projects;
  }

  private async getFlakyTestDataAcrossProjects(projects: any[], since: Date) {
    const projectIds = projects.map(p => p.id);
    
    // Get flaky test patterns from all projects
    const flakyPatterns = await prisma.flakyTestPattern.findMany({
      where: {
        projectId: { in: projectIds },
        lastSeen: { gte: since },
        isActive: true
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            repository: true,
            userId: true
          }
        }
      }
    });

    // Get recent test results for analysis
    const testResults = await prisma.testResult.findMany({
      where: {
        projectId: { in: projectIds },
        timestamp: { gte: since },
        status: 'failed'
      },
      include: {
        testRun: {
          select: {
            projectId: true,
            branch: true,
            commit: true,
            startedAt: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return {
      flakyPatterns,
      testResults,
      projects
    };
  }

  private async detectPatterns(flakyTestData: any, projects: any[]): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    
    // Detect temporal patterns (time-based failures)
    const temporalPatterns = await this.detectTemporalPatterns(flakyTestData);
    patterns.push(...temporalPatterns);

    // Detect infrastructure patterns (similar environment issues)
    const infraPatterns = await this.detectInfrastructurePatterns(flakyTestData);
    patterns.push(...infraPatterns);

    // Detect dependency patterns (shared dependency issues)
    const dependencyPatterns = await this.detectDependencyPatterns(flakyTestData);
    patterns.push(...dependencyPatterns);

    // Detect framework patterns (similar test framework issues)
    const frameworkPatterns = await this.detectFrameworkPatterns(flakyTestData);
    patterns.push(...frameworkPatterns);

    // Detect environmental patterns (CI/CD, region, etc.)
    const environmentalPatterns = await this.detectEnvironmentalPatterns(flakyTestData);
    patterns.push(...environmentalPatterns);

    // NEW: Detect ML-based semantic similarity patterns
    const semanticPatterns = await this.detectSemanticSimilarityPatterns(flakyTestData);
    patterns.push(...semanticPatterns);

    // NEW: Detect cross-repo cascading failure patterns
    const cascadingPatterns = await this.detectCascadingFailurePatterns(flakyTestData);
    patterns.push(...cascadingPatterns);

    // NEW: Detect resource contention patterns
    const resourcePatterns = await this.detectResourceContentionPatterns(flakyTestData);
    patterns.push(...resourcePatterns);

    // Apply ML-based pattern correlation and similarity scoring
    const correlatedPatterns = await this.correlatePatternsWithML(patterns, flakyTestData);

    return correlatedPatterns.filter(p => p.confidence > 0.3); // Filter out low-confidence patterns
  }

  private async detectTemporalPatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { testResults } = flakyTestData;

    // Group failures by hour of day and day of week
    const timeGroups = this.groupFailuresByTime(testResults);
    
    // Look for patterns where multiple repos fail at similar times
    for (const [timeKey, failures] of Object.entries(timeGroups)) {
      const affectedProjects = new Set(failures.map((f: any) => f.testRun.projectId));
      
      if (affectedProjects.size >= 2 && failures.length >= 5) {
        const affectedTests = this.getAffectedTestsFromFailures(failures);
        const pattern = this.createTemporalPattern(timeKey, affectedTests, failures);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async detectInfrastructurePatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { testResults } = flakyTestData;

    // Group by error patterns that suggest infrastructure issues
    const infraErrorPatterns = [
      /connection.*(timeout|refused|reset)/i,
      /network.*(error|timeout|unreachable)/i,
      /dns.*(resolution|lookup|timeout)/i,
      /certificate.*(expired|invalid|verification)/i,
      /memory.*(out of|insufficient|allocation)/i,
      /disk.*(space|full|io)/i,
      /cpu.*(timeout|limit|throttle)/i
    ];

    const errorGroups = this.groupFailuresByErrorPattern(testResults, infraErrorPatterns);

    for (const [errorPattern, failures] of Object.entries(errorGroups)) {
      const affectedProjects = new Set(failures.map((f: any) => f.testRun.projectId));
      
      if (affectedProjects.size >= 2 && failures.length >= 3) {
        const affectedTests = this.getAffectedTestsFromFailures(failures);
        const pattern = this.createInfrastructurePattern(errorPattern, affectedTests, failures);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async detectDependencyPatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { testResults } = flakyTestData;

    // Look for failures related to common dependencies
    const dependencyErrorPatterns = [
      /npm.*(install|package|module)/i,
      /yarn.*(install|package|module)/i,
      /pip.*(install|package|module)/i,
      /maven.*(dependency|artifact|repository)/i,
      /gradle.*(dependency|task|build)/i,
      /docker.*(pull|build|container)/i,
      /node_modules.*(not found|missing)/i
    ];

    const dependencyGroups = this.groupFailuresByErrorPattern(testResults, dependencyErrorPatterns);

    for (const [depPattern, failures] of Object.entries(dependencyGroups)) {
      const affectedProjects = new Set(failures.map((f: any) => f.testRun.projectId));
      
      if (affectedProjects.size >= 2) {
        const affectedTests = this.getAffectedTestsFromFailures(failures);
        const pattern = this.createDependencyPattern(depPattern, affectedTests, failures);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async detectFrameworkPatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { flakyPatterns } = flakyTestData;

    // Group tests by similar names/patterns that might indicate framework issues
    const frameworkGroups = this.groupTestsByFrameworkPatterns(flakyPatterns);

    for (const [framework, tests] of Object.entries(frameworkGroups)) {
      const affectedProjects = new Set(tests.map((t: any) => t.projectId));
      
      if (affectedProjects.size >= 2 && tests.length >= 3) {
        const pattern = this.createFrameworkPattern(framework, tests);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async detectEnvironmentalPatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { testResults } = flakyTestData;

    // Look for patterns based on CI/CD environment characteristics
    const branchGroups = this.groupFailuresByBranch(testResults);
    
    for (const [branch, failures] of Object.entries(branchGroups)) {
      const affectedProjects = new Set(failures.map((f: any) => f.testRun.projectId));
      
      // Look for patterns where multiple projects fail on same branch types
      if (affectedProjects.size >= 2 && failures.length >= 5) {
        const affectedTests = this.getAffectedTestsFromFailures(failures);
        const pattern = this.createEnvironmentalPattern(branch, affectedTests, failures);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private groupFailuresByTime(testResults: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    testResults.forEach(result => {
      const date = new Date(result.timestamp);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const timeKey = `${dayOfWeek}-${hour}`; // e.g., "1-14" for Monday 2PM
      
      if (!groups[timeKey]) {
        groups[timeKey] = [];
      }
      groups[timeKey].push(result);
    });

    return groups;
  }

  private groupFailuresByErrorPattern(testResults: any[], patterns: RegExp[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    testResults.forEach(result => {
      if (!result.errorMessage) return;
      
      for (const pattern of patterns) {
        if (pattern.test(result.errorMessage)) {
          const key = pattern.source;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(result);
          break; // Only match first pattern
        }
      }
    });

    return groups;
  }

  private groupTestsByFrameworkPatterns(flakyPatterns: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      'jest': [],
      'cypress': [],
      'playwright': [],
      'selenium': [],
      'mocha': [],
      'jasmine': []
    };

    flakyPatterns.forEach(pattern => {
      const testName = pattern.testName.toLowerCase();
      
      if (testName.includes('jest') || pattern.testSuite?.includes('jest')) {
        groups['jest'].push(pattern);
      } else if (testName.includes('cypress') || testName.includes('cy.')) {
        groups['cypress'].push(pattern);
      } else if (testName.includes('playwright') || testName.includes('page.')) {
        groups['playwright'].push(pattern);
      } else if (testName.includes('selenium') || testName.includes('webdriver')) {
        groups['selenium'].push(pattern);
      } else if (testName.includes('mocha')) {
        groups['mocha'].push(pattern);
      } else if (testName.includes('jasmine')) {
        groups['jasmine'].push(pattern);
      }
    });

    // Filter out groups with insufficient data
    return Object.fromEntries(
      Object.entries(groups).filter(([_, tests]) => tests.length > 0)
    );
  }

  private groupFailuresByBranch(testResults: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    testResults.forEach(result => {
      const branch = result.testRun.branch || 'unknown';
      // Normalize branch names to detect patterns
      const normalizedBranch = this.normalizeBranchName(branch);
      
      if (!groups[normalizedBranch]) {
        groups[normalizedBranch] = [];
      }
      groups[normalizedBranch].push(result);
    });

    return groups;
  }

  private normalizeBranchName(branch: string): string {
    // Group similar branch patterns
    if (branch.startsWith('feature/') || branch.startsWith('feat/')) return 'feature-branch';
    if (branch.startsWith('hotfix/') || branch.startsWith('fix/')) return 'hotfix-branch';
    if (branch.startsWith('release/') || branch.startsWith('rel/')) return 'release-branch';
    if (branch === 'main' || branch === 'master') return 'main-branch';
    if (branch.startsWith('develop') || branch.startsWith('dev')) return 'dev-branch';
    return 'other-branch';
  }

  private getAffectedTestsFromFailures(failures: any[]) {
    const testMap = new Map();
    
    failures.forEach(failure => {
      const key = `${failure.testRun.projectId}-${failure.testName}`;
      if (!testMap.has(key)) {
        testMap.set(key, {
          projectId: failure.testRun.projectId,
          projectName: failure.testRun.projectId, // Would need to get actual name
          testName: failure.testName,
          testSuite: failure.testSuite,
          failureRate: 0,
          lastFailure: failure.timestamp,
          failures: []
        });
      }
      testMap.get(key).failures.push(failure);
      testMap.get(key).lastFailure = new Date(Math.max(
        new Date(testMap.get(key).lastFailure).getTime(),
        new Date(failure.timestamp).getTime()
      ));
    });

    // Calculate failure rates and return as array
    return Array.from(testMap.values()).map(test => ({
      projectId: test.projectId,
      projectName: test.projectName,
      testName: test.testName,
      testSuite: test.testSuite,
      failureRate: test.failures.length, // Simplified - would need total runs
      lastFailure: test.lastFailure
    }));
  }

  private createTemporalPattern(timeKey: string, affectedTests: any[], failures: any[]): CrossRepoPattern {
    const [dayOfWeek, hour] = timeKey.split('-');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      id: `temporal-${timeKey}-${Date.now()}`,
      patternType: 'temporal',
      severity: this.calculateSeverity(affectedTests.length, failures.length),
      confidence: Math.min(0.8, failures.length / 10), // Higher confidence with more failures
      affectedRepos: [...new Set(affectedTests.map(t => t.projectId))],
      affectedTests,
      commonFactors: {
        timePatterns: [`${dayNames[parseInt(dayOfWeek)]} at ${hour}:00`]
      },
      rootCause: {
        primaryCause: `Time-based infrastructure or deployment pattern`,
        secondaryCauses: [
          'Scheduled maintenance windows',
          'Peak traffic periods',
          'Automated deployment processes',
          'Resource contention during peak hours'
        ],
        evidenceStrength: Math.min(0.9, failures.length / 15),
        suggestedFixes: [
          'Investigate infrastructure scheduling',
          'Check for automated processes at this time',
          'Monitor resource usage patterns',
          'Consider distributing deployments across time windows'
        ]
      },
      impactMetrics: {
        totalFailures: failures.length,
        affectedProjectsCount: affectedTests.length,
        estimatedCostImpact: failures.length * 50, // $50 per failure
        timeToResolution: 3 // estimated days
      },
      detectedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  private createInfrastructurePattern(errorPattern: string, affectedTests: any[], failures: any[]): CrossRepoPattern {
    return {
      id: `infra-${Date.now()}`,
      patternType: 'infrastructure',
      severity: this.calculateSeverity(affectedTests.length, failures.length),
      confidence: Math.min(0.9, failures.length / 8),
      affectedRepos: [...new Set(affectedTests.map(t => t.projectId))],
      affectedTests,
      commonFactors: {
        errorPatterns: [errorPattern],
        environmentFactors: ['Infrastructure reliability', 'Network connectivity', 'Resource availability']
      },
      rootCause: {
        primaryCause: 'Infrastructure reliability issue',
        secondaryCauses: [
          'Network connectivity problems',
          'Resource exhaustion',
          'Service dependencies',
          'Infrastructure configuration'
        ],
        evidenceStrength: Math.min(0.95, failures.length / 10),
        suggestedFixes: [
          'Review infrastructure monitoring',
          'Check service health and dependencies',
          'Implement circuit breakers and retries',
          'Review resource allocation and scaling'
        ]
      },
      impactMetrics: {
        totalFailures: failures.length,
        affectedProjectsCount: affectedTests.length,
        estimatedCostImpact: failures.length * 75, // Higher cost for infra issues
        timeToResolution: 5 // estimated days
      },
      detectedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  private createDependencyPattern(depPattern: string, affectedTests: any[], failures: any[]): CrossRepoPattern {
    return {
      id: `dependency-${Date.now()}`,
      patternType: 'dependency',
      severity: this.calculateSeverity(affectedTests.length, failures.length),
      confidence: Math.min(0.85, failures.length / 6),
      affectedRepos: [...new Set(affectedTests.map(t => t.projectId))],
      affectedTests,
      commonFactors: {
        dependencyPatterns: [depPattern],
        errorPatterns: [depPattern]
      },
      rootCause: {
        primaryCause: 'Shared dependency issue',
        secondaryCauses: [
          'Package version conflicts',
          'Registry availability',
          'Dependency installation failures',
          'Build tool configuration'
        ],
        evidenceStrength: Math.min(0.9, failures.length / 8),
        suggestedFixes: [
          'Pin dependency versions',
          'Review package registry configuration',
          'Implement dependency caching',
          'Update build tool configurations'
        ]
      },
      impactMetrics: {
        totalFailures: failures.length,
        affectedProjectsCount: affectedTests.length,
        estimatedCostImpact: failures.length * 40,
        timeToResolution: 2 // estimated days
      },
      detectedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  private createFrameworkPattern(framework: string, tests: any[]): CrossRepoPattern {
    return {
      id: `framework-${framework}-${Date.now()}`,
      patternType: 'framework',
      severity: this.calculateSeverity(tests.length, tests.length * 2),
      confidence: Math.min(0.75, tests.length / 5),
      affectedRepos: [...new Set(tests.map(t => t.projectId))],
      affectedTests: tests.map(t => ({
        projectId: t.projectId,
        projectName: t.project.name,
        testName: t.testName,
        testSuite: t.testSuite,
        failureRate: t.failureRate,
        lastFailure: t.lastSeen
      })),
      commonFactors: {
        frameworkPatterns: [framework]
      },
      rootCause: {
        primaryCause: `${framework} test framework issue`,
        secondaryCauses: [
          'Framework version compatibility',
          'Configuration differences',
          'Plugin or extension issues',
          'Test setup/teardown problems'
        ],
        evidenceStrength: Math.min(0.8, tests.length / 6),
        suggestedFixes: [
          `Review ${framework} configuration across projects`,
          'Standardize framework versions',
          'Check for framework-specific best practices',
          'Implement consistent test patterns'
        ]
      },
      impactMetrics: {
        totalFailures: tests.length * 2,
        affectedProjectsCount: tests.length,
        estimatedCostImpact: tests.length * 60,
        timeToResolution: 4 // estimated days
      },
      detectedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  private createEnvironmentalPattern(branch: string, affectedTests: any[], failures: any[]): CrossRepoPattern {
    return {
      id: `env-${branch}-${Date.now()}`,
      patternType: 'environmental',
      severity: this.calculateSeverity(affectedTests.length, failures.length),
      confidence: Math.min(0.7, failures.length / 8),
      affectedRepos: [...new Set(affectedTests.map(t => t.projectId))],
      affectedTests,
      commonFactors: {
        environmentFactors: [`Branch pattern: ${branch}`]
      },
      rootCause: {
        primaryCause: `Environment-specific issue on ${branch} branches`,
        secondaryCauses: [
          'CI/CD pipeline configuration',
          'Environment-specific variables',
          'Branch-specific workflows',
          'Deployment environment differences'
        ],
        evidenceStrength: Math.min(0.75, failures.length / 10),
        suggestedFixes: [
          'Review CI/CD pipeline configuration',
          'Check environment variable consistency',
          'Validate branch-specific workflows',
          'Ensure environment parity'
        ]
      },
      impactMetrics: {
        totalFailures: failures.length,
        affectedProjectsCount: affectedTests.length,
        estimatedCostImpact: failures.length * 45,
        timeToResolution: 3 // estimated days
      },
      detectedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  private calculateSeverity(affectedProjects: number, totalFailures: number): 'low' | 'medium' | 'high' | 'critical' {
    if (affectedProjects >= 5 || totalFailures >= 20) return 'critical';
    if (affectedProjects >= 3 || totalFailures >= 10) return 'high';
    if (affectedProjects >= 2 || totalFailures >= 5) return 'medium';
    return 'low';
  }

  private calculatePatternSummary(patterns: CrossRepoPattern[]) {
    const criticalPatterns = patterns.filter(p => p.severity === 'critical').length;
    const highImpactPatterns = patterns.filter(p => p.severity === 'high' || p.severity === 'critical').length;
    const totalAffectedRepos = new Set(patterns.flatMap(p => p.affectedRepos)).size;
    const totalEstimatedCost = patterns.reduce((sum, p) => sum + p.impactMetrics.estimatedCostImpact, 0);
    
    // Find most common pattern type
    const patternTypeCounts = patterns.reduce((counts, p) => {
      counts[p.patternType] = (counts[p.patternType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const mostCommonPatternType = Object.entries(patternTypeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    return {
      totalPatterns: patterns.length,
      criticalPatterns,
      highImpactPatterns,
      mostCommonPatternType,
      totalAffectedRepos,
      totalEstimatedCost
    };
  }

  private generateRecommendations(patterns: CrossRepoPattern[]) {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    const criticalPatterns = patterns.filter(p => p.severity === 'critical');
    const infraPatterns = patterns.filter(p => p.patternType === 'infrastructure');
    const dependencyPatterns = patterns.filter(p => p.patternType === 'dependency');
    const temporalPatterns = patterns.filter(p => p.patternType === 'temporal');

    // Immediate actions for critical patterns
    if (criticalPatterns.length > 0) {
      immediate.push(`Address ${criticalPatterns.length} critical cross-repo patterns immediately`);
      immediate.push('Investigate highest-confidence patterns first');
    }

    if (infraPatterns.length > 0) {
      immediate.push('Review infrastructure health and monitoring');
    }

    // Short-term recommendations
    if (dependencyPatterns.length > 0) {
      shortTerm.push('Standardize dependency management across repositories');
      shortTerm.push('Implement centralized package registry configuration');
    }

    if (temporalPatterns.length > 0) {
      shortTerm.push('Investigate time-based failure patterns');
      shortTerm.push('Review automated processes and maintenance windows');
    }

    shortTerm.push('Implement cross-repository monitoring and alerting');

    // Long-term recommendations
    longTerm.push('Establish consistent CI/CD patterns across repositories');
    longTerm.push('Implement organization-wide testing standards');
    longTerm.push('Create shared infrastructure and tooling');
    longTerm.push('Develop cross-team collaboration on testing practices');

    return { immediate, shortTerm, longTerm };
  }

  private async calculateTrends(organizationId: string, timeWindowDays: number) {
    // This would track patterns over time - simplified for now
    return {
      newPatternsThisWeek: 0,
      resolvedPatternsThisWeek: 0,
      avgTimeToResolution: 0
    };
  }

  private async storePatternAnalysis(organizationId: string, patterns: CrossRepoPattern[]) {
    try {
      await prisma.crossRepoPatternAnalysis.create({
        data: {
          organizationId,
          analysisDate: new Date(),
          detectedPatterns: patterns as any,
          patternCount: patterns.length,
          analysisVersion: 'v1.0'
        }
      });

      logger.info(`Stored cross-repo pattern analysis for organization ${organizationId}: ${patterns.length} patterns`);
    } catch (error) {
      logger.error('Error storing pattern analysis:', error);
    }
  }

  private getEmptyAnalysisResult(organizationId: string): PatternAnalysisResult {
    return {
      organizationId,
      analysisDate: new Date(),
      detectedPatterns: [],
      patternSummary: {
        totalPatterns: 0,
        criticalPatterns: 0,
        highImpactPatterns: 0,
        mostCommonPatternType: 'none',
        totalAffectedRepos: 0,
        totalEstimatedCost: 0
      },
      recommendations: {
        immediate: ['Add more repositories to enable cross-repo pattern detection'],
        shortTerm: ['Ensure consistent test data collection across projects'],
        longTerm: ['Build organization-wide testing practices']
      },
      trends: {
        newPatternsThisWeek: 0,
        resolvedPatternsThisWeek: 0,
        avgTimeToResolution: 0
      }
    };
  }

  public async getPatternDetails(patternId: string): Promise<CrossRepoPattern | null> {
    try {
      const analysis = await prisma.crossRepoPatternAnalysis.findFirst({
        where: {
          detectedPatterns: {
            path: ['$[*].id'],
            equals: patternId
          }
        }
      });

      if (!analysis) return null;

      const patterns = analysis.detectedPatterns as any as CrossRepoPattern[];
      return patterns.find(p => p.id === patternId) || null;
    } catch (error) {
      logger.error('Error fetching pattern details:', error);
      return null;
    }
  }

  public async markPatternResolved(patternId: string, resolutionNotes: string): Promise<void> {
    try {
      // In a real implementation, you'd update the pattern status
      // For now, we'll log the resolution
      logger.info(`Pattern ${patternId} marked as resolved: ${resolutionNotes}`);
    } catch (error) {
      logger.error('Error marking pattern as resolved:', error);
    }
  }

  // NEW: Advanced ML-based pattern detection methods

  private async detectSemanticSimilarityPatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { testResults, flakyPatterns } = flakyTestData;

    // Group test failures by semantic similarity of error messages
    const errorGroups = this.groupErrorsBySementicSimilarity(testResults);
    
    for (const [errorSignature, failures] of Object.entries(errorGroups)) {
      const affectedProjects = new Set(failures.map((f: any) => f.testRun.projectId));
      
      if (affectedProjects.size >= 2 && failures.length >= 3) {
        const affectedTests = this.getAffectedTestsFromFailures(failures);
        const similarityScore = this.calculateSemanticSimilarityScore(failures);
        
        const pattern: CrossRepoPattern = {
          id: `semantic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patternType: 'unknown', // Will be classified by ML
          severity: this.calculateSeverity(affectedTests.length, failures.length),
          confidence: Math.min(0.95, similarityScore),
          affectedRepos: [...affectedProjects],
          affectedTests,
          commonFactors: {
            errorPatterns: [errorSignature],
            environmentFactors: this.extractCommonEnvironmentalFactors(failures)
          },
          rootCause: {
            primaryCause: `Semantic similarity pattern: ${this.classifyErrorPattern(errorSignature)}`,
            secondaryCauses: this.extractSemanticCauses(failures),
            evidenceStrength: similarityScore,
            suggestedFixes: this.generateSemanticBasedFixes(errorSignature, failures)
          },
          impactMetrics: {
            totalFailures: failures.length,
            affectedProjectsCount: affectedTests.length,
            estimatedCostImpact: failures.length * 65, // Higher cost for complex patterns
            timeToResolution: Math.ceil(similarityScore * 7) // 1-7 days based on complexity
          },
          detectedAt: new Date(),
          lastUpdated: new Date()
        };

        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async detectCascadingFailurePatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { testResults } = flakyTestData;

    // Analyze temporal relationships between failures across repositories
    const timeWindowMinutes = 30;
    const cascadingGroups = this.identifyCascadingFailures(testResults, timeWindowMinutes);

    for (const cascade of cascadingGroups) {
      if (cascade.affectedRepos.size >= 2 && cascade.totalFailures >= 5) {
        const affectedTests = this.getAffectedTestsFromFailures(cascade.failures);
        const cascadeConfidence = this.calculateCascadeConfidence(cascade);

        const pattern: CrossRepoPattern = {
          id: `cascade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patternType: 'infrastructure',
          severity: cascade.affectedRepos.size >= 4 ? 'critical' : 'high',
          confidence: cascadeConfidence,
          affectedRepos: [...cascade.affectedRepos],
          affectedTests,
          commonFactors: {
            timePatterns: [`Cascading failure pattern over ${timeWindowMinutes} minutes`],
            environmentFactors: [
              'Service dependency chain failure',
              'Infrastructure cascade effect',
              'Shared resource exhaustion'
            ]
          },
          rootCause: {
            primaryCause: 'Cascading failure across dependent services',
            secondaryCauses: [
              'Upstream service degradation',
              'Resource exhaustion propagation',
              'Circuit breaker activation',
              'Database connection pool exhaustion'
            ],
            evidenceStrength: cascadeConfidence,
            suggestedFixes: [
              'Implement circuit breakers between services',
              'Add service dependency health checks',
              'Review resource allocation and scaling',
              'Implement gradual degradation strategies',
              'Add service isolation mechanisms'
            ]
          },
          impactMetrics: {
            totalFailures: cascade.totalFailures,
            affectedProjectsCount: cascade.affectedRepos.size,
            estimatedCostImpact: cascade.totalFailures * 85, // High cost for cascading failures
            timeToResolution: 5 // Complex infrastructure issues
          },
          detectedAt: new Date(),
          lastUpdated: new Date()
        };

        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async detectResourceContentionPatterns(flakyTestData: any): Promise<CrossRepoPattern[]> {
    const patterns: CrossRepoPattern[] = [];
    const { testResults } = flakyTestData;

    // Analyze resource usage patterns that correlate with failures
    const resourceGroups = await this.analyzeResourceContentionPatterns(testResults);

    for (const [resourceType, contentionData] of Object.entries(resourceGroups)) {
      if (contentionData.affectedRepos.size >= 2 && contentionData.correlationScore > 0.7) {
        const affectedTests = this.getAffectedTestsFromFailures(contentionData.failures);

        const pattern: CrossRepoPattern = {
          id: `resource-${resourceType}-${Date.now()}`,
          patternType: 'infrastructure',
          severity: contentionData.correlationScore > 0.9 ? 'high' : 'medium',
          confidence: contentionData.correlationScore,
          affectedRepos: [...contentionData.affectedRepos],
          affectedTests,
          commonFactors: {
            environmentFactors: [
              `${resourceType} contention pattern`,
              'Resource usage correlation',
              'Performance degradation indicator'
            ]
          },
          rootCause: {
            primaryCause: `Resource contention in ${resourceType}`,
            secondaryCauses: [
              'Insufficient resource allocation',
              'Poor resource management',
              'Concurrent resource access',
              'Resource leak or buildup'
            ],
            evidenceStrength: contentionData.correlationScore,
            suggestedFixes: [
              `Increase ${resourceType} allocation`,
              'Implement resource pooling',
              'Add resource monitoring and alerting',
              'Review resource cleanup procedures',
              'Implement resource usage limits'
            ]
          },
          impactMetrics: {
            totalFailures: contentionData.failures.length,
            affectedProjectsCount: contentionData.affectedRepos.size,
            estimatedCostImpact: contentionData.failures.length * 55,
            timeToResolution: 3
          },
          detectedAt: new Date(),
          lastUpdated: new Date()
        };

        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async correlatePatternsWithML(patterns: CrossRepoPattern[], flakyTestData: any): Promise<CrossRepoPattern[]> {
    // Apply ML-based correlation to enhance pattern detection
    const enhancedPatterns: CrossRepoPattern[] = [];

    for (const pattern of patterns) {
      // Calculate pattern similarity with historical data
      const historicalSimilarity = await this.calculateHistoricalSimilarity(pattern);
      
      // Enhance confidence based on historical patterns
      const enhancedConfidence = Math.min(0.99, pattern.confidence + (historicalSimilarity * 0.2));
      
      // Re-classify pattern type based on ML analysis
      const mlClassification = this.classifyPatternWithML(pattern, flakyTestData);
      
      // Update root cause analysis with ML insights
      const enhancedRootCause = await this.enhanceRootCauseWithML(pattern.rootCause, pattern);

      const enhancedPattern: CrossRepoPattern = {
        ...pattern,
        confidence: enhancedConfidence,
        patternType: (mlClassification.type as CrossRepoPattern['patternType']) || pattern.patternType,
        rootCause: enhancedRootCause,
        // Add ML-specific metadata
        commonFactors: {
          ...pattern.commonFactors,
          mlInsights: mlClassification.insights || []
        }
      };

      enhancedPatterns.push(enhancedPattern);
    }

    // Merge similar patterns to reduce noise
    return this.mergeSimilarPatterns(enhancedPatterns);
  }

  // Helper methods for advanced pattern detection

  private groupErrorsBySementicSimilarity(testResults: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    for (const result of testResults) {
      if (!result.errorMessage) continue;
      
      const signature = this.extractErrorSignature(result.errorMessage);
      if (!groups[signature]) {
        groups[signature] = [];
      }
      groups[signature].push(result);
    }

    return groups;
  }

  private extractErrorSignature(errorMessage: string): string {
    // Extract semantic signature from error message
    const normalized = errorMessage
      .toLowerCase()
      .replace(/\d+/g, 'NUM') // Replace numbers
      .replace(/[a-f0-9]{8,}/g, 'HEX') // Replace hex values
      .replace(/\/[^\/\s]+/g, '/PATH') // Replace file paths
      .replace(/\b\w+Error\b/g, 'ERROR') // Normalize error types
      .substring(0, 200); // Limit length

    return normalized;
  }

  private calculateSemanticSimilarityScore(failures: any[]): number {
    if (failures.length < 2) return 0;

    // Calculate similarity based on error message patterns, timing, and context
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < failures.length - 1; i++) {
      for (let j = i + 1; j < failures.length; j++) {
        const similarity = this.calculatePairwiseSimilarity(failures[i], failures[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculatePairwiseSimilarity(failure1: any, failure2: any): number {
    let similarity = 0;
    let factors = 0;

    // Error message similarity
    if (failure1.errorMessage && failure2.errorMessage) {
      similarity += this.stringSimilarity(failure1.errorMessage, failure2.errorMessage);
      factors++;
    }

    // Test name similarity
    if (failure1.testName && failure2.testName) {
      similarity += this.stringSimilarity(failure1.testName, failure2.testName) * 0.5;
      factors++;
    }

    // Timing similarity (same hour of day)
    const time1 = new Date(failure1.timestamp).getHours();
    const time2 = new Date(failure2.timestamp).getHours();
    if (Math.abs(time1 - time2) <= 1) {
      similarity += 0.3;
    }
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  private stringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity for strings
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private identifyCascadingFailures(testResults: any[], timeWindowMinutes: number) {
    const cascades: any[] = [];
    const sortedResults = testResults.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < sortedResults.length; i++) {
      const initialFailure = sortedResults[i];
      const cascadeWindow = new Date(initialFailure.timestamp);
      cascadeWindow.setMinutes(cascadeWindow.getMinutes() + timeWindowMinutes);

      const cascade = {
        initialFailure,
        failures: [initialFailure],
        affectedRepos: new Set([initialFailure.testRun.projectId]),
        totalFailures: 1,
        timeSpan: 0
      };

      for (let j = i + 1; j < sortedResults.length; j++) {
        const currentFailure = sortedResults[j];
        const failureTime = new Date(currentFailure.timestamp);

        if (failureTime <= cascadeWindow) {
          cascade.failures.push(currentFailure);
          cascade.affectedRepos.add(currentFailure.testRun.projectId);
          cascade.totalFailures++;
          cascade.timeSpan = failureTime.getTime() - new Date(initialFailure.timestamp).getTime();
        } else {
          break;
        }
      }

      if (cascade.totalFailures >= 3 && cascade.affectedRepos.size >= 2) {
        cascades.push(cascade);
      }
    }

    // Remove overlapping cascades, keep the largest ones
    return this.deduplicateCascades(cascades);
  }

  private calculateCascadeConfidence(cascade: any): number {
    // Calculate confidence based on failure density, repo spread, and timing
    const timeDensity = cascade.totalFailures / (cascade.timeSpan / (1000 * 60)); // failures per minute
    const repoSpread = cascade.affectedRepos.size / 10; // normalize to 0-1 range
    const failureCount = Math.min(cascade.totalFailures / 20, 1); // normalize to 0-1 range

    return Math.min(0.95, (timeDensity * 0.4 + repoSpread * 0.3 + failureCount * 0.3));
  }

  private deduplicateCascades(cascades: any[]): any[] {
    // Remove overlapping cascades, keeping the ones with highest confidence
    return cascades.sort((a, b) => b.totalFailures - a.totalFailures).slice(0, 5);
  }

  private async analyzeResourceContentionPatterns(testResults: any[]) {
    // Analyze patterns in resource usage that correlate with failures
    const resourceTypes = ['memory', 'cpu', 'disk', 'network', 'database'];
    const patterns: Record<string, any> = {};

    for (const resourceType of resourceTypes) {
      const failures = testResults.filter(result => 
        result.errorMessage && this.isResourceRelatedError(result.errorMessage, resourceType)
      );

      if (failures.length >= 3) {
        const affectedRepos = new Set(failures.map(f => f.testRun.projectId));
        
        if (affectedRepos.size >= 2) {
          patterns[resourceType] = {
            failures,
            affectedRepos,
            correlationScore: this.calculateResourceCorrelation(failures, resourceType)
          };
        }
      }
    }

    return patterns;
  }

  private isResourceRelatedError(errorMessage: string, resourceType: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      memory: [/out of memory/i, /memory allocation/i, /heap/i, /oom/i],
      cpu: [/timeout/i, /cpu/i, /throttle/i, /execution time/i],
      disk: [/disk/i, /space/i, /storage/i, /write.*fail/i],
      network: [/network/i, /connection/i, /timeout/i, /unreachable/i],
      database: [/database/i, /connection.*pool/i, /deadlock/i, /query.*timeout/i]
    };

    return patterns[resourceType]?.some(pattern => pattern.test(errorMessage)) || false;
  }

  private calculateResourceCorrelation(failures: any[], resourceType: string): number {
    // Calculate correlation based on timing patterns and error similarity
    if (failures.length < 2) return 0;

    // Check if failures cluster in time (indicating resource contention)
    const timestamps = failures.map(f => new Date(f.timestamp).getTime());
    timestamps.sort((a, b) => a - b);

    let clusteredFailures = 0;
    const clusterWindow = 10 * 60 * 1000; // 10 minutes

    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i-1] <= clusterWindow) {
        clusteredFailures++;
      }
    }

    const clusteringScore = clusteredFailures / (timestamps.length - 1);
    
    // Combine with error message similarity
    const avgSimilarity = this.calculateSemanticSimilarityScore(failures);
    
    return Math.min(0.95, (clusteringScore + avgSimilarity) / 2);
  }

  private extractCommonEnvironmentalFactors(failures: any[]): string[] {
    const factors = new Set<string>();
    
    // Extract common patterns from failure contexts
    failures.forEach(failure => {
      if (failure.testRun?.branch?.includes('main')) factors.add('Main branch deployment');
      if (failure.errorMessage?.includes('timeout')) factors.add('Timeout-related issue');
      if (failure.errorMessage?.includes('connection')) factors.add('Connection issue');
    });

    return Array.from(factors);
  }

  private classifyErrorPattern(errorSignature: string): string {
    if (errorSignature.includes('timeout')) return 'Timeout-based failure pattern';
    if (errorSignature.includes('connection')) return 'Connection failure pattern';
    if (errorSignature.includes('memory')) return 'Memory-related failure pattern';
    if (errorSignature.includes('database')) return 'Database connectivity pattern';
    return 'Complex error pattern requiring analysis';
  }

  private extractSemanticCauses(failures: any[]): string[] {
    const causes = new Set<string>();
    
    failures.forEach(failure => {
      if (failure.errorMessage?.includes('timeout')) {
        causes.add('Network or service timeout issues');
      }
      if (failure.errorMessage?.includes('connection')) {
        causes.add('Database or service connection problems');
      }
      if (failure.errorMessage?.includes('memory')) {
        causes.add('Memory allocation or leak issues');
      }
    });

    return Array.from(causes);
  }

  private generateSemanticBasedFixes(errorSignature: string, failures: any[]): string[] {
    const fixes: string[] = ['Analyze error patterns across repositories'];
    
    if (errorSignature.includes('timeout')) {
      fixes.push('Increase timeout thresholds');
      fixes.push('Optimize slow operations');
      fixes.push('Implement retry mechanisms');
    }
    
    if (errorSignature.includes('connection')) {
      fixes.push('Review connection pool settings');
      fixes.push('Implement connection retry logic');
      fixes.push('Check network configuration');
    }
    
    if (errorSignature.includes('memory')) {
      fixes.push('Review memory allocation patterns');
      fixes.push('Check for memory leaks');
      fixes.push('Increase available memory');
    }

    return fixes;
  }

  private async calculateHistoricalSimilarity(pattern: CrossRepoPattern): Promise<number> {
    // In a real implementation, this would compare against historical patterns
    // For now, return a simulated similarity score
    return Math.random() * 0.3; // 0-0.3 boost based on historical data
  }

  private classifyPatternWithML(pattern: CrossRepoPattern, flakyTestData: any): { type: string; insights: string[] } {
    // ML-based pattern classification
    const insights: string[] = [];
    let type = pattern.patternType;

    // Analyze error patterns for better classification
    const errorPatterns = pattern.commonFactors.errorPatterns || [];
    
    if (errorPatterns.some(p => p.includes('connection') || p.includes('network'))) {
      type = 'infrastructure';
      insights.push('Network connectivity pattern detected');
    }
    
    if (errorPatterns.some(p => p.includes('timeout') || p.includes('performance'))) {
      type = 'environmental';
      insights.push('Performance degradation pattern detected');
    }
    
    if (pattern.affectedRepos.length >= 4) {
      insights.push('Wide-spread organizational issue detected');
    }

    return { type, insights };
  }

  private async enhanceRootCauseWithML(rootCause: CrossRepoPattern['rootCause'], pattern: CrossRepoPattern): Promise<CrossRepoPattern['rootCause']> {
    // Enhance root cause analysis with ML insights
    const enhancedCauses = [...rootCause.secondaryCauses];
    const enhancedFixes = [...rootCause.suggestedFixes];

    // Add ML-generated insights
    if (pattern.affectedRepos.length >= 3) {
      enhancedCauses.push('Cross-team coordination issue');
      enhancedFixes.push('Implement cross-team testing standards');
    }

    if (pattern.confidence > 0.8) {
      enhancedFixes.push('High-confidence pattern - prioritize immediate resolution');
    }

    return {
      ...rootCause,
      secondaryCauses: enhancedCauses,
      suggestedFixes: enhancedFixes,
      evidenceStrength: Math.min(0.99, rootCause.evidenceStrength + 0.1) // ML boost
    };
  }

  private mergeSimilarPatterns(patterns: CrossRepoPattern[]): CrossRepoPattern[] {
    // Merge patterns that are very similar to reduce noise
    const merged: CrossRepoPattern[] = [];
    const processed = new Set<string>();

    for (const pattern of patterns) {
      if (processed.has(pattern.id)) continue;

      const similar = patterns.filter(p => 
        p.id !== pattern.id && 
        !processed.has(p.id) && 
        this.arePatternsSimilar(pattern, p)
      );

      if (similar.length > 0) {
        // Merge similar patterns
        const mergedPattern = this.mergePatterns(pattern, similar);
        merged.push(mergedPattern);
        
        processed.add(pattern.id);
        similar.forEach(p => processed.add(p.id));
      } else {
        merged.push(pattern);
        processed.add(pattern.id);
      }
    }

    return merged;
  }

  private arePatternsSimilar(pattern1: CrossRepoPattern, pattern2: CrossRepoPattern): boolean {
    // Check if patterns are similar enough to merge
    return (
      pattern1.patternType === pattern2.patternType &&
      pattern1.severity === pattern2.severity &&
      this.calculateOverlap(pattern1.affectedRepos, pattern2.affectedRepos) > 0.6
    );
  }

  private calculateOverlap(array1: string[], array2: string[]): number {
    const set1 = new Set(array1);
    const set2 = new Set(array2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private mergePatterns(primary: CrossRepoPattern, similar: CrossRepoPattern[]): CrossRepoPattern {
    // Merge similar patterns into one comprehensive pattern
    const allPatterns = [primary, ...similar];
    
    const mergedRepos = new Set<string>();
    const mergedTests: CrossRepoPattern['affectedTests'] = [];
    let totalFailures = 0;
    let totalCost = 0;

    allPatterns.forEach(pattern => {
      pattern.affectedRepos.forEach(repo => mergedRepos.add(repo));
      mergedTests.push(...pattern.affectedTests);
      totalFailures += pattern.impactMetrics.totalFailures;
      totalCost += pattern.impactMetrics.estimatedCostImpact;
    });

    return {
      ...primary,
      id: `merged-${primary.id}`,
      affectedRepos: Array.from(mergedRepos),
      affectedTests: mergedTests,
      confidence: Math.min(0.99, primary.confidence + 0.1), // Boost confidence for merged patterns
      impactMetrics: {
        ...primary.impactMetrics,
        totalFailures,
        estimatedCostImpact: totalCost,
        affectedProjectsCount: mergedRepos.size
      },
      rootCause: {
        ...primary.rootCause,
        primaryCause: `Merged pattern: ${primary.rootCause.primaryCause}`,
        evidenceStrength: Math.min(0.99, primary.rootCause.evidenceStrength + 0.15)
      }
    };
  }
}