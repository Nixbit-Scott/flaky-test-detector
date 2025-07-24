import { apiService } from './api';
import {
  AdminOverviewStats,
  AdminOrganizationSummary,
  AdminUserSummary,
  PlatformMetrics,
  SystemHealth,
  AdminAuditLog,
  SystemMetric,
  PaginatedResponse,
  SearchFilters
} from '../types';

export class AdminService {
  // Dashboard Overview
  async getOverviewStats(): Promise<AdminOverviewStats> {
    return apiService.get<AdminOverviewStats>('/admin/overview');
  }

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    return apiService.get<PlatformMetrics>('/admin/metrics');
  }

  async getRealtimeActivity(): Promise<{ activity: any[] }> {
    return apiService.get('/admin/activity');
  }

  // Organization Management
  async getOrganizations(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive' | 'suspended';
  } = {}): Promise<PaginatedResponse<AdminOrganizationSummary>> {
    return apiService.get('/admin/organizations', params);
  }

  async getOrganizationDetails(id: string): Promise<any> {
    return apiService.get(`/admin/organizations/${id}`);
  }

  async suspendOrganization(id: string, reason?: string): Promise<{ success: boolean }> {
    return apiService.post(`/admin/organizations/${id}/suspend`, { reason });
  }

  async reactivateOrganization(id: string): Promise<{ success: boolean }> {
    return apiService.post(`/admin/organizations/${id}/reactivate`);
  }

  // User Management
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<PaginatedResponse<AdminUserSummary>> {
    return apiService.get('/admin/users', params);
  }

  async toggleUserAdminStatus(userId: string, isSystemAdmin: boolean): Promise<{ success: boolean }> {
    return apiService.post(`/admin/users/${userId}/toggle-admin`, { isSystemAdmin });
  }

  // System Health
  async getSystemHealth(): Promise<SystemHealth[]> {
    return apiService.get('/admin/health');
  }

  async updateSystemHealth(service: string, status: 'healthy' | 'degraded' | 'unhealthy', metadata?: any): Promise<{ success: boolean }> {
    return apiService.post(`/admin/health/${service}`, { status, metadata });
  }

  // System Metrics
  async getSystemMetrics(params: {
    metrics: string[];
    from: Date;
    to: Date;
    interval?: 'point' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  }): Promise<SystemMetric[]> {
    return apiService.get('/admin/metrics/system', {
      metrics: params.metrics.join(','),
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      interval: params.interval || 'hourly'
    });
  }

  async recordSystemMetric(data: {
    metricName: string;
    value: number;
    metricType?: 'count' | 'gauge' | 'histogram';
    unit?: string;
    labels?: any;
  }): Promise<{ success: boolean }> {
    return apiService.post('/admin/metrics/system', data);
  }

  // Audit Logs
  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resourceType?: string;
    category?: string;
    severity?: string;
    from?: Date;
    to?: Date;
  } = {}): Promise<PaginatedResponse<AdminAuditLog>> {
    const queryParams: any = { ...params };
    if (params.from) queryParams.from = params.from.toISOString();
    if (params.to) queryParams.to = params.to.toISOString();
    
    return apiService.get('/admin/audit-logs', queryParams);
  }

  // Statistics helpers
  async getOrganizationStats(): Promise<{
    total: number;
    active: number;
    suspended: number;
    byPlan: { [plan: string]: number };
  }> {
    const orgs = await this.getOrganizations({ limit: 1000 });
    const total = orgs.pagination.total;
    const active = orgs.data.filter(org => org.status === 'active').length;
    const suspended = orgs.data.filter(org => org.status === 'inactive').length;
    
    const byPlan = orgs.data.reduce((acc, org) => {
      acc[org.plan] = (acc[org.plan] || 0) + 1;
      return acc;
    }, {} as { [plan: string]: number });

    return { total, active, suspended, byPlan };
  }

  async getUserStats(): Promise<{
    total: number;
    admins: number;
    active: number;
    inactive: number;
  }> {
    const users = await this.getUsers({ limit: 1000 });
    const total = users.pagination.total;
    const admins = users.data.filter(user => user.isSystemAdmin).length;
    const active = users.data.filter(user => user.status === 'active').length;
    const inactive = users.data.filter(user => user.status === 'inactive').length;

    return { total, admins, active, inactive };
  }

  // Support Ticket Management
  async getSupportTickets(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    from?: Date;
    to?: Date;
  } = {}): Promise<PaginatedResponse<any>> {
    const queryParams: any = { ...params };
    if (params.from) queryParams.from = params.from.toISOString();
    if (params.to) queryParams.to = params.to.toISOString();
    
    return apiService.get('/admin/support/tickets', queryParams);
  }

  async getSupportTicketStats(): Promise<{
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    urgentTickets: number;
    avgResponseTime: number;
    avgResolutionTime: number;
  }> {
    return apiService.get('/admin/support/tickets/stats');
  }

  async getSupportTicketById(id: string): Promise<any> {
    return apiService.get(`/admin/support/tickets/${id}`);
  }

  async createSupportTicket(data: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    customerEmail: string;
    organizationId?: string;
    userId?: string;
    tags?: string[];
  }): Promise<{ success: boolean }> {
    return apiService.post('/admin/support/tickets', data);
  }

  async updateSupportTicket(id: string, data: {
    status?: string;
    priority?: string;
    assignedToUserId?: string;
    resolution?: string;
    tags?: string[];
  }): Promise<{ success: boolean }> {
    return apiService.put(`/admin/support/tickets/${id}`, data);
  }

  async addFirstResponse(ticketId: string): Promise<{ success: boolean }> {
    return apiService.post(`/admin/support/tickets/${ticketId}/first-response`);
  }
}

export const adminService = new AdminService();