/**
 * Redis Caching Service for Nixbit Performance Optimization
 * Implements intelligent caching strategies for frequently accessed data
 */

import { createClient, RedisClientOptions } from 'redis';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
  skipCache?: boolean;
}

export interface CacheKey {
  type: 'analytics' | 'flaky-tests' | 'quarantine' | 'predictions' | 'dashboard' | 'user' | 'api';
  identifier: string;
  params?: Record<string, any>;
}

class CacheService {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Cache TTL configurations (in seconds)
  private readonly TTL_CONFIG = {
    // Short-term cache (5 minutes)
    short: 300,
    // Medium-term cache (30 minutes) 
    medium: 1800,
    // Long-term cache (2 hours)
    long: 7200,
    // Very long-term cache (24 hours)
    extended: 86400,
    // Analytics cache (1 hour)
    analytics: 3600,
    // Dashboard cache (10 minutes)
    dashboard: 600,
    // User session cache (30 minutes)
    session: 1800,
    // API response cache (5 minutes)
    api: 300,
    // ML predictions cache (6 hours)
    predictions: 21600,
    // Quarantine data cache (15 minutes)
    quarantine: 900
  };

  // Cache key prefixes
  private readonly KEY_PREFIXES = {
    analytics: 'analytics:',
    'flaky-tests': 'flaky:',
    quarantine: 'quarantine:',
    predictions: 'predictions:',
    dashboard: 'dashboard:',
    user: 'user:',
    api: 'api:',
    system: 'system:'
  };

  async initialize(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      const clientOptions: RedisClientOptions = {
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries >= this.maxReconnectAttempts) {
              logger.error('Max Redis reconnection attempts reached');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        },
        commandsQueueMaxLength: 1000
      };

