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
const ADMIN_PASSWORD_HASH = '$2a$10$K7Zb8MQX9XcvW2MqO2OWAe.JXQ5PVKr2XYZM3dCVHd6RjOeGNdqHS'; // 'nixbit2025'

// Initialize admin password hash
let adminPasswordHash: string | null = null;

const initializeAdmin = async () => {
  if (!adminPasswordHash) {
    adminPasswordHash = await bcrypt.hash('nixbit2025', 10);
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
  const mockStats = {
    totalOrganizations: 12,
    activeUsers: 43,
    testRunsToday: 127,
    activeFlakyTests: 8,
    monthlyRecurringRevenue: 2890,
    systemUptime: 99.7,
    averageResponseTime: 145,
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(mockStats),
  };
}

async function handleMetrics() {
  const mockMetrics = {
    cpuUsage: [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), value: 45 },
      { timestamp: new Date(Date.now() - 1800000).toISOString(), value: 52 },
      { timestamp: new Date().toISOString(), value: 38 },
    ],
    memoryUsage: [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), value: 67 },
      { timestamp: new Date(Date.now() - 1800000).toISOString(), value: 72 },
      { timestamp: new Date().toISOString(), value: 69 },
    ],
    requestRate: [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), value: 124 },
      { timestamp: new Date(Date.now() - 1800000).toISOString(), value: 156 },
      { timestamp: new Date().toISOString(), value: 142 },
    ],
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(mockMetrics),
  };
}

async function handleActivity() {
  const mockActivity = [
    {
      id: '1',
      type: 'user_login',
      user: 'john@example.com',
      description: 'User logged in',
      timestamp: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: '2',
      type: 'test_run',
      user: 'jane@company.com',
      description: 'Started test run for project "API Tests"',
      timestamp: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: '3',
      type: 'flaky_test_detected',
      user: 'system',
      description: 'Detected flaky test in AuthService.test.js',
      timestamp: new Date(Date.now() - 900000).toISOString(),
    },
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ activity: mockActivity }),
  };
}

async function handleUsers() {
  const mockUsers = {
    data: [
      {
        id: 'user-1',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'user',
        status: 'active',
        isSystemAdmin: false,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastLogin: new Date(Date.now() - 300000).toISOString(),
        projectsCreated: 2,
        testResultsSubmitted: 45,
        totalSessions: 12,
        avgSessionDuration: 18,
      },
      {
        id: 'admin-nixbit',
        email: ADMIN_EMAIL,
        name: 'Nixbit Administrator',
        role: 'admin',
        status: 'active',
        isSystemAdmin: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastLogin: new Date().toISOString(),
        projectsCreated: 0,
        testResultsSubmitted: 0,
        totalSessions: 5,
        avgSessionDuration: 25,
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(mockUsers),
  };
}

async function handleOrganizations() {
  const mockOrganizations = {
    data: [
      {
        id: 'org-1',
        name: 'Acme Corp',
        plan: 'enterprise',
        status: 'active',
        userCount: 25,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        monthlySpend: 299,
        testRuns: 1250,
        healthScore: 92,
      },
      {
        id: 'org-2',
        name: 'TechStart Inc',
        plan: 'team',
        status: 'active',
        userCount: 8,
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        monthlySpend: 99,
        testRuns: 456,
        healthScore: 78,
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(mockOrganizations),
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

  // Mock audit log data
  const allLogs = [
    {
      id: 'audit-1',
      userId: 'user-1',
      action: 'user_login',
      resourceType: 'user',
      resourceId: 'user-1',
      category: 'authentication',
      severity: 'info',
      description: 'User successfully logged in',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      details: {
        loginMethod: 'email_password',
        sessionId: 'sess_abc123'
      },
      createdAt: new Date(Date.now() - 300000).toISOString(),
      user: {
        id: 'user-1',
        email: 'john@example.com',
        name: 'John Doe'
      }
    },
    {
      id: 'audit-2',
      userId: 'admin-nixbit',
      action: 'organization_suspend',
      resourceType: 'organization',
      resourceId: 'org-123',
      category: 'organization_management',
      severity: 'warn',
      description: 'Organization suspended for policy violation',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      details: {
        reason: 'Terms of service violation',
        suspensionType: 'temporary'
      },
      beforeState: {
        status: 'active',
        plan: 'enterprise'
      },
      afterState: {
        status: 'suspended',
        plan: 'enterprise',
        suspendedAt: new Date().toISOString()
      },
      createdAt: new Date(Date.now() - 600000).toISOString(),
      user: {
        id: 'admin-nixbit',
        email: ADMIN_EMAIL,
        name: 'Nixbit Administrator'
      }
    },
    {
      id: 'audit-3',
      action: 'system_backup',
      resourceType: 'system',
      category: 'system',
      severity: 'info',
      description: 'Automated system backup completed successfully',
      details: {
        backupSize: '2.4GB',
        backupLocation: 's3://nixbit-backups/2024-08-01',
        duration: '45 minutes'
      },
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'audit-4',
      userId: 'user-2',
      action: 'project_create',
      resourceType: 'project',
      resourceId: 'proj-456',
      category: 'project_management',
      severity: 'info',
      description: 'New project created',
      ipAddress: '203.0.113.45',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      details: {
        projectName: 'E-commerce Tests',
        repository: 'github.com/company/ecommerce'
      },
      afterState: {
        id: 'proj-456',
        name: 'E-commerce Tests',
        status: 'active'
      },
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      user: {
        id: 'user-2',
        email: 'jane@company.com',
        name: 'Jane Smith'
      }
    },
    {
      id: 'audit-5',
      action: 'system_alert',
      resourceType: 'system',
      category: 'system',
      severity: 'error',
      description: 'Database connection pool exhausted',
      details: {
        errorCode: 'DB_POOL_EXHAUSTED',
        activeConnections: 100,
        maxConnections: 100,
        queuedQueries: 25
      },
      createdAt: new Date(Date.now() - 10800000).toISOString()
    },
    {
      id: 'audit-6',
      userId: 'admin-nixbit',
      action: 'user_role_change',
      resourceType: 'user',
      resourceId: 'user-3',
      category: 'user_management',
      severity: 'warn',
      description: 'User role elevated to system administrator',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      beforeState: {
        role: 'user',
        isSystemAdmin: false
      },
      afterState: {
        role: 'admin',
        isSystemAdmin: true
      },
      details: {
        elevatedBy: 'admin-nixbit',
        reason: 'Operational requirement'
      },
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      user: {
        id: 'admin-nixbit',
        email: ADMIN_EMAIL,
        name: 'Nixbit Administrator'
      }
    }
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