import { SSOService } from './sso.service';
import { SSOAuditService } from './sso-audit.service';
import { prisma } from './database.service';

export interface CachedStrategy {
  organizationId: string;
  providerId: string;
  strategy: any; // Passport strategy instance
  config: Record<string, any>;
  metadata: {
    cacheKey: string;
    createdAt: Date;
    lastUsed: Date;
    useCount: number;
    version: string; // Config version hash
  };
  performance: {
    averageInitTime: number;
    totalInitTime: number;
    initCount: number;
  };
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  evictions: number;
  memoryUsage: {
    used: number;
    allocated: number;
    percentage: number;
  };
  performance: {
    averageLookupTime: number;
    averageInitTime: number;
    cacheEfficiency: number;
  };
}

export interface CacheConfiguration {
  maxSize: number; // Maximum number of cached strategies
  maxMemoryMB: number; // Maximum memory usage in MB
  ttlMinutes: number; // Time to live in minutes
  evictionPolicy: 'lru' | 'lfu' | 'ttl'; // Eviction policy
  warmupStrategies: string[]; // Provider IDs to pre-warm
  compressionEnabled: boolean;
  metricsEnabled: boolean;
}

export class SSOStrategyCacheService {
  private static cache = new Map<string, CachedStrategy>();
  private static config: CacheConfiguration = {
    maxSize: 1000,
    maxMemoryMB: 256,
    ttlMinutes: 60,
    evictionPolicy: 'lru',
    warmupStrategies: [],
    compressionEnabled: true,
    metricsEnabled: true,
  };
  private static metrics = {
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    evictions: 0,
    lookupTimes: [] as number[],
  };

  // Initialize strategy cache with configuration
  static async initialize(customConfig?: Partial<CacheConfiguration>): Promise<void> {
    this.config = { ...this.config, ...customConfig };
    
    // Load configuration from database if available
    const savedConfig = await this.loadCacheConfiguration();
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }

    // Pre-warm cache with critical strategies
    await this.warmupCache();

