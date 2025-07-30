export type FailureCategory = 
  | 'environment' 
  | 'timing' 
  | 'data-dependency' 
  | 'external-service' 
  | 'concurrency' 
  | 'resource-exhaustion'
  | 'configuration' 
  | 'unknown';

export interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: string;
  codeExample?: string;
  documentation?: string;
}

export interface RecommendationSet {
  immediate: Recommendation[];
  shortTerm: Recommendation[];
  longTerm: Recommendation[];
}

export interface RootCauseAnalysis {
  id: string;
  flakyTestPatternId: string;
  testResultId?: string;
  
  // AI Analysis Results
  primaryCategory: FailureCategory;
  secondaryCategories: FailureCategory[];
  confidence: number; // 0.0 to 1.0
  
  // Failure Analysis
  errorPattern?: string;
  stackTraceSignature?: string;
  timingIssues: string[];
  environmentFactors: string[];
  
  // Recommendations
  recommendations: RecommendationSet;
  estimatedFixEffort: 'low' | 'medium' | 'high';
  similarIssuesCount: number;
  
  // Enhanced Analysis (for new features)
  enhanced?: {
    rootCause?: string;
    fixProbability?: number;
    impactScore?: number;
  };
  
  // Historical Pattern Analysis
  historicalPattern?: {
    trend: 'improving' | 'stable' | 'degrading';
    seasonality?: string;
    frequency?: number;
    lastOccurred?: Date;
  };
  
  // Cross-test Pattern Detection
  crossTestPatterns?: {
    similarTests: number;
    commonFactors: string[];
    recommendation: string;
  }[];
  
  // Metadata
  modelVersion: string;
  processingTime: number; // milliseconds
  dataQuality: number; // 0.0 to 1.0
  
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentalContext {
  id: string;
  testResultId: string;
  
  // CI/CD Environment
  ciRunner?: string;
  ciRegion?: string;
  nodeVersion?: string;
  dependencies?: Record<string, string>;
  
  // Timing Context
  executionTime: Date;
  timeOfDay?: string;
  dayOfWeek?: string;
  concurrentJobs?: number;
  
  // System Resources
  cpuUsage?: number;
  memoryUsage?: number;
  diskSpace?: number;
  networkLatency?: number;
  
  // External Dependencies
  externalServices?: Record<string, any>;
  databaseLoad?: number;
  
  createdAt: Date;
}

export interface AIAnalysisRequest {
  testName: string;
  testSuite?: string;
  errorMessage?: string;
  stackTrace?: string;
  duration?: number;
  status: string;
  branch?: string;
  ciProvider?: string;
  environmentalContext?: Partial<EnvironmentalContext>;
}

export interface AIAnalysisResponse {
  success: boolean;
  analysis?: RootCauseAnalysis;
  error?: string;
}

export interface FlakyTestWithAnalysis {
  id: string;
  testName: string;
  testSuite?: string;
  projectId: string;
  failureRate: number;
  totalRuns: number;
  failedRuns: number;
  confidence: number;
  isActive: boolean;
  lastSeen: Date;
  
  // Latest AI Analysis
  latestAnalysis?: RootCauseAnalysis;
  analysisCount: number;
}

export interface AnalyticsSummary {
  totalTests: number;
  flakyTests: number;
  categoryCounts: Record<FailureCategory, number>;
  averageConfidence: number;
  topRecommendations: {
    category: string;
    count: number;
    examples: string[];
  }[];
  effortDistribution: Record<'low' | 'medium' | 'high', number>;
}

// API Response types
export interface GetFlakyTestsWithAnalysisResponse {
  success: boolean;
  data?: FlakyTestWithAnalysis[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
  error?: string;
}

export interface GetAnalyticsSummaryResponse {
  success: boolean;
  data?: AnalyticsSummary;
  error?: string;
}

export interface TriggerAnalysisResponse {
  success: boolean;
  analysisId?: string;
  error?: string;
}