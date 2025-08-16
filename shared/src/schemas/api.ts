import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  repositoryUrl: z.string().url(),
  defaultBranch: z.string().default('main'),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  defaultBranch: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const TestResultSchema = z.object({
  testName: z.string(),
  testSuite: z.string().optional(),
  status: z.enum(['passed', 'failed', 'skipped', 'error']),
  duration: z.number().min(0),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  retryCount: z.number().min(0).default(0),
});

export const SubmitTestResultsSchema = z.object({
  buildId: z.string(),
  commitHash: z.string(),
  branch: z.string(),
  ciProvider: z.string(),
  ciMetadata: z.record(z.any()).optional(),
  results: z.array(TestResultSchema),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(50),
  permissions: z.array(z.enum(['read', 'write', 'admin'])),
  expiresAt: z.date().optional(),
});

export const UpdateRetrySettingsSchema = z.object({
  enabled: z.boolean(),
  maxRetries: z.number().min(0).max(10),
  retryDelay: z.number().min(0).max(300),
  backoffStrategy: z.enum(['linear', 'exponential', 'fixed']),
  retryOnlyFlaky: z.boolean(),
  retryTimeout: z.number().min(30).max(3600),
});

export const UpdateNotificationSettingsSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.enum(['email', 'slack', 'webhook'])),
  emailAddresses: z.array(z.string().email()),
  slackWebhook: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  notifyOnNewFlaky: z.boolean(),
  notifyOnRetryFailure: z.boolean(),
  notifyOnThresholdExceeded: z.boolean(),
  flakyThreshold: z.number().min(0).max(100),
});

// Organization schemas
export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().optional(),
  billingEmail: z.string().email(),
  plan: z.enum(['starter', 'team', 'enterprise']).default('starter'),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().optional(),
  billingEmail: z.string().email().optional(),
  plan: z.enum(['starter', 'team', 'enterprise']).optional(),
});

// Team schemas
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  organizationId: z.string(),
});

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Invitation schemas
export const InviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
  teamId: z.string().optional(),
});

export const AcceptInvitationSchema = z.object({
  token: z.string(),
  name: z.string().min(1).max(100).optional(), // For new users
  password: z.string().min(8).optional(), // For new users
});

// Member management schemas
export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

export const UpdateTeamMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectSchema>;
export type SubmitTestResultsRequest = z.infer<typeof SubmitTestResultsSchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeySchema>;
export type UpdateRetrySettingsRequest = z.infer<typeof UpdateRetrySettingsSchema>;
export type UpdateNotificationSettingsRequest = z.infer<typeof UpdateNotificationSettingsSchema>;

// Organization types
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationSchema>;
export type CreateTeamRequest = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamRequest = z.infer<typeof UpdateTeamSchema>;
export type InviteUserRequest = z.infer<typeof InviteUserSchema>;
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleSchema>;
export type UpdateTeamMemberRoleRequest = z.infer<typeof UpdateTeamMemberRoleSchema>;

// Marketing schemas
export const MarketingSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  company: z.string().max(200).optional(),
  teamSize: z.enum(['1-5', '6-15', '16-50', '50+']).optional(),
  currentPainPoints: z.array(z.string()).optional(),
  interestedFeatures: z.array(z.string()).optional(),
  source: z.string().optional(),
  utmParameters: z.record(z.string()).optional(),
  captchaToken: z.string().optional(),
});

export const UpdateMarketingSignupSchema = z.object({
  leadScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  emailSubscribed: z.boolean().optional(),
});

export type MarketingSignupRequest = z.infer<typeof MarketingSignupSchema>;
export type UpdateMarketingSignupRequest = z.infer<typeof UpdateMarketingSignupSchema>;