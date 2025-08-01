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