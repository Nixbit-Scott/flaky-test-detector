// Monitoring utilities for Netlify Functions
// Use these utilities to easily add monitoring to existing functions

export interface MonitoringEvent {
  type: 'error' | 'performance' | 'health';
  timestamp: string;
  level?: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
  userId?: string;
  userAgent?: string;
  url?: string;
  functionName?: string;
  duration?: number;
  memoryUsed?: number;
  coldStart?: boolean;
  service?: string;
  status?: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
}

class MonitoringClient {
  private functionName: string;
  private startTime: number;

  constructor(functionName: string) {
    this.functionName = functionName;
    this.startTime = Date.now();
  }

  // Log an error with optional context
  async logError(error: Error | string, context?: {
    userId?: string;
    userAgent?: string;
    url?: string;
    metadata?: Record<string, any>;
  }) {
    const event: MonitoringEvent = {
      type: 'error',
      timestamp: new Date().toISOString(),
      level: 'error',
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      functionName: this.functionName,
      ...context,
    };

    return this.sendEvent(event);
  }

  // Log a warning
  async logWarning(message: string, context?: {
    userId?: string;
    metadata?: Record<string, any>;
  }) {
    const event: MonitoringEvent = {
      type: 'error',
      timestamp: new Date().toISOString(),
      level: 'warning',
      message,
      functionName: this.functionName,
      ...context,
    };

    return this.sendEvent(event);
  }

  // Log performance metrics
  async logPerformance(additionalData?: {
    memoryUsed?: number;
    coldStart?: boolean;
    metadata?: Record<string, any>;
  }) {
    const duration = Date.now() - this.startTime;
    
    const event: MonitoringEvent = {
      type: 'performance',
      timestamp: new Date().toISOString(),
      message: `Function ${this.functionName} executed in ${duration}ms`,
      functionName: this.functionName,
      duration,
      ...additionalData,
    };

    return this.sendEvent(event);
  }

  // Log health check results
  async logHealth(service: string, status: 'healthy' | 'degraded' | 'down', responseTime?: number, metadata?: Record<string, any>) {
    const event: MonitoringEvent = {
      type: 'health',
      timestamp: new Date().toISOString(),
      message: `${service} status: ${status}`,
      service,
      status,
      responseTime,
      metadata,
    };

    return this.sendEvent(event);
  }

  // Send event to monitoring system
  private async sendEvent(event: MonitoringEvent) {
    try {
      // Log to console for debugging
      console.log('[MONITORING]', JSON.stringify(event, null, 2));
      
      // Send to monitoring endpoint
      const monitoringUrl = process.env.URL 
        ? `${process.env.URL}/.netlify/functions/monitor/log`
        : '/.netlify/functions/monitor/log';
        
      const response = await fetch(monitoringUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
      
      if (!response.ok) {
        console.error('Failed to send monitoring event:', await response.text());
      } else {
        console.log('[MONITORING] Event sent successfully');
      }
    } catch (error) {
      console.error('Failed to send monitoring event:', error);
    }
  }

  // Get execution duration so far
  getExecutionDuration(): number {
    return Date.now() - this.startTime;
  }
}

// Factory function to create monitoring instance
export function createMonitor(functionName: string): MonitoringClient {
  return new MonitoringClient(functionName);
}

// Middleware wrapper for Netlify Functions
export function withMonitoring<T extends any[], R>(
  functionName: string,
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const monitor = createMonitor(functionName);
    
    try {
      const result = await handler(...args);
      
      // Log successful execution
      await monitor.logPerformance();
      
      return result;
    } catch (error) {
      // Log error
      await monitor.logError(error instanceof Error ? error : new Error(String(error)));
      
      // Re-throw the error
      throw error;
    }
  };
}

// Helper to extract user context from event
export function extractUserContext(event: any) {
  return {
    userAgent: event.headers['user-agent'] || event.headers['User-Agent'],
    url: event.path || event.rawUrl,
    userId: extractUserIdFromToken(event.headers.authorization || event.headers.Authorization),
  };
}

// Helper to extract user ID from JWT token
function extractUserIdFromToken(authHeader?: string): string | undefined {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }

  try {
    const token = authHeader.substring(7);
    // Basic JWT decode (just for monitoring, not for security)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId;
  } catch {
    return undefined;
  }
}

// Alerting thresholds and rules
export const ALERT_THRESHOLDS = {
  ERROR_RATE: 5, // Alert if more than 5 errors in 1 hour for same function
  RESPONSE_TIME: 5000, // Alert if response time > 5 seconds
  MEMORY_USAGE: 128 * 1024 * 1024, // Alert if memory usage > 128MB
  CONSECUTIVE_FAILURES: 3, // Alert if 3 consecutive failures
};

// Built-in alerts checker
export async function checkAlerts(event: MonitoringEvent) {
  // This would typically query the database to check patterns
  // For now, just basic checks
  
  if (event.type === 'error' && event.level === 'error') {
    console.log('[ALERT] Error detected:', event.message);
  }
  
  if (event.type === 'performance' && event.duration && event.duration > ALERT_THRESHOLDS.RESPONSE_TIME) {
    console.log('[ALERT] Slow response detected:', `${event.functionName} took ${event.duration}ms`);
  }
}

// Usage examples:
/*
// Basic usage in any function:
export const handler = async (event, context) => {
  const monitor = createMonitor('auth-login');
  
  try {
    // Your function logic here
    const result = await loginUser(email, password);
    
    // Log successful performance
    await monitor.logPerformance();
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    // Log error with context
    await monitor.logError(error, extractUserContext(event));
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Login failed' })
    };
  }
};

// Or use the wrapper:
export const handler = withMonitoring('auth-login', async (event, context) => {
  // Your function logic here
  return await loginUser(email, password);
});
*/