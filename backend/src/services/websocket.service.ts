import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { AdminService } from './admin.service';
import { UserService } from './user.service';
import { verifyAdminWebSocketToken } from '../utils/jwt-websocket';

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private adminNamespace: any = null;

  initialize(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io'
    });

    // Create admin namespace for admin-only events
    this.adminNamespace = this.io.of('/admin');

    this.setupAdminNamespace();
    this.startPeriodicUpdates();

    logger.info('WebSocket service initialized');
  }

  private setupAdminNamespace() {
    if (!this.adminNamespace) return;

    this.adminNamespace.use(async (socket: any, next: any) => {
      try {
        // Extract token from handshake auth or query
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify admin token (implement your JWT verification logic)
        const adminUser = await this.verifyAdminToken(token);
        if (!adminUser) {
          return next(new Error('Invalid or expired token'));
        }

        socket.adminUser = adminUser;
        next();
      } catch (error) {
        logger.error('WebSocket authentication error', { error });
        next(new Error('Authentication failed'));
      }
    });

    this.adminNamespace.on('connection', (socket: any) => {
      logger.info('Admin user connected to WebSocket', { 
        userId: socket.adminUser.userId,
        socketId: socket.id 
      });

      // Join admin room for broadcasting admin-specific events
      socket.join('admin-room');

      // Handle client requests for real-time data
      socket.on('subscribe-system-health', () => {
        socket.join('system-health');
        logger.debug('Admin subscribed to system health updates', { socketId: socket.id });
      });

      socket.on('subscribe-activity-feed', () => {
        socket.join('activity-feed');
        logger.debug('Admin subscribed to activity feed updates', { socketId: socket.id });
      });

      socket.on('subscribe-support-tickets', () => {
        socket.join('support-tickets');
        logger.debug('Admin subscribed to support ticket updates', { socketId: socket.id });
      });

      socket.on('subscribe-analytics', () => {
        socket.join('analytics');
        logger.debug('Admin subscribed to analytics updates', { socketId: socket.id });
      });

      socket.on('unsubscribe-system-health', () => {
        socket.leave('system-health');
        logger.debug('Admin unsubscribed from system health updates', { socketId: socket.id });
      });

      socket.on('unsubscribe-activity-feed', () => {
        socket.leave('activity-feed');
        logger.debug('Admin unsubscribed from activity feed updates', { socketId: socket.id });
      });

      socket.on('unsubscribe-support-tickets', () => {
        socket.leave('support-tickets');
        logger.debug('Admin unsubscribed from support ticket updates', { socketId: socket.id });
      });

      socket.on('unsubscribe-analytics', () => {
        socket.leave('analytics');
        logger.debug('Admin unsubscribed from analytics updates', { socketId: socket.id });
      });

      socket.on('disconnect', (reason: string) => {
        logger.info('Admin user disconnected from WebSocket', { 
          userId: socket.adminUser.userId,
          socketId: socket.id,
          reason 
        });
      });

      // Send initial data upon connection
      this.sendInitialData(socket);
    });
  }

  private async verifyAdminToken(token: string): Promise<any> {
    return await verifyAdminWebSocketToken(token);
  }

  private async sendInitialData(socket: any) {
    try {
      // Send initial system health data
      const systemHealth = await AdminService.getSystemHealth();
      socket.emit('system-health-update', systemHealth);

      // Send initial activity feed
      const activityData = await AdminService.getAuditLogs(1, 10);
      const activity = activityData.logs.map(log => ({
        id: log.id,
        type: log.severity === 'error' ? 'error' : log.severity === 'warn' ? 'warning' : 'info',
        message: `${log.user?.name || 'System'} - ${log.action}`,
        timestamp: log.createdAt,
        details: log.details
      }));
      socket.emit('activity-feed-update', { activity });

      // Send initial support ticket stats
      const supportStats = await AdminService.getSupportTicketStats();
      socket.emit('support-tickets-stats-update', supportStats);

    } catch (error) {
      logger.error('Failed to send initial WebSocket data', { error });
    }
  }

  private startPeriodicUpdates() {
    // System Health Updates - every 30 seconds
    setInterval(async () => {
      try {
        const systemHealth = await AdminService.getSystemHealth();
        this.broadcastToAdmins('system-health-update', systemHealth, 'system-health');
      } catch (error) {
        logger.error('Failed to broadcast system health update', { error });
      }
    }, 30000);

    // Activity Feed Updates - every 15 seconds
    setInterval(async () => {
      try {
        const activityData = await AdminService.getAuditLogs(1, 10);
        const activity = activityData.logs.map(log => ({
          id: log.id,
          type: log.severity === 'error' ? 'error' : log.severity === 'warn' ? 'warning' : 'info',
          message: `${log.user?.name || 'System'} - ${log.action}`,
          timestamp: log.createdAt,
          details: log.details
        }));
        this.broadcastToAdmins('activity-feed-update', { activity }, 'activity-feed');
      } catch (error) {
        logger.error('Failed to broadcast activity feed update', { error });
      }
    }, 15000);

    // Support Ticket Stats Updates - every 60 seconds
    setInterval(async () => {
      try {
        const supportStats = await AdminService.getSupportTicketStats();
        this.broadcastToAdmins('support-tickets-stats-update', supportStats, 'support-tickets');
      } catch (error) {
        logger.error('Failed to broadcast support tickets stats update', { error });
      }
    }, 60000);

    // Analytics Updates - every 5 minutes
    setInterval(async () => {
      try {
        const overviewStats = await AdminService.getOverviewStats();
        const platformMetrics = await AdminService.getPlatformMetrics();
        
        this.broadcastToAdmins('analytics-overview-update', overviewStats, 'analytics');
        this.broadcastToAdmins('analytics-metrics-update', platformMetrics, 'analytics');
      } catch (error) {
        logger.error('Failed to broadcast analytics update', { error });
      }
    }, 300000); // 5 minutes
  }

  // Public methods for triggering real-time updates
  public broadcastSystemHealthUpdate(systemHealth: any) {
    this.broadcastToAdmins('system-health-update', systemHealth, 'system-health');
  }

  public broadcastNewAuditLog(auditLog: any) {
    const activity = {
      id: auditLog.id,
      type: auditLog.severity === 'error' ? 'error' : auditLog.severity === 'warn' ? 'warning' : 'info',
      message: `${auditLog.user?.name || 'System'} - ${auditLog.action}`,
      timestamp: auditLog.createdAt,
      details: auditLog.details
    };
    this.broadcastToAdmins('new-activity', activity, 'activity-feed');
  }

  public broadcastSupportTicketUpdate(ticket: any, eventType: 'created' | 'updated' | 'resolved') {
    this.broadcastToAdmins('support-ticket-update', { ticket, eventType }, 'support-tickets');
    
    // Also broadcast updated stats
    AdminService.getSupportTicketStats().then(stats => {
      this.broadcastToAdmins('support-tickets-stats-update', stats, 'support-tickets');
    }).catch(error => {
      logger.error('Failed to broadcast support ticket stats after ticket update', { error });
    });
  }

  public broadcastOrganizationUpdate(organization: any, eventType: 'suspended' | 'reactivated' | 'updated') {
    this.broadcastToAdmins('organization-update', { organization, eventType }, 'admin-room');
  }

  public broadcastUserUpdate(user: any, eventType: 'admin-toggled' | 'updated') {
    this.broadcastToAdmins('user-update', { user, eventType }, 'admin-room');
  }

  private broadcastToAdmins(event: string, data: any, room?: string) {
    if (!this.adminNamespace) {
      logger.warn('Admin namespace not initialized, cannot broadcast event', { event });
      return;
    }

    if (room) {
      this.adminNamespace.to(room).emit(event, data);
      logger.debug('Broadcasted event to admin room', { event, room, dataKeys: Object.keys(data || {}) });
    } else {
      this.adminNamespace.emit(event, data);
      logger.debug('Broadcasted event to all admins', { event, dataKeys: Object.keys(data || {}) });
    }
  }

  public getConnectedAdminCount(): number {
    if (!this.adminNamespace) return 0;
    return this.adminNamespace.sockets.size;
  }

  public isInitialized(): boolean {
    return this.io !== null && this.adminNamespace !== null;
  }

  public shutdown() {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.adminNamespace = null;
      logger.info('WebSocket service shut down');
    }
  }
}

export const webSocketService = new WebSocketService();