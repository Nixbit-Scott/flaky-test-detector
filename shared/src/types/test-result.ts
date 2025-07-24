export interface TestResult {
  id: string;
  projectId: string;
  testName: string;
  testSuite?: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number; // milliseconds
  errorMessage?: string;
  stackTrace?: string;
  commitHash: string;
  branch: string;
  buildId: string;
  timestamp: Date;
  retryCount: number;
  isFlaky: boolean;
  flakyScore?: number; // 0-1 confidence score
  ciProvider: 'github' | 'gitlab' | 'jenkins' | 'other';
  ciMetadata?: Record<string, any>;
}

export interface TestRun {
  id: string;
  projectId: string;
  buildId: string;
  commitHash: string;
  branch: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  flakyTests: number;
  ciProvider: string;
  ciMetadata?: Record<string, any>;
  results: TestResult[];
}

export interface FlakyTestPattern {
  id: string;
  testName: string;
  projectId: string;
  flakyScore: number;
  failureRate: number; // percentage
  totalRuns: number;
  failures: number;
  firstSeen: Date;
  lastSeen: Date;
  commonFailurePatterns: string[];
  recommendedRetries: number;
  isActive: boolean;
}