      this.client = createClient(clientOptions);

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('error', (error) => {
        logger.error('Redis client error:', error);
        this.isConnected = false;
        this.reconnectAttempts++;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      this.client.on('end', () => {
        logger.info('Redis client connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      logger.info('🔗 Redis cache service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Redis cache service:', error);
      // Don't throw - allow application to continue without cache
    }
  }

  private generateKey(cacheKey: CacheKey): string {
    const prefix = this.KEY_PREFIXES[cacheKey.type] || 'general:';
    let key = `${prefix}${cacheKey.identifier}`;
    
    if (cacheKey.params) {
      const paramString = Object.entries(cacheKey.params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      key += `:${paramString}`;
    }
    
    return key;
  }

  private getTTL(type: CacheKey['type'], customTTL?: number): number {
    if (customTTL) return customTTL;
    
    switch (type) {
      case 'analytics': return this.TTL_CONFIG.analytics;
      case 'dashboard': return this.TTL_CONFIG.dashboard;
      case 'flaky-tests': return this.TTL_CONFIG.medium;
      case 'quarantine': return this.TTL_CONFIG.quarantine;
      case 'predictions': return this.TTL_CONFIG.predictions;
      case 'user': return this.TTL_CONFIG.session;
      case 'api': return this.TTL_CONFIG.api;
      default: return this.TTL_CONFIG.medium;
    }
  }

  async get<T>(cacheKey: CacheKey, options: CacheOptions = {}): Promise<T | null> {
    if (!this.isConnected || !this.client || options.skipCache) {
      return null;
    }

    try {
      const key = this.generateKey(cacheKey);
      const value = await this.client.get(key);
      
      if (value === null) {
        return null;
      }

      const parsed = JSON.parse(value);
      
      // Check if data has metadata (for cache statistics)
      if (parsed._metadata) {
        // Update cache hit statistics
        await this.updateCacheStats(cacheKey.type, 'hit');
        return parsed.data;
      }
      
      return parsed;

    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(cacheKey: CacheKey, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client || options.skipCache) {
      return false;
    }

    try {
      const key = this.generateKey(cacheKey);
      const ttl = this.getTTL(cacheKey.type, options.ttl);
      
      // Wrap data with metadata for cache analytics
      const dataToCache = {
        data: value,
        _metadata: {
          cachedAt: Date.now(),
          ttl,
          type: cacheKey.type
        }
      };

      const serialized = JSON.stringify(dataToCache);
      
      // Optionally compress large payloads
      const finalData = options.compress && serialized.length > 1024 
        ? await this.compress(serialized) 
        : serialized;

      await this.client.setEx(key, ttl, finalData);
      
      // Update cache set statistics
      await this.updateCacheStats(cacheKey.type, 'set');
      
      return true;

    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async delete(cacheKey: CacheKey): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const key = this.generateKey(cacheKey);
      const result = await this.client.del(key);
      return result > 0;

    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(keys);
      logger.info(`Invalidated ${result} cache keys matching pattern: ${pattern}`);
      return result;

    } catch (error) {
      logger.error('Cache invalidate pattern error:', error);
      return 0;
    }
  }

  // High-level caching methods for common use cases

  async getOrSet<T>(
    cacheKey: CacheKey,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(cacheKey, options);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    await this.updateCacheStats(cacheKey.type, 'miss');
    const data = await fetchFunction();
    
    // Cache the result
    await this.set(cacheKey, data, options);
    
    return data;
  }

  // Specialized caching methods

  async cacheAnalyticsData(projectId: string, timeRange: string, data: any, ttl?: number): Promise<void> {
    const cacheKey: CacheKey = {
      type: 'analytics',
      identifier: projectId,
      params: { timeRange }
    };
    
    await this.set(cacheKey, data, { ttl: ttl || this.TTL_CONFIG.analytics });
  }

  async getCachedAnalyticsData(projectId: string, timeRange: string): Promise<any> {
    const cacheKey: CacheKey = {
      type: 'analytics',
      identifier: projectId,
      params: { timeRange }
    };
    
    return await this.get(cacheKey);
  }

  async cacheDashboardData(userId: string, data: any): Promise<void> {
    const cacheKey: CacheKey = {
      type: 'dashboard',
      identifier: userId
    };
    
    await this.set(cacheKey, data, { ttl: this.TTL_CONFIG.dashboard });
  }

  async getCachedDashboardData(userId: string): Promise<any> {
    const cacheKey: CacheKey = {
      type: 'dashboard',
      identifier: userId
    };
    
    return await this.get(cacheKey);
  }

  async cacheFlakyTestPatterns(projectId: string, patterns: any): Promise<void> {
    const cacheKey: CacheKey = {
      type: 'flaky-tests',
      identifier: projectId
    };
    
    await this.set(cacheKey, patterns, { ttl: this.TTL_CONFIG.medium });
  }

  async getCachedFlakyTestPatterns(projectId: string): Promise<any> {
    const cacheKey: CacheKey = {
      type: 'flaky-tests',
      identifier: projectId
    };
    
    return await this.get(cacheKey);
  }

  async cacheQuarantineData(projectId: string, data: any): Promise<void> {
    const cacheKey: CacheKey = {
      type: 'quarantine',
      identifier: projectId
    };
    
    await this.set(cacheKey, data, { ttl: this.TTL_CONFIG.quarantine });
  }

  async getCachedQuarantineData(projectId: string): Promise<any> {
    const cacheKey: CacheKey = {
      type: 'quarantine',
      identifier: projectId
    };
    
    return await this.get(cacheKey);
  }

  async cachePredictionResults(projectId: string, predictions: any): Promise<void> {
    const cacheKey: CacheKey = {
      type: 'predictions',
      identifier: projectId
    };
    
    await this.set(cacheKey, predictions, { ttl: this.TTL_CONFIG.predictions });
  }

  async getCachedPredictionResults(projectId: string): Promise<any> {
    const cacheKey: CacheKey = {
      type: 'predictions',
      identifier: projectId
    };
    
    return await this.get(cacheKey);
  }

  // Cache invalidation methods

  async invalidateProjectCache(projectId: string): Promise<void> {
    const patterns = [
      `${this.KEY_PREFIXES.analytics}${projectId}*`,
      `${this.KEY_PREFIXES['flaky-tests']}${projectId}*`,
      `${this.KEY_PREFIXES.quarantine}${projectId}*`,
      `${this.KEY_PREFIXES.predictions}${projectId}*`
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `${this.KEY_PREFIXES.dashboard}${userId}*`,
      `${this.KEY_PREFIXES.user}${userId}*`
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }

  // Cache statistics and monitoring

  private async updateCacheStats(type: string, operation: 'hit' | 'miss' | 'set'): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      const statsKey = `${this.KEY_PREFIXES.system}stats:${type}:${operation}`;
      await this.client.incr(statsKey);
      await this.client.expire(statsKey, 86400); // Expire stats after 24 hours
    } catch (error) {
      // Don't log stats errors to avoid noise
    }
  }

  async getCacheStats(): Promise<Record<string, any>> {
    if (!this.isConnected || !this.client) {
      return { error: 'Cache not connected' };
    }

    try {
      const statsKeys = await this.client.keys(`${this.KEY_PREFIXES.system}stats:*`);
      const stats: Record<string, any> = {};

      for (const key of statsKeys) {
        const value = await this.client.get(key);
        const keyParts = key.split(':');
        const type = keyParts[2];
        const operation = keyParts[3];
        
        if (!stats[type]) stats[type] = {};
        stats[type][operation] = parseInt(value || '0', 10);
      }

      // Calculate hit rates
      Object.keys(stats).forEach(type => {
        const hits = stats[type].hit || 0;
        const misses = stats[type].miss || 0;
        const total = hits + misses;
        stats[type].hitRate = total > 0 ? (hits / total * 100).toFixed(2) + '%' : '0%';
      });

      return stats;

    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { error: 'Failed to get cache stats' };
    }
  }

  async getSystemInfo(): Promise<Record<string, any>> {
    if (!this.isConnected || !this.client) {
      return { connected: false };
    }

    try {
      const info = await this.client.info();
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: this.isConnected,
        info: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        reconnectAttempts: this.reconnectAttempts
      };

    } catch (error) {
      logger.error('Error getting Redis system info:', error);
      return { connected: false, error: error.message };
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    });
    return result;
  }

  private async compress(data: string): Promise<string> {
    // Simple compression placeholder - in production, use a proper compression library
    // like zlib or lz4 for better performance
    return data;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis cache service disconnected');
    }
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.isConnected || !this.client) {
        return { healthy: false, details: { error: 'Not connected' } };
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      const info = await this.getSystemInfo();
      
      return {
        healthy: true,
        details: {
          latency: `${latency}ms`,
          connected: this.isConnected,
          reconnectAttempts: this.reconnectAttempts,
          keyspace: info.keyspace
        }
      };

    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;