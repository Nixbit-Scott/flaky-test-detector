import session from 'express-session';
import Redis from 'ioredis';
import RedisStore from 'connect-redis';
import { logger } from '../utils/logger';

// Session configuration with enterprise-grade security
export interface SessionConfig {
  secret: string;
  name: string;
  store?: session.Store;
  resave: boolean;
  saveUninitialized: boolean;
  rolling: boolean;
  unset: 'destroy' | 'keep';
  cookie: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax' | 'none' | boolean;
    domain?: string;
  };
}

/**
 * Creates Redis client for session store
 */
function createRedisClient(): Redis | null {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      // Connection timeout
      connectTimeout: 10000,
      // Command timeout
      commandTimeout: 5000,
      // SSL/TLS support for production
      ...(process.env.NODE_ENV === 'production' && {
        tls: {
          rejectUnauthorized: false, // Set to true in production with proper certificates
        },
      }),
    });

    redis.on('connect', () => {
      logger.info('📦 Redis session store connected');
    });

    redis.on('error', (error) => {
      logger.error('Redis session store error:', error);
    });

    redis.on('close', () => {
      logger.warn('Redis session store disconnected');
    });

    return redis;
  } catch (error) {
    logger.error('Failed to create Redis client for sessions:', error);
    return null;
  }
}

/**
 * Creates secure session configuration for SSO
 */
export function createSecureSessionConfig(): SessionConfig {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const SESSION_SECRET = process.env.SESSION_SECRET;
  
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required for secure sessions');
  }

  // Validate session secret strength
  if (SESSION_SECRET.length < 32) {
    logger.warn('⚠️ SESSION_SECRET should be at least 32 characters for security');
  }

  const isProduction = NODE_ENV === 'production';
  
  // Create Redis store for production
  let store: session.Store | undefined;
  if (isProduction) {
    const redisClient = createRedisClient();
    if (redisClient) {
      store = new RedisStore({
        client: redisClient,
        prefix: 'flaky-test-detector:sess:',
        ttl: 24 * 60 * 60, // 24 hours in seconds
        disableTouch: false,
        disableTTL: false,
      });
      logger.info('📦 Using Redis session store for production');
    } else {
      logger.warn('⚠️ Redis not available, falling back to memory store (not recommended for production)');
    }
  } else {
    logger.info('📦 Using memory session store for development');
  }

  const config: SessionConfig = {
    // Use environment secret or generate one
    secret: SESSION_SECRET,
    
    // Custom session name to avoid fingerprinting
    name: 'ftd.sid',
    
    // Redis store for production, memory for development
    store,
    
    // Don't save session if unmodified
    resave: false,
    
    // Don't create session until something stored
    saveUninitialized: false,
    
    // Extend session on each request
    rolling: true,
    
    // Destroy session data when unset
    unset: 'destroy',
    
    cookie: {
      // HTTPS only in production
      secure: isProduction,
      
      // Prevent XSS access to cookies
      httpOnly: true,
      
      // Session duration: 24 hours
      maxAge: 24 * 60 * 60 * 1000,
      
      // CSRF protection
      sameSite: isProduction ? 'strict' : 'lax',
      
      // Domain restriction for production
      ...(isProduction && process.env.COOKIE_DOMAIN && {
        domain: process.env.COOKIE_DOMAIN,
      }),
    },
  };

  // Validate configuration
  validateSessionConfig(config);
  
  return config;
}

/**
 * Validates session configuration for security
 */
function validateSessionConfig(config: SessionConfig): void {
  const issues: string[] = [];
  
  // Check secret strength
  if (config.secret.length < 32) {
    issues.push('Session secret should be at least 32 characters');
  }
  
  // Check production settings
  if (process.env.NODE_ENV === 'production') {
    if (!config.cookie.secure) {
      issues.push('Secure cookies must be enabled in production');
    }
    
    if (!config.cookie.httpOnly) {
      issues.push('HttpOnly cookies must be enabled for security');
    }
    
    if (config.cookie.sameSite !== 'strict' && config.cookie.sameSite !== 'lax') {
      issues.push('SameSite cookies should be set to strict or lax');
    }
    
    if (!config.store) {
      issues.push('Redis session store should be used in production');
    }
  }
  
  // Log warnings
  if (issues.length > 0) {
    logger.warn('Session configuration warnings:');
    issues.forEach(issue => logger.warn(`- ${issue}`));
  } else {
    logger.info('✅ Session configuration validated successfully');
  }
}

/**
 * Session cleanup utility
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const redisClient = createRedisClient();
    if (!redisClient) return;
    
    await redisClient.connect();
    
    // Get all session keys
    const keys = await redisClient.keys('flaky-test-detector:sess:*');
    
    if (keys.length === 0) {
      logger.info('No expired sessions to clean up');
      return;
    }
    
    // Check each session for expiration
    let cleanedCount = 0;
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl === -1) {
        // No TTL set, remove the session
        await redisClient.del(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
    
    await redisClient.disconnect();
  } catch (error) {
    logger.error('Error cleaning up expired sessions:', error);
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<{
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
}> {
  try {
    const redisClient = createRedisClient();
    if (!redisClient) {
      return { totalSessions: 0, activeSessions: 0, expiredSessions: 0 };
    }
    
    await redisClient.connect();
    
    const keys = await redisClient.keys('flaky-test-detector:sess:*');
    const totalSessions = keys.length;
    let activeSessions = 0;
    let expiredSessions = 0;
    
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) {
        activeSessions++;
      } else {
        expiredSessions++;
      }
    }
    
    await redisClient.disconnect();
    
    return { totalSessions, activeSessions, expiredSessions };
  } catch (error) {
    logger.error('Error getting session stats:', error);
    return { totalSessions: 0, activeSessions: 0, expiredSessions: 0 };
  }
}