    console.log('SSO Strategy Cache initialized:', {
      maxSize: this.config.maxSize,
      maxMemoryMB: this.config.maxMemoryMB,
      ttlMinutes: this.config.ttlMinutes,
      evictionPolicy: this.config.evictionPolicy,
    });
  }

  // Get or create cached strategy
  static async getStrategy(
    organizationId: string,
    providerId: string
  ): Promise<{ strategy: any; fromCache: boolean; initTime: number }> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(organizationId, providerId);
    
    this.metrics.totalRequests++;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheEntryValid(cached)) {
      // Update usage statistics
      cached.metadata.lastUsed = new Date();
      cached.metadata.useCount++;
      
      this.metrics.cacheHits++;
      this.updateHitRate();
      
      const lookupTime = Date.now() - startTime;
      this.metrics.lookupTimes.push(lookupTime);
      
      return {
        strategy: cached.strategy,
        fromCache: true,
        initTime: lookupTime,
      };
    }

    // Cache miss - create new strategy
    this.metrics.cacheMisses++;
    this.updateHitRate();

    const strategyResult = await this.createAndCacheStrategy(organizationId, providerId);
    
    const totalTime = Date.now() - startTime;
    this.metrics.lookupTimes.push(totalTime);

    return {
      strategy: strategyResult.strategy,
      fromCache: false,
      initTime: totalTime,
    };
  }

  // Create and cache new strategy
  private static async createAndCacheStrategy(
    organizationId: string,
    providerId: string
  ): Promise<CachedStrategy> {
    const initStartTime = Date.now();
    
    // Get provider configuration
    const provider = await SSOService.getSSOProvider(providerId);
    if (!provider) {
      throw new Error(`SSO provider ${providerId} not found`);
    }

    // Create strategy instance
    const strategy = await SSOService.createStrategyInstance(provider);
    const initTime = Date.now() - initStartTime;

    // Create cache entry
    const cacheKey = this.generateCacheKey(organizationId, providerId);
    const configVersion = this.generateConfigHash(provider.config);
    
    const cachedStrategy: CachedStrategy = {
      organizationId,
      providerId,
      strategy,
      config: provider.config,
      metadata: {
        cacheKey,
        createdAt: new Date(),
        lastUsed: new Date(),
        useCount: 1,
        version: configVersion,
      },
      performance: {
        averageInitTime: initTime,
        totalInitTime: initTime,
        initCount: 1,
      },
    };

    // Add to cache with eviction if necessary
    await this.addToCache(cacheKey, cachedStrategy);

    // Log cache miss and strategy creation
    if (this.config.metricsEnabled) {
      await SSOAuditService.logSSOEvent({
        organizationId,
        email: 'system',
        provider: 'strategy_cache',
        action: 'provision',
        details: {
          providerId,
          cacheKey,
          initTime,
          cacheSize: this.cache.size,
          fromCache: false,
        },
        severity: 'info',
        category: 'performance',
        timestamp: new Date(),
      });
    }

    return cachedStrategy;
  }

  // Add strategy to cache with eviction management
  private static async addToCache(cacheKey: string, strategy: CachedStrategy): Promise<void> {
    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize) {
      await this.evictEntries(1);
    }

    // Check memory usage
    const memoryUsage = this.estimateMemoryUsage();
    if (memoryUsage > this.config.maxMemoryMB * 1024 * 1024) {
      await this.evictEntries(Math.ceil(this.cache.size * 0.1)); // Evict 10%
    }

    this.cache.set(cacheKey, strategy);
  }

  // Evict cache entries based on policy
  private static async evictEntries(count: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    let toEvict: string[] = [];

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Sort by last used time, oldest first
        toEvict = entries
          .sort((a, b) => a[1].metadata.lastUsed.getTime() - b[1].metadata.lastUsed.getTime())
          .slice(0, count)
          .map(entry => entry[0]);
        break;

      case 'lfu':
        // Sort by use count, least used first
        toEvict = entries
          .sort((a, b) => a[1].metadata.useCount - b[1].metadata.useCount)
          .slice(0, count)
          .map(entry => entry[0]);
        break;

      case 'ttl':
        // Remove expired entries first
        const now = new Date();
        const ttlMs = this.config.ttlMinutes * 60 * 1000;
        
        toEvict = entries
          .filter(entry => now.getTime() - entry[1].metadata.createdAt.getTime() > ttlMs)
          .slice(0, count)
          .map(entry => entry[0]);
        break;
    }

    // Remove selected entries
    for (const key of toEvict) {
      this.cache.delete(key);
      this.metrics.evictions++;
    }

    console.log(`Evicted ${toEvict.length} cache entries using ${this.config.evictionPolicy} policy`);
  }

  // Invalidate cache entry when configuration changes
  static async invalidateStrategy(organizationId: string, providerId: string): Promise<void> {
    const cacheKey = this.generateCacheKey(organizationId, providerId);
    const removed = this.cache.delete(cacheKey);
    
    if (removed && this.config.metricsEnabled) {
      await SSOAuditService.logSSOEvent({
        organizationId,
        email: 'system',
        provider: 'strategy_cache',
        action: 'update',
        details: {
          providerId,
          cacheKey,
          reason: 'configuration_changed',
          cacheSize: this.cache.size,
        },
        severity: 'info',
        category: 'configuration',
        timestamp: new Date(),
      });
    }
  }

  // Warm up cache with critical strategies
  private static async warmupCache(): Promise<void> {
    if (this.config.warmupStrategies.length === 0) return;

    const warmupStart = Date.now();
    let warmedUp = 0;

    for (const providerId of this.config.warmupStrategies) {
      try {
        const provider = await SSOService.getSSOProvider(providerId);
        if (provider) {
          await this.getStrategy(provider.organizationId, providerId);
          warmedUp++;
        }
      } catch (error) {
        console.warn(`Failed to warm up strategy ${providerId}:`, error);
      }
    }

    const warmupTime = Date.now() - warmupStart;
    console.log(`Cache warmup completed: ${warmedUp}/${this.config.warmupStrategies.length} strategies in ${warmupTime}ms`);
  }

  // Get comprehensive cache metrics
  static getCacheMetrics(): CacheMetrics {
    const memoryUsage = this.estimateMemoryUsage();
    const allocatedMemory = this.config.maxMemoryMB * 1024 * 1024;
    
    const avgLookupTime = this.metrics.lookupTimes.length > 0
      ? this.metrics.lookupTimes.reduce((sum, time) => sum + time, 0) / this.metrics.lookupTimes.length
      : 0;

    const avgInitTime = this.calculateAverageInitTime();
    const cacheEfficiency = this.calculateCacheEfficiency();

    return {
      hitRate: this.metrics.hitRate,
      missRate: this.metrics.missRate,
      totalRequests: this.metrics.totalRequests,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      evictions: this.metrics.evictions,
      memoryUsage: {
        used: memoryUsage,
        allocated: allocatedMemory,
        percentage: (memoryUsage / allocatedMemory) * 100,
      },
      performance: {
        averageLookupTime: avgLookupTime,
        averageInitTime: avgInitTime,
        cacheEfficiency,
      },
    };
  }

  // Performance optimization methods
  static async optimizeCache(): Promise<{
    optimizationsApplied: string[];
    metricsImprovement: Record<string, number>;
  }> {
    const beforeMetrics = this.getCacheMetrics();
    const optimizations: string[] = [];

    // Adjust cache size based on hit rate
    if (beforeMetrics.hitRate < 0.7 && this.cache.size < this.config.maxSize * 0.8) {
      this.config.maxSize = Math.min(this.config.maxSize * 1.2, 2000);
      optimizations.push('increased_cache_size');
    }

    // Adjust TTL based on usage patterns
    const avgUsage = this.calculateAverageUsageFrequency();
    if (avgUsage > 10) { // High usage
      this.config.ttlMinutes = Math.min(this.config.ttlMinutes * 1.5, 240);
      optimizations.push('increased_ttl');
    }

    // Switch eviction policy if needed
    if (beforeMetrics.hitRate < 0.6 && this.config.evictionPolicy !== 'lfu') {
      this.config.evictionPolicy = 'lfu';
      optimizations.push('switched_to_lfu_eviction');
    }

    // Pre-warm high-usage strategies
    const highUsageProviders = this.identifyHighUsageProviders();
    if (highUsageProviders.length > 0) {
      this.config.warmupStrategies = [...new Set([...this.config.warmupStrategies, ...highUsageProviders])];
      optimizations.push('added_warmup_strategies');
    }

    const afterMetrics = this.getCacheMetrics();
    
    return {
      optimizationsApplied: optimizations,
      metricsImprovement: {
        hitRateImprovement: afterMetrics.hitRate - beforeMetrics.hitRate,
        memoryEfficiencyImprovement: afterMetrics.performance.cacheEfficiency - beforeMetrics.performance.cacheEfficiency,
      },
    };
  }

  // Helper methods
  private static generateCacheKey(organizationId: string, providerId: string): string {
    return `sso:${organizationId}:${providerId}`;
  }

  private static generateConfigHash(config: Record<string, any>): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex').substring(0, 16);
  }

  private static isCacheEntryValid(cached: CachedStrategy): boolean {
    const now = Date.now();
    const ageMs = now - cached.metadata.createdAt.getTime();
    const ttlMs = this.config.ttlMinutes * 60 * 1000;
    
    return ageMs < ttlMs;
  }

  private static updateHitRate(): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? this.metrics.cacheHits / this.metrics.totalRequests 
      : 0;
    this.metrics.missRate = 1 - this.metrics.hitRate;
  }

  private static estimateMemoryUsage(): number {
    // Rough estimation of memory usage
    let totalSize = 0;
    
    for (const [key, strategy] of this.cache.entries()) {
      // Estimate size of cache entry
      totalSize += key.length * 2; // Key string
      totalSize += JSON.stringify(strategy.config).length * 2; // Config object
      totalSize += 1024; // Strategy instance and metadata overhead
    }
    
    return totalSize;
  }

  private static calculateAverageInitTime(): number {
    const allInitTimes: number[] = [];
    
    for (const strategy of this.cache.values()) {
      allInitTimes.push(strategy.performance.averageInitTime);
    }
    
    return allInitTimes.length > 0
      ? allInitTimes.reduce((sum, time) => sum + time, 0) / allInitTimes.length
      : 0;
  }

  private static calculateCacheEfficiency(): number {
    // Efficiency = (time saved by caching) / (total time if no cache)
    const timeWithCache = this.metrics.lookupTimes.reduce((sum, time) => sum + time, 0);
    const estimatedTimeWithoutCache = this.metrics.totalRequests * this.calculateAverageInitTime();
    
    return estimatedTimeWithoutCache > 0
      ? ((estimatedTimeWithoutCache - timeWithCache) / estimatedTimeWithoutCache) * 100
      : 0;
  }

  private static calculateAverageUsageFrequency(): number {
    const usageCounts = Array.from(this.cache.values()).map(s => s.metadata.useCount);
    return usageCounts.length > 0
      ? usageCounts.reduce((sum, count) => sum + count, 0) / usageCounts.length
      : 0;
  }

  private static identifyHighUsageProviders(): string[] {
    return Array.from(this.cache.values())
      .filter(strategy => strategy.metadata.useCount > 20)
      .map(strategy => strategy.providerId)
      .slice(0, 10); // Top 10 high-usage providers
  }

  private static async loadCacheConfiguration(): Promise<Partial<CacheConfiguration> | null> {
    try {
      const config = await prisma.systemConfiguration.findUnique({
        where: { key: 'sso_cache_config' },
      });
      
      return config ? JSON.parse(config.value) : null;
    } catch (error) {
      console.warn('Failed to load cache configuration:', error);
      return null;
    }
  }

  // Cleanup and shutdown
  static async shutdown(): Promise<void> {
    // Save cache metrics before shutdown
    if (this.config.metricsEnabled) {
      const metrics = this.getCacheMetrics();
      
      await SSOAuditService.logSSOEvent({
        organizationId: 'system',
        email: 'system',
        provider: 'strategy_cache',
        action: 'config_change',
        details: {
          event: 'cache_shutdown',
          finalMetrics: metrics,
          cacheSize: this.cache.size,
        },
        severity: 'info',
        category: 'performance',
        timestamp: new Date(),
      });
    }

    // Clear cache
    this.cache.clear();
    console.log('SSO Strategy Cache shut down gracefully');
  }
}