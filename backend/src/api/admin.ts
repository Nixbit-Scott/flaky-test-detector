import { Router, Request, Response } from 'express';
import { adminAuthMiddleware, adminAuditMiddleware } from '../middleware/admin-auth';
import { AdminService } from '../services/admin.service';
import { UserService } from '../services/user.service';
import { webSocketService } from '../services/websocket.service';
import { logger } from '../utils/logger';

const router = Router();

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

// Dashboard Overview
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const stats = await AdminService.getOverviewStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get admin overview', { error });
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

// Platform Metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await AdminService.getPlatformMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get platform metrics', { error });
    res.status(500).json({ error: 'Failed to get platform metrics' });
  }
});

// Organization Management
router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const status = req.query.status as 'active' | 'inactive' | 'suspended';

    const result = await AdminService.getAllOrganizations(page, limit, search, status);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get organizations', { error });
    res.status(500).json({ error: 'Failed to get organizations' });
  }
});

router.get('/organizations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization = await AdminService.getOrganizationDetails(id);
    res.json(organization);
  } catch (error) {
    logger.error('Failed to get organization details', { error, organizationId: req.params.id });
    res.status(500).json({ error: 'Failed to get organization details' });
  }
});

router.post('/organizations/:id/suspend', 
  adminAuditMiddleware('suspend_organization', 'organization'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const result = await AdminService.suspendOrganization(id, reason);
      
      // Log the action
      const auditLog = await UserService.createAdminAuditLog({
        userId: req.adminUser!.userId,
        action: 'suspend_organization',
        resourceType: 'organization',
        resourceId: id,
        beforeState: result.beforeState,
        afterState: result.organization,
        details: { reason },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        category: 'organization_management',
        severity: 'warn'
      });

      // Broadcast real-time updates
      webSocketService.broadcastOrganizationUpdate(result.organization, 'suspended');
      webSocketService.broadcastNewAuditLog(auditLog);
      
      res.json({ success: true, organization: result.organization });
    } catch (error) {
      logger.error('Failed to suspend organization', { error, organizationId: req.params.id });
      res.status(500).json({ error: 'Failed to suspend organization' });
    }
  }
);

router.post('/organizations/:id/reactivate',
  adminAuditMiddleware('reactivate_organization', 'organization'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await AdminService.reactivateOrganization(id);
      
      // Log the action
      await UserService.createAdminAuditLog({
        userId: req.adminUser!.userId,
        action: 'reactivate_organization',
        resourceType: 'organization',
        resourceId: id,
        beforeState: result.beforeState,
        afterState: result.organization,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        category: 'organization_management',
        severity: 'info'
      });
      
      res.json({ success: true, organization: result.organization });
    } catch (error) {
      logger.error('Failed to reactivate organization', { error, organizationId: req.params.id });
      res.status(500).json({ error: 'Failed to reactivate organization' });
    }
  }
);

// User Management
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    const result = await UserService.getAllUsers(page, limit, search);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get users', { error });
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.post('/users/:id/toggle-admin',
  adminAuditMiddleware('toggle_admin_status', 'user'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isSystemAdmin } = req.body;
      
      const result = await UserService.toggleUserAdminStatus(id, isSystemAdmin);
      
      // Log the action
      await UserService.createAdminAuditLog({
        userId: req.adminUser!.userId,
        action: 'toggle_admin_status',
        resourceType: 'user',
        resourceId: id,
        beforeState: result.beforeState,
        afterState: { isSystemAdmin },
        details: { targetUserId: id, newAdminStatus: isSystemAdmin },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        category: 'user_management',
        severity: 'warn'
      });
      
      res.json({ success: true, user: result.user });
    } catch (error) {
      logger.error('Failed to toggle admin status', { error, userId: req.params.id });
      res.status(500).json({ error: 'Failed to toggle admin status' });
    }
  }
);

// System Health
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await AdminService.getSystemHealth();
    res.json(health);
  } catch (error) {
    logger.error('Failed to get system health', { error });
    res.status(500).json({ error: 'Failed to get system health' });
  }
});

router.post('/health/:service',
  adminAuditMiddleware('update_system_health', 'system'),
  async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      const { status, metadata } = req.body;
      
      const health = await AdminService.updateSystemHealth(service, status, metadata);
      res.json({ success: true, health });
    } catch (error) {
      logger.error('Failed to update system health', { error });
      res.status(500).json({ error: 'Failed to update system health' });
    }
  }
);

// System Metrics
router.get('/metrics/system', async (req: Request, res: Response) => {
  try {
    const metricNames = (req.query.metrics as string)?.split(',') || [];
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    const intervalType = req.query.interval as 'point' | 'hourly' | 'daily' | 'weekly' | 'monthly' || 'hourly';
    
    const metrics = await AdminService.getSystemMetrics(metricNames, { from, to }, intervalType);
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get system metrics', { error });
    res.status(500).json({ error: 'Failed to get system metrics' });
  }
});

router.post('/metrics/system',
  adminAuditMiddleware('record_metric', 'system'),
  async (req: Request, res: Response) => {
    try {
      const { metricName, value, metricType, unit, labels } = req.body;
      
      const metric = await AdminService.recordSystemMetric(metricName, value, metricType, unit, labels);
      res.json({ success: true, metric });
    } catch (error) {
      logger.error('Failed to record system metric', { error });
      res.status(500).json({ error: 'Failed to record system metric' });
    }
  }
);

