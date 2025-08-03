import { logger } from './logger';
import { OIDCProviderValidator } from './oidc-security';
import { validateCertificate } from './saml-security';

/**
 * Provider health check result
 */
export interface ProviderHealthResult {
  isHealthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    connectivity: boolean;
    certificateValid?: boolean;
    endpointsAccessible?: boolean;
    responseTime: number;
  };
  errors: string[];
  lastChecked: Date;
}

/**
 * SSO Provider Health Check Service
 */
export class ProviderHealthCheck {
  private static healthCache = new Map<string, { result: ProviderHealthResult; cachedAt: Date }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Check health of an SSO provider
   */
  static async checkProviderHealth(
    providerId: string,
    providerType: 'saml' | 'oidc',
    config: any
  ): Promise<ProviderHealthResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cached = this.healthCache.get(providerId);
    if (cached && (Date.now() - cached.cachedAt.getTime()) < this.CACHE_DURATION) {
      return cached.result;
    }

    const result: ProviderHealthResult = {
      isHealthy: false,
      status: 'unhealthy',
      checks: {
        connectivity: false,
        responseTime: 0
      },
      errors: [],
      lastChecked: new Date()
    };

    try {
      if (providerType === 'oidc') {
        await this.checkOIDCProviderHealth(config, result);
      } else if (providerType === 'saml') {
        await this.checkSAMLProviderHealth(config, result);
      }

      result.checks.responseTime = Date.now() - startTime;

      // Determine overall health status
      const healthyChecks = Object.values(result.checks).filter(check => 
        typeof check === 'boolean' ? check : true
      ).length;
      const totalChecks = Object.keys(result.checks).filter(key => 
        key !== 'responseTime'
      ).length;

      if (healthyChecks === totalChecks) {
        result.status = 'healthy';
        result.isHealthy = true;
      } else if (healthyChecks > totalChecks / 2) {
        result.status = 'degraded';
        result.isHealthy = false;
      } else {
        result.status = 'unhealthy';
        result.isHealthy = false;
      }

      // Cache the result
      this.healthCache.set(providerId, {
        result,
        cachedAt: new Date()
      });

      logger.info('Provider health check completed', {
        providerId,
        providerType,
        status: result.status,
        responseTime: result.checks.responseTime,
        errorCount: result.errors.length
      });

      return result;
    } catch (error) {
      result.errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.checks.responseTime = Date.now() - startTime;

      logger.error('Provider health check failed', {
        providerId,
        providerType,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: result.checks.responseTime
      });

      return result;
    }
  }

  /**
   * Check OIDC provider health
   */
  private static async checkOIDCProviderHealth(config: any, result: ProviderHealthResult): Promise<void> {
    try {
      // Test OIDC discovery
      const issuer = await OIDCProviderValidator.discoverProvider(config.issuer);
      
      if (issuer && issuer.metadata) {
        result.checks.connectivity = true;
        
        // Check required endpoints
        const requiredEndpoints = [
          issuer.metadata.authorization_endpoint,
          issuer.metadata.token_endpoint,
          issuer.metadata.jwks_uri
        ];

        let accessibleEndpoints = 0;
        
        for (const endpoint of requiredEndpoints) {
          if (endpoint) {
            try {
              const response = await fetch(endpoint, {
                method: 'HEAD',
                timeout: 5000
              });
              
              if (response.ok || response.status === 405) { // 405 Method Not Allowed is OK for HEAD requests
                accessibleEndpoints++;
              }
            } catch (endpointError) {
              result.errors.push(`Endpoint not accessible: ${endpoint}`);
            }
          }
        }
        
        result.checks.endpointsAccessible = accessibleEndpoints === requiredEndpoints.length;
        
        if (!result.checks.endpointsAccessible) {
          result.errors.push(`Only ${accessibleEndpoints}/${requiredEndpoints.length} endpoints accessible`);
        }
      } else {
        result.errors.push('OIDC discovery failed or returned invalid metadata');
      }
    } catch (error) {
      result.errors.push(`OIDC provider discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check SAML provider health
   */
  private static async checkSAMLProviderHealth(config: any, result: ProviderHealthResult): Promise<void> {
    try {
      // Test SAML entry point accessibility
      if (config.entryPoint) {
        try {
          const response = await fetch(config.entryPoint, {
            method: 'HEAD',
            timeout: 5000
          });
          
          if (response.ok || response.status === 405) {
            result.checks.connectivity = true;
          } else {
            result.errors.push(`SAML entry point returned status: ${response.status}`);
          }
        } catch (endpointError) {
          result.errors.push(`SAML entry point not accessible: ${config.entryPoint}`);
        }
      }

      // Validate SAML certificate
      if (config.cert) {
        try {
          await validateCertificate(config.cert, 'health-check', 'health-check');
          result.checks.certificateValid = true;
        } catch (certError) {
          result.checks.certificateValid = false;
          result.errors.push(`Certificate validation failed: ${certError instanceof Error ? certError.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`SAML provider health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cached health status
   */
  static getCachedHealth(providerId: string): ProviderHealthResult | null {
    const cached = this.healthCache.get(providerId);
    if (cached && (Date.now() - cached.cachedAt.getTime()) < this.CACHE_DURATION) {
      return cached.result;
    }
    return null;
  }

  /**
   * Clear health cache for a provider
   */
  static clearHealthCache(providerId?: string): void {
    if (providerId) {
      this.healthCache.delete(providerId);
    } else {
      this.healthCache.clear();
    }
  }

  /**
   * Get health status for multiple providers
   */
  static async checkMultipleProviders(
    providers: Array<{ id: string; type: 'saml' | 'oidc'; config: any }>
  ): Promise<Map<string, ProviderHealthResult>> {
    const results = new Map<string, ProviderHealthResult>();
    
    // Run health checks in parallel
    const promises = providers.map(async provider => {
      const result = await this.checkProviderHealth(provider.id, provider.type, provider.config);
      results.set(provider.id, result);
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Clean up expired health cache entries
   */
  static cleanupHealthCache(): void {
    const expiredTime = Date.now() - this.CACHE_DURATION;
    
    for (const [providerId, cached] of this.healthCache.entries()) {
      if (cached.cachedAt.getTime() < expiredTime) {
        this.healthCache.delete(providerId);
      }
    }
  }
}

/**
 * Background health monitoring service
 */
export class BackgroundHealthMonitor {
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static monitoredProviders = new Map<string, { type: 'saml' | 'oidc'; config: any }>();

  /**
   * Start background health monitoring
   */
  static startMonitoring(intervalMinutes: number = 15): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        logger.error('Background health monitoring failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, intervalMinutes * 60 * 1000);

    logger.info('Background health monitoring started', {
      intervalMinutes,
      providerCount: this.monitoredProviders.size
    });
  }

  /**
   * Stop background health monitoring
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Background health monitoring stopped');
    }
  }

  /**
   * Add provider to monitoring
   */
  static addProvider(providerId: string, type: 'saml' | 'oidc', config: any): void {
    this.monitoredProviders.set(providerId, { type, config });
    logger.debug('Provider added to health monitoring', { providerId, type });
  }

  /**
   * Remove provider from monitoring
   */
  static removeProvider(providerId: string): void {
    this.monitoredProviders.delete(providerId);
    ProviderHealthCheck.clearHealthCache(providerId);
    logger.debug('Provider removed from health monitoring', { providerId });
  }

  /**
   * Run health checks for all monitored providers
   */
  private static async runHealthChecks(): Promise<void> {
    const providers = Array.from(this.monitoredProviders.entries()).map(([id, provider]) => ({
      id,
      type: provider.type,
      config: provider.config
    }));

    if (providers.length === 0) {
      return;
    }

    const results = await ProviderHealthCheck.checkMultipleProviders(providers);
    
    // Log unhealthy providers
    for (const [providerId, result] of results.entries()) {
      if (!result.isHealthy) {
        logger.warn('Provider health check failed', {
          providerId,
          status: result.status,
          errors: result.errors,
          responseTime: result.checks.responseTime
        });
      }
    }

    // Clean up old cache entries
    ProviderHealthCheck.cleanupHealthCache();
  }
}