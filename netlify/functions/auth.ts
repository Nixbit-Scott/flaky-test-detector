import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

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

// Pre-seed a demo user that's always available
const initializeDemoUser = async () => {
  if (!users.has('demo@example.com')) {
    const hashedPassword = await bcrypt.hash('demo1234', 10);
    users.set('demo@example.com', {
      id: 'user-demo',
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });
  }
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Initialize demo user on each function call
  await initializeDemoUser();
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('Auth function called:', {
      path: event.path,
      httpMethod: event.httpMethod,
    });
    
    // Extract the path - get the last segment after the last slash
    const pathParts = event.path.split('/');
    const path = pathParts[pathParts.length - 1];
    
    // Handle different auth endpoints
    switch (path) {
      case 'register':
        return await handleRegister(event);
      case 'login':
        return await handleLogin(event);
      case 'logout':
        return await handleLogout(event);
      case 'me':
        return await handleMe(event);
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Auth endpoint not found' }),
        };
    }
  } catch (error) {
    console.error('Auth function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function handleRegister(event: HandlerEvent) {
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
          details: error.errors,
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
          details: error.errors,
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