// Audit Logs
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const filters: any = {};
    if (req.query.userId) filters.userId = req.query.userId;
    if (req.query.action) filters.action = req.query.action;
    if (req.query.resourceType) filters.resourceType = req.query.resourceType;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.from && req.query.to) {
      filters.dateRange = {
        from: new Date(req.query.from as string),
        to: new Date(req.query.to as string)
      };
    }
    
    const result = await AdminService.getAuditLogs(page, limit, filters);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get audit logs', { error });
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Real-time Activity (placeholder for WebSocket implementation)
router.get('/activity', async (req: Request, res: Response) => {
  try {
    // This will be replaced with WebSocket implementation later
    const recentActivity = await AdminService.getAuditLogs(1, 10);
    res.json({
      activity: recentActivity.logs.map(log => ({
        id: log.id,
        type: log.severity === 'error' ? 'error' : log.severity === 'warn' ? 'warning' : 'info',
        message: `${log.user?.name || 'System'} - ${log.action}`,
        timestamp: log.createdAt,
        details: log.details
      }))
    });
  } catch (error) {
    logger.error('Failed to get activity', { error });
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// Support Ticket Management
router.get('/support/tickets', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const category = req.query.category as string;
    const search = req.query.search as string;

    const filters: any = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (category) filters.category = category;
    if (search) filters.search = search;

    if (req.query.from && req.query.to) {
      filters.dateRange = {
        from: new Date(req.query.from as string),
        to: new Date(req.query.to as string)
      };
    }

    const result = await AdminService.getSupportTickets(page, limit, filters);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get support tickets', { error });
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

router.get('/support/tickets/stats', async (req: Request, res: Response) => {
  try {
    const stats = await AdminService.getSupportTicketStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get support ticket stats', { error });
    res.status(500).json({ error: 'Failed to get support ticket stats' });
  }
});

router.get('/support/tickets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticket = await AdminService.getSupportTicketById(id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    logger.error('Failed to get support ticket', { error, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to get support ticket' });
  }
});

router.post('/support/tickets',
  adminAuditMiddleware('create_support_ticket', 'support'),
  async (req: Request, res: Response) => {
    try {
      const { title, description, priority, category, customerEmail, organizationId, userId, tags } = req.body;

      if (!title || !description || !priority || !category || !customerEmail) {
        return res.status(400).json({ 
          error: 'Missing required fields: title, description, priority, category, customerEmail' 
        });
      }

      const ticket = await AdminService.createSupportTicket({
        title,
        description,
        priority,
        category,
        customerEmail,
        organizationId,
        userId,
        source: 'admin',
        tags: tags || []
      });

      // Log the action
      const auditLog = await UserService.createAdminAuditLog({
        userId: req.adminUser!.userId,
        action: 'create_support_ticket',
        resourceType: 'support',
        resourceId: ticket.id,
        afterState: ticket,
        details: { ticketNumber: ticket.ticketNumber, priority, category },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        category: 'support_management',
        severity: 'info'
      });

      // Broadcast real-time updates
      webSocketService.broadcastSupportTicketUpdate(ticket, 'created');
      webSocketService.broadcastNewAuditLog(auditLog);

      res.status(201).json(ticket);
    } catch (error) {
      logger.error('Failed to create support ticket', { error });
      res.status(500).json({ error: 'Failed to create support ticket' });
    }
  }
);

router.put('/support/tickets/:id',
  adminAuditMiddleware('update_support_ticket', 'support'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, priority, assignedToUserId, resolution, tags } = req.body;

      const beforeState = await AdminService.getSupportTicketById(id);
      if (!beforeState) {
        return res.status(404).json({ error: 'Support ticket not found' });
      }

      const ticket = await AdminService.updateSupportTicket(id, {
        status,
        priority,
        assignedToUserId,
        resolution,
        tags
      });

      // Log the action
      await UserService.createAdminAuditLog({
        userId: req.adminUser!.userId,
        action: 'update_support_ticket',
        resourceType: 'support',
        resourceId: id,
        beforeState,
        afterState: ticket,
        details: { ticketNumber: beforeState.ticketNumber, changes: req.body },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        category: 'support_management',
        severity: 'info'
      });

      res.json(ticket);
    } catch (error) {
      logger.error('Failed to update support ticket', { error, ticketId: req.params.id });
      res.status(500).json({ error: 'Failed to update support ticket' });
    }
  }
);

router.post('/support/tickets/:id/first-response',
  adminAuditMiddleware('add_first_response', 'support'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const ticket = await AdminService.addFirstResponse(id);
      
      // Log the action
      await UserService.createAdminAuditLog({
        userId: req.adminUser!.userId,
        action: 'add_first_response',
        resourceType: 'support',
        resourceId: id,
        details: { ticketNumber: ticket.ticketNumber },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        category: 'support_management',
        severity: 'info'
      });

      res.json(ticket);
    } catch (error) {
      logger.error('Failed to add first response', { error, ticketId: req.params.id });
      res.status(500).json({ error: 'Failed to add first response' });
    }
  }
);

export default router;