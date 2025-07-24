import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { Request } from 'express';

// Create Redis client for rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err: Error) => {
  console.warn('Redis rate limiting unavailable, falling back to memory store:', err.message);
});

// Attempt to connect to Redis
redisClient.connect().catch((err: Error) => {
  console.warn('Could not connect to Redis for rate limiting:', err.message);
});

// Different rate limits for different endpoints
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient.isReady ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }) : undefined, // Fallback to memory store if Redis unavailable
});

// Stricter rate limiting for auth endpoints
export const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login/register attempts from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient.isReady ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }) : undefined,
});

// More lenient rate limiting for webhook endpoints
export const webhookRateLimitMiddleware = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for webhooks
  message: {
    error: 'Webhook rate limit exceeded',
    message: 'Too many webhook requests, please reduce frequency.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use API key or IP for rate limiting
    const apiKey = req.headers['x-api-key'] as string;
    return apiKey || ipKeyGenerator(req.ip || '');
  },
  store: redisClient.isReady ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }) : undefined,
});

// API key specific rate limiting
export const apiKeyRateLimitMiddleware = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour for authenticated API users
  message: {
    error: 'API rate limit exceeded',
    message: 'API rate limit exceeded for this key. Upgrade your plan for higher limits.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use API key or user ID for rate limiting
    const apiKey = req.headers['x-api-key'] as string;
    const userId = (req as any).user?.id;
    return apiKey || userId || ipKeyGenerator(req.ip || '');
  },
  store: redisClient.isReady ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }) : undefined,
});

export { redisClient };