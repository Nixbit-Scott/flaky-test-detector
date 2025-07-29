export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isActive: boolean;
  isSystemAdmin?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  plan: 'starter' | 'team' | 'enterprise';
  billingEmail: string;
  maxProjects: number;
  maxMembers: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Billing
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: 'active' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date;
  
  // Relations
  members: OrganizationMember[];
  teams: Team[];
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  user: User;
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  organization: Organization;
  members: TeamMember[];
  projects: string[]; // project IDs
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: 'admin' | 'member';
  user: User;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  teamId?: string;
  role: 'admin' | 'member';
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
}

// Subscription plan details moved to subscription.ts

export interface ApiKey {
  id: string;
  name: string;
  key: string; // hashed
  projectId: string;
  permissions: ('read' | 'write' | 'admin')[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string; // user ID
}

// Admin System Types
export interface AdminSession {
  id: string;
  userId: string;
  sessionToken: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  user: User;
}

export interface AdminAuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  beforeState?: any;
  afterState?: any;
  severity: 'info' | 'warn' | 'error' | 'critical';
  category: string;
  createdAt: Date;
  user?: User;
}

export interface SystemMetric {
  id: string;
  metricName: string;
  metricType: 'count' | 'gauge' | 'histogram';
  value: number;
  unit?: string;
  labels?: any;
  source?: string;
  timestamp: Date;
  intervalType: 'point' | 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface SystemHealth {
  id: string;
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number | null;
  errorRate: number | null;
  lastError: string | null;
  metadata: any;
  checkedAt: Date;
  lastHealthyAt: Date | null;
  lastUnhealthyAt: Date | null;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string;
  customerEmail: string;
  organizationId?: string;
  userId?: string;
  assignedToUserId?: string;
  source: 'manual' | 'email' | 'chat' | 'system';
  tags: string[];
  resolution?: string;
  resolvedAt?: Date;
  firstResponseAt?: Date;
  firstResponseSla?: number;
  resolutionSla?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'security' | 'billing' | 'user_action';
  severity: 'info' | 'warning' | 'error' | 'critical';
  targetAdminIds: string[];
  isGlobal: boolean;
  isRead: boolean;
  isArchived: boolean;
  relatedResourceType?: string;
  relatedResourceId?: string;
  actionUrl?: string;
  metadata?: any;
  createdAt: Date;
  readAt?: Date;
  archivedAt?: Date;
}

// Admin API Request/Response Types
export interface AdminOverviewStats {
  totalOrganizations: number;
  activeUsers: number;
  testRunsToday: number;
  activeFlakyTests: number;
  monthlyRecurringRevenue: number;
  systemUptime: number;
  averageResponseTime: number;
}

export interface AdminOrganizationSummary {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
  projectCount: number;
  healthScore: number;
  monthlyRevenue: number;
  status: 'active' | 'inactive' | 'suspended';
  lastActivity: Date;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  organizationCount: number;
  isSystemAdmin: boolean;
  lastLoginAt?: Date;
  status: 'active' | 'inactive' | 'suspended';
  totalProjects: number;
}

export interface PlatformMetrics {
  successRate: number;
  uptime: number;
  customerHealth: number;
  revenueGrowth: number;
  totalRevenue: number;
  churnRate: number;
}