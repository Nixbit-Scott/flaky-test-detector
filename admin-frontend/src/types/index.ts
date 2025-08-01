// Re-export shared types
export * from '../../../shared/src/types/user';
export * from '../../../shared/src/types/project';
export * from '../../../shared/src/types/test-result';

// Admin-specific types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isSystemAdmin: boolean;
  lastLoginAt?: Date;
}

export interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface SearchFilters {
  search?: string;
  status?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface DashboardStats {
  totalOrganizations: number;
  activeUsers: number;
  testRunsToday: number;
  activeFlakyTests: number;
  monthlyRecurringRevenue: number;
  systemUptime: number;
  averageResponseTime: number;
}

export interface ActivityItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  details?: any;
}

export interface HealthCheck {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  errorRate?: number;
  lastError?: string;
  checkedAt: Date;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  timestamp: Date;
  change?: number;
  changeType?: 'increase' | 'decrease';
}

// Admin dashboard specific types
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
  status: 'active' | 'inactive' | 'suspended';
  userCount: number;
  createdAt: string;
  monthlySpend: number;
  testRuns: number;
  healthScore: number;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
  isSystemAdmin: boolean;
  createdAt: string;
  lastLogin?: string;
  projectsCreated: number;
  testResultsSubmitted: number;
  totalSessions: number;
  avgSessionDuration: number;
}

export interface PlatformMetrics {
  cpuUsage: Array<{ timestamp: string; value: number }>;
  memoryUsage: Array<{ timestamp: string; value: number }>;
  requestRate: Array<{ timestamp: string; value: number }>;
}

export interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  uptime: number;
  lastChecked: string;
}

export interface AdminAuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  metadata?: any;
  createdAt: string;
}

export interface SystemMetric {
  id: string;
  metricName: string;
  value: number;
  metricType: 'count' | 'gauge' | 'histogram';
  unit?: string;
  labels?: any;
  timestamp: string;
}