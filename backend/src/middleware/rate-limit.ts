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

// Enhanced SSO rate limiting with progressive penalties
export const ssoRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Very strict: only 10 SSO attempts per 15 minutes
  message: {
    error: 'SSO rate limit exceeded',
    message: 'Too many SSO authentication attempts from this IP. Please try again later.',
    retryAfter: '15 minutes',
    code: 'SSO_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use organization + IP for rate limiting to prevent cross-org attacks
    const organizationId = req.params?.organizationId || req.body?.organizationId;
    const ip = req.ip || '';
    return organizationId ? `sso_${organizationId}_${ip}` : `sso_${ip}`;
  },
  store: redisClient.isReady ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'rl:sso:',
  }) : undefined,
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    console.warn('SSO rate limit exceeded', {
      ip: req.ip,
      organizationId: req.params?.organizationId || req.body?.organizationId,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      error: 'SSO rate limit exceeded',
      message: 'Too many SSO authentication attempts from this IP. Please try again later.',
      retryAfter: '15 minutes',
      code: 'SSO_RATE_LIMIT_EXCEEDED',
    });
  },
});

// Callback-specific rate limiting (stricter)
export const ssoCallbackRateLimitMiddleware = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 callback attempts per 5 minutes
  message: {
    error: 'SSO callback rate limit exceeded',
    message: 'Too many SSO callback requests from this IP.',
    retryAfter: '5 minutes',
    code: 'SSO_CALLBACK_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use provider + IP for rate limiting
    const providerId = req.params?.providerId;
    const ip = req.ip || '';
    return providerId ? `sso_callback_${providerId}_${ip}` : `sso_callback_${ip}`;
  },
  store: redisClient.isReady ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'rl:sso:callback:',
  }) : undefined,
});

// Configuration endpoint rate limiting (protect against brute force config changes)
export const ssoConfigRateLimitMiddleware = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 config operations per hour
  message: {
    error: 'SSO configuration rate limit exceeded',
    message: 'Too many SSO configuration changes from this IP.',
    retryAfter: '1 hour',
    code: 'SSO_CONFIG_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID + IP for authenticated rate limiting
    const userId = (req as any).user?.id;
    const ip = req.ip || '';
    return userId ? `sso_config_${userId}_${ip}` : `sso_config_${ip}`;
  },
  store: redisClient.isReady ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'rl:sso:config:',
  }) : undefined,
});

export { redisClient };