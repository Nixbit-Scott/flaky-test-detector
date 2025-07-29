import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { createMonitor } from './monitoring-utils';

// For now, let's use a simple database connection without Prisma
// We'll create users in a way that works with Netlify Functions

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Simple in-memory store for demo (in production, this would be database)
// This will reset on each function cold start, but good for testing
const users: Map<string, {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
}> = new Map();

// Initialize test accounts on each cold start
const initializeTestAccounts = async () => {
  const bcrypt = await import('bcryptjs');
  
  // Regular user account
  if (!users.has('scott@nixbit.dev')) {
    const hashedPassword = await bcrypt.hash('demo1234', 10);
    users.set('scott@nixbit.dev', {
      id: 'user-scott',
      email: 'scott@nixbit.dev',
      name: 'Scott Sanderson',
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });
  }
  
  // Admin account
  if (!users.has('admin@nixbit.dev')) {
    const adminPassword = await bcrypt.hash('nixbit2025', 10);
    users.set('admin@nixbit.dev', {
      id: 'admin-nixbit',
      email: 'admin@nixbit.dev',
      name: 'Nixbit Administrator',
      password: adminPassword,
      createdAt: new Date().toISOString(),
    });
  }
};


export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const monitor = createMonitor('auth');
  
  try {
    // Initialize test accounts on each function call
    await initializeTestAccounts();
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      await monitor.logPerformance();
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    console.log('Auth function called:', {
      path: event.path,
      httpMethod: event.httpMethod,
    });
    
    // Extract the path - get the last segment after the last slash
    const pathParts = event.path.split('/');
    const path = pathParts[pathParts.length - 1];
    
    let result;
    // Handle different auth endpoints
    switch (path) {
      case 'register':
        result = await handleRegister(event, monitor);
        break;
      case 'login':
        result = await handleLogin(event, monitor);
        break;
      case 'logout':
        result = await handleLogout(event);
        break;
      case 'me':
        result = await handleMe(event);
        break;
      default:
        result = {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Auth endpoint not found' }),
        };
    }
    
    await monitor.logPerformance();
    return result;
  } catch (error) {
    console.error('Auth function error:', error);
    await monitor.logError(error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function handleRegister(event: HandlerEvent, monitor: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('Register body:', event.body);
    
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }
    
    const body = JSON.parse(event.body);
    console.log('Parsed body:', body);
    
    const validatedData = registerSchema.parse(body);
    
    // Check if user already exists
    if (users.has(validatedData.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'User already exists with this email',
        }),
      };
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    // Create user
    const userId = 'user-' + Date.now();
    const user = {
      id: userId,
      email: validatedData.email,
      password: hashedPassword,
      name: validatedData.name || 'User',
      createdAt: new Date().toISOString(),
    };
    
    // Store user
    users.set(validatedData.email, user);
    
    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
      console.log('Welcome email sent to:', user.email);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail registration if email fails
    }
    
    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    console.log('Registration successful for:', validatedData.email);
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'User created successfully',
        user: userWithoutPassword,
        token,
      }),
    };
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid JSON in request body',
        }),
      };
    }
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.issues,
        }),
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Registration failed',
      }),
    };
  }
}

async function handleLogin(event: HandlerEvent, monitor: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const validatedData = loginSchema.parse(body);
    
    // Find user
    const user = users.get(validatedData.email);
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Invalid credentials',
        }),
      };
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
    
    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Invalid credentials',
        }),
      };
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Return user without password
    const { password, ...userWithoutPassword } = user;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Login successful',
        user: userWithoutPassword,
        token,
      }),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.issues,
        }),
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Login failed',
      }),
    };
  }
}

async function handleLogout(event: HandlerEvent) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: 'Logout successful',
    }),
  };
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
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    
    // Find user
    const user = users.get(decoded.email);
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        user: userWithoutPassword,
      }),
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

// Email integration helper function
async function sendWelcomeEmail(email: string, name: string) {
  try {
    const emailData = {
      to: email,
      template: 'welcome',
      data: { name, email },
      provider: 'sendgrid' // Default to SendGrid, will fallback if not available
    };

    const response = await fetch(`${process.env.URL || 'https://flakytestdetector.netlify.app'}/.netlify/functions/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Email service error: ${error}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Welcome email failed:', error);
    throw error;
  }
}