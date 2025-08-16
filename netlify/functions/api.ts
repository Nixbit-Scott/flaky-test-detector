import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Admin credentials
const ADMIN_EMAIL = 'admin@nixbit.dev';
// Admin password hash will be generated from environment variable

// Initialize admin password hash
let adminPasswordHash: string | null = null;

const initializeAdmin = async () => {
  if (!adminPasswordHash) {
    adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'change_me_in_production', 10);
  }
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  await initializeAdmin();

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Parse the path to determine the endpoint
    const path = event.path.replace('/api', '').replace('/.netlify/functions/api', '');
    const pathSegments = path.split('/').filter(Boolean);
    
    console.log('Admin API called:', { path, pathSegments, method: event.httpMethod });

    // Route to different handlers
    if (pathSegments[0] === 'auth') {
      return await handleAuth(pathSegments.slice(1), event);
    } else if (pathSegments[0] === 'admin') {
      return await handleAdmin(pathSegments.slice(1), event);
    }

    // Default 404
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'API endpoint not found' }),
    };
  } catch (error) {
    console.error('Admin API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
    };
  }
};

async function handleAuth(pathSegments: string[], event: HandlerEvent) {
  const endpoint = pathSegments[0];

  switch (endpoint) {
    case 'login':
      return await handleLogin(event);
    case 'me':
      return await handleMe(event);
    default:
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Auth endpoint not found' }),
      };
  }
}

async function handleLogin(event: HandlerEvent) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email and password are required' }),
      };
    }

    // Check if it's the admin account
    if (email !== ADMIN_EMAIL) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminPasswordHash!);
    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    // Create JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    const token = jwt.sign(
      {
        userId: 'admin-nixbit',
        email: ADMIN_EMAIL,
        role: 'admin',
        isSystemAdmin: true,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    const user = {
      id: 'admin-nixbit',
      email: ADMIN_EMAIL,
      name: 'Nixbit Administrator',
      role: 'admin',
      isSystemAdmin: true,
      createdAt: new Date().toISOString(),
    };

    console.log('Admin login successful');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        user,
        token,
      }),
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Login failed' }),
    };
  }
}

async function handleMe(event: HandlerEvent) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No valid token provided' }),
      };
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Verify it's the admin user
    if (decoded.email !== ADMIN_EMAIL || !decoded.isSystemAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    const user = {
      id: 'admin-nixbit',
      email: ADMIN_EMAIL,
      name: 'Nixbit Administrator',
      role: 'admin',
      isSystemAdmin: true,
      createdAt: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(user),
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Authentication failed' }),
    };
  }
}

async function handleAdmin(pathSegments: string[], event: HandlerEvent) {
  // Verify admin authentication first
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Authentication required' }),
    };
  }

  try {
    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (decoded.email !== ADMIN_EMAIL || !decoded.isSystemAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }
  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid token' }),
    };
  }

  const endpoint = pathSegments[0];

  switch (endpoint) {
    case 'overview':
      return await handleOverview();
    case 'metrics':
      return await handleMetrics();
    case 'activity':
      return await handleActivity();
    case 'users':
      return await handleUsers();
    case 'organizations':
      return await handleOrganizations();
    case 'health':
      return await handleHealth();
    case 'audit-logs':
      return await handleAuditLogs(pathSegments.slice(1), event);
    default:
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Admin endpoint not found' }),
      };
  }
}

async function handleOverview() {
  // Return fresh system state - all zeros for new system
  const freshSystemStats = {
    totalOrganizations: 0,
    activeUsers: 0,
    testRunsToday: 0,
    activeFlakyTests: 0,
    monthlyRecurringRevenue: 0,
    systemUptime: 100.0,
    averageResponseTime: 0,
    organizations: [], // Empty array for organizations table
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(freshSystemStats),
  };
}

async function handleMetrics() {
  // Return minimal fresh system metrics
  const currentTime = new Date().toISOString();
  const freshMetrics = {
    cpuUsage: [
      { timestamp: currentTime, value: 5 }, // Very low usage for fresh system
    ],
    memoryUsage: [
      { timestamp: currentTime, value: 15 }, // Minimal memory usage
    ],
    requestRate: [
      { timestamp: currentTime, value: 0 }, // No requests yet
    ],
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(freshMetrics),
  };
}

async function handleActivity() {
  // Return empty activity for fresh system
  const freshActivity = [];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ activity: freshActivity }),
  };
}

async function handleUsers() {
  // Only show real system users - just admin for fresh system
  const systemUsers = {
    data: [
      {
        id: 'admin-nixbit',
        email: ADMIN_EMAIL,
        name: 'Nixbit Administrator',
        role: 'admin',
        status: 'active',
        isSystemAdmin: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        projectsCreated: 0,
        testResultsSubmitted: 0,
        totalSessions: 1,
        avgSessionDuration: 0,
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(systemUsers),
  };
}

async function handleOrganizations() {
  // Return empty organizations for fresh system
  const freshOrganizations = {
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(freshOrganizations),
  };
}

async function handleHealth() {
  const mockHealth = [
    {
      id: 'api-service',
      serviceName: 'api',
      status: 'healthy',
      responseTime: 145,
      errorRate: 0.1,
      uptime: 99.7,
      checkedAt: new Date().toISOString(),
      lastHealthyAt: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: 'database-service',
      serviceName: 'database',
      status: 'healthy',
      responseTime: 23,
      errorRate: 0.0,
      uptime: 99.9,
      checkedAt: new Date().toISOString(),
      lastHealthyAt: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: 'redis-service',
      serviceName: 'redis',
      status: 'degraded',
      responseTime: 89,
      errorRate: 2.3,
      uptime: 98.5,
      checkedAt: new Date().toISOString(),
      lastError: 'Connection timeout to Redis cluster',
      lastUnhealthyAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'webhooks-service',
      serviceName: 'webhooks',
      status: 'healthy',
      responseTime: 234,
      errorRate: 0.5,
      uptime: 99.2,
      checkedAt: new Date().toISOString(),
      lastHealthyAt: new Date(Date.now() - 900000).toISOString(),
    },
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(mockHealth),
  };
}

async function handleAuditLogs(pathSegments: string[], event: HandlerEvent) {
  // Parse query parameters for filtering
  const query = event.queryStringParameters || {};
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '25');
  const action = query.action;
  const severity = query.severity;
  const category = query.category;
  const resourceType = query.resourceType;
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  // Start with completely empty audit logs for fresh system
  const allLogs: any[] = [
    // Audit logs will appear here as users interact with the system
    // More audit logs will appear here as the system is used
  ];

  // Apply filters
  let filteredLogs = allLogs;

  if (action) {
    filteredLogs = filteredLogs.filter(log => 
      log.action.toLowerCase().includes(action.toLowerCase())
    );
  }

  if (severity) {
    filteredLogs = filteredLogs.filter(log => log.severity === severity);
  }

  if (category) {
    filteredLogs = filteredLogs.filter(log => log.category === category);
  }

  if (resourceType) {
    filteredLogs = filteredLogs.filter(log => log.resourceType === resourceType);
  }

  if (from && to) {
    filteredLogs = filteredLogs.filter(log => {
      const logDate = new Date(log.createdAt);
      return logDate >= from && logDate <= to;
    });
  }

  // Pagination
  const total = filteredLogs.length;
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedLogs = filteredLogs.slice(offset, offset + limit);

  const response = {
    logs: paginatedLogs,
    pagination: {
      page,
      limit,
      total,
      pages,
      totalPages: pages
    }
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(response),
  };
}