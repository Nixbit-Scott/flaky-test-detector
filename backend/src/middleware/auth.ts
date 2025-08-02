import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

// Type definitions are in src/types/express.d.ts

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    console.log('Auth middleware - checking authentication for:', req.method, req.path);
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader) {
      console.log('Missing authorization header');
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(' ')[1];
    console.log('Token extracted:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('Token missing from authorization header');
      res.status(401).json({ error: 'Token required' });
      return;
    }

    // Verify token
    console.log('Verifying token...');
    const decoded = UserService.verifyToken(token);
    console.log('Token verified, user:', decoded);
    
    // Add user info to request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};