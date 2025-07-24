export interface WebhookPayload {
  projectId: string;
  buildId: string;
  commitHash: string;
  branch: string;
  provider: 'github' | 'gitlab' | 'jenkins' | 'other';
  event: 'test_started' | 'test_completed' | 'test_failed' | 'build_completed';
  timestamp: Date;
  metadata: Record<string, any>;
  testResults?: TestResultPayload[];
}

export interface TestResultPayload {
  name: string;
  suite?: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  retryCount?: number;
}

export interface GitHubWebhookPayload {
  action: string;
  check_run?: any;
  check_suite?: any;
  workflow_run?: any;
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
  installation?: {
    id: number;
  };
}

export interface GitLabWebhookPayload {
  object_kind: string;
  project: {
    id: number;
    name: string;
    path_with_namespace: string;
  };
  pipeline?: any;
  build?: any;
  commit?: {
    id: string;
    message: string;
    timestamp: string;
  };
}

export interface JenkinsWebhookPayload {
  name: string;
  url: string;
  build: {
    number: number;
    queue_id: number;
    url: string;
    log: string;
    phase: 'STARTED' | 'COMPLETED' | 'FINALIZED';
    status: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED';
    scm?: {
      commit: string;
      branch: string;
    };
  };
}