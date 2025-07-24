import jwt from 'jsonwebtoken';
import { logger } from './logger';

interface AdminTokenPayload {
  userId: string;
  isSystemAdmin: boolean;
  iat?: number;
  exp?: number;
}

export const verifyAdminWebSocketToken = async (token: string): Promise<AdminTokenPayload | null> => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured for WebSocket authentication');
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as AdminTokenPayload;
    
    // Check if the user is a system admin
    if (!decoded.isSystemAdmin) {
      logger.warn('Non-admin user attempted WebSocket connection', { userId: decoded.userId });
      return null;
    }

    return {
      userId: decoded.userId,
      isSystemAdmin: decoded.isSystemAdmin,
    };
  } catch (error) {
    logger.error('Failed to verify WebSocket JWT token', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
};