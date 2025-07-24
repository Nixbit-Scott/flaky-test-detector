export interface QuarantinedTest {
  id: string;
  testName: string;
  testSuite?: string;
  projectId: string;
  failureRate: number;
  totalRuns: number;
  failedRuns: number;
  confidence: number;
  isQuarantined: boolean;
  quarantinedAt?: Date;
  quarantinedBy?: string;
  quarantineReason?: string;
  quarantineDays: number;
  latestHistory?: QuarantineHistoryEntry;
  currentImpact?: QuarantineImpact;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuarantineHistoryEntry {
  id: string;
  action: 'quarantined' | 'unquarantined' | 'extended';
  reason?: string;
  triggeredBy?: string;
  metadata?: Record<string, any>;
  failureRate?: number;
  confidence?: number;
  consecutiveFailures?: number;
  impactScore?: number;
  createdAt: Date;
}

export interface QuarantineImpact {
  id: string;
  projectId: string;
  flakyTestPatternId: string;
  buildsBlocked: number;
  ciTimeWasted: number; // minutes
  developerHours: number;
  falsePositives: number;
  quarantinePeriod: number; // days
  autoUnquarantined: boolean;
  manualIntervention: boolean;
  periodStart: Date;
  periodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuarantinePolicy {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isActive: boolean;
  
  // Quarantine triggers
  failureRateThreshold: number;
  confidenceThreshold: number;
  consecutiveFailures: number;
  minRunsRequired: number;
  
  // Auto-unquarantine rules
  stabilityPeriod: number;
  successRateRequired: number;
  minSuccessfulRuns: number;
  
  // Impact calculation
  highImpactSuites: string[];
  priorityTests: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface QuarantinePolicyConfig {
  failureRateThreshold: number;
  confidenceThreshold: number;
  consecutiveFailures: number;
  minRunsRequired: number;
  stabilityPeriod: number;
  successRateRequired: number;
  minSuccessfulRuns: number;
  highImpactSuites: string[];
  priorityTests: string[];
  enableRapidDegradation: boolean;
  enableCriticalPathProtection: boolean;
  enableTimeBasedRules: boolean;
  maxQuarantinePeriod?: number;
  maxQuarantinePercentage?: number;
}

export interface QuarantineStats {
  totalQuarantined: number;
  autoQuarantined: number;
  manualQuarantined: number;
  autoUnquarantined: number;
  quarantineSavings: {
    ciTimeMinutes: number;
    developerHours: number;
    buildsProtected: number;
  };
  avgQuarantineDays: number;
  falsePositiveRate: number;
}

export interface QuarantineSummary {
  totalQuarantined: number;
  currentlyQuarantined: number;
  autoQuarantined: number;
  manualQuarantined: number;
  autoUnquarantined: number;
  manualUnquarantined: number;
  avgQuarantineDuration: number;
  longestQuarantine: number;
}

export interface QuarantineTrends {
  daily: Array<{
    date: string;
    quarantined: number;
    unquarantined: number;
    net: number;
  }>;
  categoryDistribution: Record<string, number>;
  topQuarantinedTests: Array<{
    testName: string;
    testSuite?: string;
    quarantineDays: number;
    reason: string;
  }>;
}

export interface QuarantineImpactMetrics {
  ciTimeSaved: number;
  developerHoursSaved: number;
  buildsProtected: number;
  costSavings: {
    ciCostSaved: number;
    developerCostSaved: number;
    totalSaved: number;
  };
  productivity: {
    testStabilityImprovement: number;
    buildSuccessRateImprovement: number;
    falsePositiveRate: number;
  };
}

export interface QuarantineEffectiveness {
  accuracyMetrics: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  unquarantineSuccess: {
    successfulUnquarantines: number;
    prematureUnquarantines: number;
    successRate: number;
  };
  policyEffectiveness: {
    policyName?: string;
    coverage: number;
    avgConfidenceScore: number;
    rulesTriggered: Record<string, number>;
  };
}

export interface QuarantineAnalytics {
  summary: QuarantineSummary;
  trends: QuarantineTrends;
  impact: QuarantineImpactMetrics;
  effectiveness: QuarantineEffectiveness;
  recommendations: string[];
}

export interface PolicyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PolicyImpactSimulation {
  wouldQuarantine: number;
  wouldUnquarantine: number;
  estimatedSavings: {
    ciMinutes: number;
    developerHours: number;
    buildsProtected: number;
  };
  potentialRisks: {
    falsePositives: number;
    overQuarantine: boolean;
    criticalTestsAffected: number;
  };
}

export interface QuarantineEffectivenessReport {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  actionItems: string[];
}

// API Request/Response types
export interface QuarantineTestRequest {
  projectId: string;
  testName: string;
  testSuite?: string;
  reason: string;
}

export interface UnquarantineTestRequest {
  flakyTestPatternId: string;
  reason?: string;
}

export interface CreatePolicyRequest {
  projectId: string;
  name: string;
  description?: string;
  config: QuarantinePolicyConfig;
}

export interface TrackImpactRequest {
  projectId: string;
  flakyTestPatternId: string;
  buildsBlocked?: number;
  ciTimeWasted?: number;
  developerHours?: number;
  falsePositive?: boolean;
}

export interface QuarantineTestResponse {
  success: boolean;
  message?: string;
  testName?: string;
  testSuite?: string;
  reason?: string;
  error?: string;
}

export interface GetQuarantinedTestsResponse {
  success: boolean;
  data?: QuarantinedTest[];
  total?: number;
  error?: string;
}

export interface QuarantineStatsResponse {
  success: boolean;
  data?: QuarantineStats;
  error?: string;
}

export interface QuarantineAnalyticsResponse {
  success: boolean;
  data?: QuarantineAnalytics;
  error?: string;
}

export interface QuarantinePoliciesResponse {
  success: boolean;
  data?: QuarantinePolicy[];
  error?: string;
}

export interface PolicySimulationResponse {
  success: boolean;
  data?: PolicyImpactSimulation;
  error?: string;
}

export interface RecommendedPolicyResponse {
  success: boolean;
  data?: QuarantinePolicyConfig;
  error?: string;
}

export interface EffectivenessReportResponse {
  success: boolean;
  data?: QuarantineEffectivenessReport;
  error?: string;
}

export interface QuarantineCheckResponse {
  success: boolean;
  isQuarantined?: boolean;
  testName?: string;
  testSuite?: string;
  error?: string;
}