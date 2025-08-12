import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import * as jwt from 'jsonwebtoken';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Simple in-memory store (same as auth.ts - in production, this would be database)
const users: Map<string, {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
}> = new Map();

// Initialize accounts (same as auth.ts)
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
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'change_me_in_production', 10);
    users.set('admin@nixbit.dev', {
      id: 'admin-nixbit',
      email: 'admin@nixbit.dev',
      name: 'Nixbit Administrator',
      password: adminPassword,
      createdAt: new Date().toISOString(),
    });
  }
};

// Helper function to verify admin authentication
function verifyAdminToken(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  
  try {
    // For the client-side admin dashboard, we use a simple base64 token
    const payload = JSON.parse(atob(token));
    return payload.email === 'admin@nixbit.dev' && payload.role === 'admin' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

// Get user activity summary (mock data for now)
function getUserActivity(userId: string) {
  const mockActivity = {
    lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    projectsCreated: Math.floor(Math.random() * 3),
    testResultsSubmitted: Math.floor(Math.random() * 10),
    totalSessions: Math.floor(Math.random() * 20) + 1,
    avgSessionDuration: Math.floor(Math.random() * 30) + 5, // minutes
  };
  
  return mockActivity;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Initialize accounts
    await initializeTestAccounts();
    
    console.log('Admin users endpoint called');

    // Verify admin authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!verifyAdminToken(authHeader)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    const searchQuery = event.queryStringParameters?.search?.toLowerCase() || '';
    const sortBy = event.queryStringParameters?.sortBy || 'createdAt';
    const sortOrder = event.queryStringParameters?.sortOrder || 'desc';

    // Get all users (excluding passwords)
    const allUsers = Array.from(users.values()).map(user => {
      const activity = getUserActivity(user.id);
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        role: user.email === 'admin@nixbit.dev' ? 'admin' : 'user',
        status: 'active', // In production, this could be 'active', 'inactive', 'suspended'
        ...activity,
      };
    });

    // Filter users based on search query
    let filteredUsers = allUsers;
    if (searchQuery) {
      filteredUsers = allUsers.filter(user => 
        user.email.toLowerCase().includes(searchQuery) ||
        user.name.toLowerCase().includes(searchQuery) ||
        user.id.toLowerCase().includes(searchQuery)
      );
    }

    // Sort users
    filteredUsers.sort((a, b) => {
      let aValue = a[sortBy as keyof typeof a];
      let bValue = b[sortBy as keyof typeof b];
      
      // Handle different data types
      if (sortBy === 'createdAt' || sortBy === 'lastLogin') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Calculate summary statistics
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(user => {
      const daysSinceLastLogin = (Date.now() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastLogin <= 7; // Active in last 7 days
    }).length;
    
    const adminUsers = allUsers.filter(user => user.role === 'admin').length;
    const newUsersThisWeek = allUsers.filter(user => {
      const daysSinceCreated = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 7;
    }).length;

    console.log(`Admin users query - Total: ${totalUsers}, Active: ${activeUsers}, Search: "${searchQuery}"`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        users: filteredUsers,
        summary: {
          totalUsers,
          activeUsers,
          adminUsers,
          newUsersThisWeek,
          totalShown: filteredUsers.length,
        },
        query: {
          search: searchQuery,
          sortBy,
          sortOrder,
        },
      }),
    };
  } catch (error) {
    console.error('Admin users endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch users' 
      }),
    };
  }
};