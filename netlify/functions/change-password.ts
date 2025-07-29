import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Password change schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

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

// Helper function to verify JWT and get user
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid token provided');
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Strong password validation
function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }
  
  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123', 'nixbit2025'];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak.toLowerCase()))) {
    return { isValid: false, message: 'Password is too common or weak' };
  }
  
  return { isValid: true };
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Initialize accounts
    await initializeTestAccounts();
    
    console.log('Change password function called');

    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await getUserFromToken(authHeader);

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validatedData = changePasswordSchema.parse(body);
    
    // Get user from store
    const userRecord = users.get(user.email);
    if (!userRecord) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(validatedData.currentPassword, userRecord.password);
    if (!isCurrentPasswordValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Current password is incorrect' }),
      };
    }

    // Validate new password strength
    const strengthCheck = validatePasswordStrength(validatedData.newPassword);
    if (!strengthCheck.isValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: strengthCheck.message }),
      };
    }

    // Check if new password is the same as current
    const isSamePassword = await bcrypt.compare(validatedData.newPassword, userRecord.password);
    if (isSamePassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'New password must be different from current password' }),
      };
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(validatedData.newPassword, 10);
    
    // Update password in store
    userRecord.password = hashedNewPassword;
    users.set(user.email, userRecord);

    console.log('Password changed successfully for user:', user.email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Password changed successfully',
        user: {
          id: userRecord.id,
          email: userRecord.email,
          name: userRecord.name,
        },
      }),
    };
  } catch (error) {
    console.error('Change password error:', error);
    
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

    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    return {
      statusCode: error instanceof Error && error.message.includes('token') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to change password' 
      }),
    };
  }
};