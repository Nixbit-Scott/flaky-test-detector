import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import { getPrismaClient } from './db';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Monitoring event schemas
const errorEventSchema = z.object({
  type: z.literal('error'),
  timestamp: z.string().datetime(),
  level: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  stack: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  userId: z.string().optional(),
  userAgent: z.string().optional(),
  url: z.string().optional(),
  functionName: z.string().optional(),
});

const performanceEventSchema = z.object({
  type: z.literal('performance'),
  timestamp: z.string().datetime(),
  functionName: z.string(),
  duration: z.number(),
  memoryUsed: z.number().optional(),
  coldStart: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const healthEventSchema = z.object({
  type: z.literal('health'),
  timestamp: z.string().datetime(),
  service: z.string(),
  status: z.enum(['healthy', 'degraded', 'down']),
  responseTime: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

const monitoringEventSchema = z.discriminatedUnion('type', [
  errorEventSchema,
  performanceEventSchema,
  healthEventSchema,
]);

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const pathParts = event.path.split('/');
    const endpoint = pathParts[pathParts.length - 1];

    switch (endpoint) {
      case 'log':
        return await handleLogEvent(event);
      case 'metrics':
        return await handleGetMetrics(event);
      case 'health':
        return await handleHealthCheck(event);
      case 'alerts':
        return await handleGetAlerts(event);
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Monitoring endpoint not found' }),
        };
    }
  } catch (error) {
    console.error('Monitor function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function handleLogEvent(event: HandlerEvent) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const validatedEvent = monitoringEventSchema.parse(body);

    const prisma = getPrismaClient();

    // Store monitoring event in database
    const logEntry = await prisma.monitoringLog.create({
      data: {
        type: validatedEvent.type,
        timestamp: new Date(validatedEvent.timestamp),
        level: validatedEvent.type === 'error' ? validatedEvent.level : 'info',
        message: getEventMessage(validatedEvent),
        metadata: validatedEvent.metadata || {},
        userId: validatedEvent.type === 'error' ? validatedEvent.userId : null,
        functionName: getFunctionName(validatedEvent),
        duration: validatedEvent.type === 'performance' ? validatedEvent.duration : null,
      },
    });

    // Check if this is a critical error that needs alerting
    if (validatedEvent.type === 'error' && validatedEvent.level === 'error') {
      await checkAndSendAlert(validatedEvent);
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        logId: logEntry.id,
      }),
    };
  } catch (error) {
    console.error('Log event error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to log event',
      }),
    };
  }
}

async function handleGetMetrics(event: HandlerEvent) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const prisma = getPrismaClient();
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get error rates
    const errorCounts = await prisma.monitoringLog.groupBy({
      by: ['level'],
      where: {
        type: 'error',
        timestamp: { gte: last24Hours },
      },
      _count: { id: true },
    });

    // Get performance metrics
    const performanceMetrics = await prisma.monitoringLog.aggregate({
      where: {
        type: 'performance',
        timestamp: { gte: last24Hours },
      },
      _avg: { duration: true },
      _max: { duration: true },
      _count: { id: true },
    });

    // Get function execution counts
    const functionCounts = await prisma.monitoringLog.groupBy({
      by: ['functionName'],
      where: {
        timestamp: { gte: last24Hours },
      },
      _count: { id: true },
    });

    // Get user activity
    const userActivity = await prisma.user.aggregate({
      where: {
        lastLoginAt: { gte: last7Days },
      },
      _count: { id: true },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        timeRange: '24h',
        errors: {
          total: errorCounts.reduce((sum, item) => sum + item._count.id, 0),
          byLevel: errorCounts.reduce((acc, item) => {
            acc[item.level] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
        },
        performance: {
          totalRequests: performanceMetrics._count.id,
          avgDuration: performanceMetrics._avg.duration,
          maxDuration: performanceMetrics._max.duration,
        },
        functions: functionCounts.map(item => ({
          name: item.functionName,
          executions: item._count.id,
        })),
        users: {
          activeLastWeek: userActivity._count.id,
        },
      }),
    };
  } catch (error) {
    console.error('Get metrics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch metrics' }),
    };
  }
}

async function handleHealthCheck(event: HandlerEvent) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const prisma = getPrismaClient();
    
    // Test database connection
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStart;

    // Check recent error rates
    const recentErrors = await prisma.monitoringLog.count({
      where: {
        type: 'error',
        level: 'error',
        timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
      },
    });

    const health = {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbResponseTime < 1000 ? 'healthy' : 'degraded',
          responseTime: dbResponseTime,
        },
        functions: {
          status: recentErrors < 5 ? 'healthy' : 'degraded',
          recentErrors,
        },
      },
    };

    // Overall health based on services
    if (health.services.database.status === 'degraded' || health.services.functions.status === 'degraded') {
      health.status = 'degraded';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(health),
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

async function handleGetAlerts(event: HandlerEvent) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const prisma = getPrismaClient();
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const criticalErrors = await prisma.monitoringLog.findMany({
      where: {
        type: 'error',
        level: 'error',
        timestamp: { gte: last24Hours },
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const alerts = criticalErrors.map(error => ({
      id: error.id,
      timestamp: error.timestamp,
      message: error.message,
      functionName: error.functionName,
      userId: error.userId,
      metadata: error.metadata,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ alerts }),
    };
  } catch (error) {
    console.error('Get alerts error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch alerts' }),
    };
  }
}

function getEventMessage(event: z.infer<typeof monitoringEventSchema>): string {
  switch (event.type) {
    case 'error':
      return event.message;
    case 'performance':
      return `Function ${event.functionName} executed in ${event.duration}ms`;
    case 'health':
      return `${event.service} status: ${event.status}`;
    default:
      return 'Unknown event';
  }
}

function getFunctionName(event: z.infer<typeof monitoringEventSchema>): string | null {
  switch (event.type) {
    case 'error':
      return event.functionName || null;
    case 'performance':
      return event.functionName;
    case 'health':
      return event.service;
    default:
      return null;
  }
}

async function checkAndSendAlert(errorEvent: z.infer<typeof errorEventSchema>) {
  try {
    const prisma = getPrismaClient();
    
    // Check if we've seen this error frequently in the last hour
    const recentSimilarErrors = await prisma.monitoringLog.count({
      where: {
        type: 'error',
        message: errorEvent.message,
        timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    // Send alert if this is the 5th occurrence of this error in the last hour
    if (recentSimilarErrors >= 5) {
      // In a real implementation, this would call the email function
      console.log('Alert: Repeated error detected', {
        message: errorEvent.message,
        occurrences: recentSimilarErrors,
        functionName: errorEvent.functionName,
      });
    }
  } catch (error) {
    console.error('Failed to check alerts:', error);
  }
}