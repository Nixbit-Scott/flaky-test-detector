export const TEST_STATUS = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  ERROR: 'error',
} as const;

export const TEST_RUN_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const CI_PROVIDERS = {
  GITHUB: 'github',
  GITLAB: 'gitlab',
  JENKINS: 'jenkins',
  OTHER: 'other',
} as const;

export const BACKOFF_STRATEGIES = {
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
  FIXED: 'fixed',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export const TEAM_PLANS = {
  STARTER: 'starter',
  TEAM: 'team',
  ENTERPRISE: 'enterprise',
} as const;

export const API_PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
} as const;