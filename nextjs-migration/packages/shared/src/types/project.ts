export interface Project {
  id: string;
  name: string;
  description?: string;
  repositoryUrl: string;
  defaultBranch: string;
  isActive: boolean;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
}

export interface ProjectSettings {
  retrySettings: RetrySettings;
  notificationSettings: NotificationSettings;
  integrationSettings: IntegrationSettings;
  analysisSettings: AnalysisSettings;
}

export interface RetrySettings {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number; // seconds
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  retryOnlyFlaky: boolean;
  retryTimeout: number; // seconds
}

export interface NotificationSettings {
  enabled: boolean;
  channels: ('email' | 'slack' | 'webhook')[];
  emailAddresses: string[];
  slackWebhook?: string;
  webhookUrl?: string;
  notifyOnNewFlaky: boolean;
  notifyOnRetryFailure: boolean;
  notifyOnThresholdExceeded: boolean;
  flakyThreshold: number; // percentage
}

export interface IntegrationSettings {
  github?: GitHubSettings;
  gitlab?: GitLabSettings;
  jenkins?: JenkinsSettings;
}

export interface GitHubSettings {
  installationId: string;
  repositoryId: string;
  webhookSecret: string;
}

export interface GitLabSettings {
  projectId: string;
  accessToken: string;
  webhookSecret: string;
}

export interface JenkinsSettings {
  jobUrl: string;
  username: string;
  apiToken: string;
}

export interface AnalysisSettings {
  flakyThreshold: number; // 0-1, minimum score to mark as flaky
  minRunsForAnalysis: number;
  lookbackDays: number;
  autoMarkFlaky: boolean;
}