/**
 * Nixbit Performance Monitoring Dashboard
 * Real-time performance monitoring and alerting system
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:3001';
const MONITORING_INTERVAL = 30000; // 30 seconds
const ALERT_THRESHOLDS = {
  responseTime: 2000, // 2 seconds
  errorRate: 0.05, // 5%
  cpuUsage: 80, // 80%
  memoryUsage: 85, // 85%
  activeConnections: 1000,
  queueLength: 100
};

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      systemHealth: {},
      apiPerformance: {},
      databasePerformance: {},
      cachePerformance: {},
      alerts: [],
      trends: {
        responseTime: [],
        errorRate: [],
        throughput: []
      }
    };
    
    this.isRunning = false;
    this.intervalId = null;
  }

  async start() {
    console.log('🚀 Starting Nixbit Performance Monitor...\n');
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, MONITORING_INTERVAL);

    // Initial collection
    await this.collectMetrics();
    
    // Start the dashboard display
    this.startDashboard();
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('🛑 Performance monitoring stopped');
  }

  async collectMetrics() {
    try {
      const timestamp = new Date().toISOString();
      
      // Collect system health metrics
      await this.collectSystemHealth(timestamp);
      
      // Collect API performance metrics
      await this.collectAPIPerformance(timestamp);
      
      // Collect database performance metrics
      await this.collectDatabasePerformance(timestamp);
      
      // Collect cache performance metrics
      await this.collectCachePerformance(timestamp);
      
      // Analyze trends and generate alerts
      this.analyzePerformance(timestamp);
      
    } catch (error) {
      console.error('❌ Error collecting metrics:', error.message);
      this.generateAlert('monitoring_error', 'Failed to collect performance metrics', 'high');
    }
  }

  async collectSystemHealth(timestamp) {
    try {
      const startTime = performance.now();
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      const responseTime = performance.now() - startTime;
      
      this.metrics.systemHealth = {
        timestamp,
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime: responseTime.toFixed(2),
        uptime: response.data.uptime || 'unknown',
        version: response.data.version || 'unknown',
        environment: response.data.environment || 'unknown'
      };

      // Check response time threshold
      if (responseTime > ALERT_THRESHOLDS.responseTime) {
        this.generateAlert(
          'high_response_time', 
          `Health check response time: ${responseTime.toFixed(2)}ms`, 
          'medium'
        );
      }

    } catch (error) {
      this.metrics.systemHealth = {
        timestamp,
        status: 'unhealthy',
        responseTime: null,
        error: error.message
      };
      
      this.generateAlert('system_down', 'System health check failed', 'critical');
    }
  }

  async collectAPIPerformance(timestamp) {
    const endpoints = [
      { path: '/api/projects', name: 'Projects' },
      { path: '/api/flaky-tests', name: 'Flaky Tests' },
      { path: '/api/analytics/dashboard', name: 'Analytics' },
      { path: '/api/quarantine/stats/test-project', name: 'Quarantine' }
    ];

    const results = {};
    let totalResponseTime = 0;
    let errorCount = 0;

    for (const endpoint of endpoints) {
      try {
        const startTime = performance.now();
        const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
          timeout: 10000,
          headers: { 'Authorization': 'Bearer monitoring-token' }
        });
        const responseTime = performance.now() - startTime;

        results[endpoint.name] = {
          status: 'success',
          responseTime: responseTime.toFixed(2),
          statusCode: response.status,
          dataSize: JSON.stringify(response.data).length
        };

        totalResponseTime += responseTime;

      } catch (error) {
        results[endpoint.name] = {
          status: 'error',
          responseTime: null,
          error: error.message,
          statusCode: error.response?.status || 'timeout'
        };
        
        errorCount++;
      }
    }

    const errorRate = errorCount / endpoints.length;
    const avgResponseTime = totalResponseTime / (endpoints.length - errorCount);

    this.metrics.apiPerformance = {
      timestamp,
      endpoints: results,
      averageResponseTime: avgResponseTime.toFixed(2),
      errorRate: (errorRate * 100).toFixed(2) + '%',
      successfulRequests: endpoints.length - errorCount,
      failedRequests: errorCount
    };

    // Add to trends
    this.metrics.trends.responseTime.push({
      timestamp,
      value: avgResponseTime
    });
    this.metrics.trends.errorRate.push({
      timestamp,
      value: errorRate
    });

    // Keep only last 50 data points
    if (this.metrics.trends.responseTime.length > 50) {
      this.metrics.trends.responseTime = this.metrics.trends.responseTime.slice(-50);
      this.metrics.trends.errorRate = this.metrics.trends.errorRate.slice(-50);
    }

    // Check thresholds
    if (avgResponseTime > ALERT_THRESHOLDS.responseTime) {
      this.generateAlert(
        'slow_api_response', 
        `Average API response time: ${avgResponseTime.toFixed(2)}ms`, 
        'medium'
      );
    }

    if (errorRate > ALERT_THRESHOLDS.errorRate) {
      this.generateAlert(
        'high_error_rate', 
        `API error rate: ${(errorRate * 100).toFixed(2)}%`, 
        'high'
      );
    }
  }

  async collectDatabasePerformance(timestamp) {
    try {
      // Test database queries with different complexities
      const queries = [
        { name: 'Simple Select', path: '/api/projects?limit=10' },
        { name: 'Complex Analytics', path: '/api/analytics/trends?timeRange=7d' },
        { name: 'Aggregation Query', path: '/api/flaky-tests/patterns?includeStats=true' }
      ];

      const results = {};
      let totalQueryTime = 0;
      let successfulQueries = 0;

      for (const query of queries) {
        try {
          const startTime = performance.now();
          await axios.get(`${BASE_URL}${query.path}`, {
            timeout: 15000,
            headers: { 'Authorization': 'Bearer monitoring-token' }
          });
          const queryTime = performance.now() - startTime;

          results[query.name] = {
            status: 'success',
            responseTime: queryTime.toFixed(2),
            category: this.categorizeQueryComplexity(queryTime)
          };

          totalQueryTime += queryTime;
          successfulQueries++;

        } catch (error) {
          results[query.name] = {
            status: 'error',
            error: error.message,
            category: 'failed'
          };
        }
      }

      const avgQueryTime = successfulQueries > 0 ? totalQueryTime / successfulQueries : 0;

      this.metrics.databasePerformance = {
        timestamp,
        queries: results,
        averageQueryTime: avgQueryTime.toFixed(2),
        successfulQueries,
        failedQueries: queries.length - successfulQueries,
        healthStatus: this.getDatabaseHealthStatus(avgQueryTime, successfulQueries, queries.length)
      };

      // Alert on slow database performance
      if (avgQueryTime > ALERT_THRESHOLDS.responseTime * 2) {
        this.generateAlert(
          'slow_database', 
          `Average database query time: ${avgQueryTime.toFixed(2)}ms`, 
          'high'
        );
      }

    } catch (error) {
      this.metrics.databasePerformance = {
        timestamp,
        status: 'error',
        error: error.message
      };
    }
  }

  async collectCachePerformance(timestamp) {
    try {
      // Test cache performance by making repeated requests
      const cacheTestEndpoint = '/api/analytics/dashboard';
      const iterations = 3;
      const responseTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await axios.get(`${BASE_URL}${cacheTestEndpoint}`, {
          timeout: 5000,
          headers: { 'Authorization': 'Bearer monitoring-token' }
        });
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const firstRequestTime = responseTimes[0];
      const avgSubsequentTime = responseTimes.slice(1).reduce((a, b) => a + b, 0) / (iterations - 1);
      const cacheEfficiency = ((firstRequestTime - avgSubsequentTime) / firstRequestTime * 100);

      this.metrics.cachePerformance = {
        timestamp,
        firstRequestTime: firstRequestTime.toFixed(2),
        averageSubsequentTime: avgSubsequentTime.toFixed(2),
        cacheEfficiency: Math.max(0, cacheEfficiency).toFixed(2) + '%',
        status: cacheEfficiency > 20 ? 'effective' : 'ineffective',
        iterations
      };

      // Alert on poor cache performance
      if (cacheEfficiency < 10) {
        this.generateAlert(
          'poor_cache_performance', 
          `Cache efficiency: ${cacheEfficiency.toFixed(2)}%`, 
          'medium'
        );
      }

    } catch (error) {
      this.metrics.cachePerformance = {
        timestamp,
        status: 'error',
        error: error.message
      };
    }
  }

  categorizeQueryComplexity(queryTime) {
    if (queryTime < 100) return 'fast';
    if (queryTime < 500) return 'moderate';
    if (queryTime < 2000) return 'slow';
    return 'very-slow';
  }

  getDatabaseHealthStatus(avgQueryTime, successful, total) {
    if (successful < total * 0.8) return 'critical';
    if (avgQueryTime > 2000) return 'degraded';
    if (avgQueryTime > 1000) return 'warning';
    return 'healthy';
  }

  generateAlert(type, message, severity) {
    const alert = {
      timestamp: new Date().toISOString(),
      type,
      message,
      severity,
      id: Math.random().toString(36).substr(2, 9)
    };

    this.metrics.alerts.unshift(alert);
    
    // Keep only last 20 alerts
    if (this.metrics.alerts.length > 20) {
      this.metrics.alerts = this.metrics.alerts.slice(0, 20);
    }

    // Log critical alerts immediately
    if (severity === 'critical') {
      console.log(`\n🚨 CRITICAL ALERT: ${message}`);
    }
  }

  analyzePerformance(timestamp) {
    // Analyze trends over the last 10 data points
    const recentResponseTimes = this.metrics.trends.responseTime.slice(-10);
    const recentErrorRates = this.metrics.trends.errorRate.slice(-10);

    if (recentResponseTimes.length >= 5) {
      // Check for degrading performance trend
      const trend = this.calculateTrend(recentResponseTimes.map(d => d.value));
      
      if (trend > 1.5) { // Response times increasing by >1.5ms per measurement
        this.generateAlert(
          'performance_degradation', 
          `Performance degrading: +${trend.toFixed(2)}ms trend`, 
          'medium'
        );
      }
    }

    if (recentErrorRates.length >= 5) {
      // Check for increasing error rate
      const errorTrend = this.calculateTrend(recentErrorRates.map(d => d.value));
      
      if (errorTrend > 0.01) { // Error rate increasing by >1%
        this.generateAlert(
          'error_rate_increasing', 
          `Error rate trending up: +${(errorTrend * 100).toFixed(2)}%`, 
          'high'
        );
      }
    }
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + (x + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  startDashboard() {
    // Clear screen and show dashboard every 5 seconds
    setInterval(() => {
      this.displayDashboard();
    }, 5000);
    
    // Initial display
    this.displayDashboard();
  }

  displayDashboard() {
    console.clear();
    console.log('📊 NIXBIT PERFORMANCE MONITORING DASHBOARD');
    console.log('=' * 60);
    console.log(`Last Update: ${new Date().toLocaleString()}\n`);

    // System Health
    this.displaySystemHealth();
    
    // API Performance
    this.displayAPIPerformance();
    
    // Database Performance
    this.displayDatabasePerformance();
    
    // Cache Performance
    this.displayCachePerformance();
    
    // Recent Alerts
    this.displayRecentAlerts();
    
    // Performance Trends
    this.displayPerformanceTrends();
  }

  displaySystemHealth() {
    console.log('🔥 SYSTEM HEALTH');
    console.log('-'.repeat(40));
    
    if (this.metrics.systemHealth.status) {
      const status = this.metrics.systemHealth.status === 'healthy' ? '✅' : '❌';
      console.log(`Status: ${status} ${this.metrics.systemHealth.status.toUpperCase()}`);
      
      if (this.metrics.systemHealth.responseTime) {
        console.log(`Response Time: ${this.metrics.systemHealth.responseTime}ms`);
      }
      
      if (this.metrics.systemHealth.version) {
        console.log(`Version: ${this.metrics.systemHealth.version}`);
      }
      
      if (this.metrics.systemHealth.error) {
        console.log(`Error: ${this.metrics.systemHealth.error}`);
      }
    } else {
      console.log('No system health data available');
    }
    console.log();
  }

  displayAPIPerformance() {
    console.log('🔌 API PERFORMANCE');
    console.log('-'.repeat(40));
    
    if (this.metrics.apiPerformance.endpoints) {
      console.log(`Average Response Time: ${this.metrics.apiPerformance.averageResponseTime}ms`);
      console.log(`Error Rate: ${this.metrics.apiPerformance.errorRate}`);
      console.log(`Success/Failed: ${this.metrics.apiPerformance.successfulRequests}/${this.metrics.apiPerformance.failedRequests}`);
      
      console.log('\nEndpoint Details:');
      Object.entries(this.metrics.apiPerformance.endpoints).forEach(([name, data]) => {
        const status = data.status === 'success' ? '✅' : '❌';
        const time = data.responseTime ? `${data.responseTime}ms` : 'Failed';
        console.log(`  ${status} ${name}: ${time}`);
      });
    } else {
      console.log('No API performance data available');
    }
    console.log();
  }

  displayDatabasePerformance() {
    console.log('🗄️  DATABASE PERFORMANCE');
    console.log('-'.repeat(40));
    
    if (this.metrics.databasePerformance.queries) {
      console.log(`Average Query Time: ${this.metrics.databasePerformance.averageQueryTime}ms`);
      console.log(`Health Status: ${this.metrics.databasePerformance.healthStatus}`);
      console.log(`Success/Failed: ${this.metrics.databasePerformance.successfulQueries}/${this.metrics.databasePerformance.failedQueries}`);
      
      console.log('\nQuery Performance:');
      Object.entries(this.metrics.databasePerformance.queries).forEach(([name, data]) => {
        const status = data.status === 'success' ? '✅' : '❌';
        const time = data.responseTime ? `${data.responseTime}ms (${data.category})` : 'Failed';
        console.log(`  ${status} ${name}: ${time}`);
      });
    } else {
      console.log('No database performance data available');
    }
    console.log();
  }

  displayCachePerformance() {
    console.log('💾 CACHE PERFORMANCE');
    console.log('-'.repeat(40));
    
    if (this.metrics.cachePerformance.status) {
      const status = this.metrics.cachePerformance.status === 'effective' ? '✅' : '⚠️';
      console.log(`Status: ${status} ${this.metrics.cachePerformance.status}`);
      console.log(`Cache Efficiency: ${this.metrics.cachePerformance.cacheEfficiency}`);
      console.log(`First Request: ${this.metrics.cachePerformance.firstRequestTime}ms`);
      console.log(`Avg Subsequent: ${this.metrics.cachePerformance.averageSubsequentTime}ms`);
    } else {
      console.log('No cache performance data available');
    }
    console.log();
  }

  displayRecentAlerts() {
    console.log('🚨 RECENT ALERTS');
    console.log('-'.repeat(40));
    
    if (this.metrics.alerts.length === 0) {
      console.log('✅ No recent alerts');
    } else {
      this.metrics.alerts.slice(0, 5).forEach(alert => {
        const icon = alert.severity === 'critical' ? '🔴' : 
                    alert.severity === 'high' ? '🟠' : 
                    alert.severity === 'medium' ? '🟡' : '🔵';
        const time = new Date(alert.timestamp).toLocaleTimeString();
        console.log(`${icon} [${time}] ${alert.message}`);
      });
    }
    console.log();
  }

  displayPerformanceTrends() {
    console.log('📈 PERFORMANCE TRENDS (Last 10 measurements)');
    console.log('-'.repeat(40));
    
    if (this.metrics.trends.responseTime.length > 0) {
      const recent = this.metrics.trends.responseTime.slice(-10);
      const trend = this.calculateTrend(recent.map(d => d.value));
      const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
      
      console.log(`Response Time Trend: ${trendIcon} ${trend > 0 ? '+' : ''}${trend.toFixed(2)}ms/measurement`);
      
      const values = recent.map(d => Math.round(d.value)).join(', ');
      console.log(`Recent Values: ${values}`);
    }
    
    if (this.metrics.trends.errorRate.length > 0) {
      const recent = this.metrics.trends.errorRate.slice(-10);
      const trend = this.calculateTrend(recent.map(d => d.value));
      const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
      
      console.log(`Error Rate Trend: ${trendIcon} ${trend > 0 ? '+' : ''}${(trend * 100).toFixed(2)}%/measurement`);
    }
    
    console.log();
    console.log('Press Ctrl+C to stop monitoring...');
  }

  // Export performance report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        systemStatus: this.metrics.systemHealth.status,
        avgResponseTime: this.metrics.apiPerformance.averageResponseTime,
        errorRate: this.metrics.apiPerformance.errorRate,
        databaseHealth: this.metrics.databasePerformance.healthStatus,
        cacheEfficiency: this.metrics.cachePerformance.cacheEfficiency,
        activeAlerts: this.metrics.alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length
      },
      detailed: this.metrics
    };

    return JSON.stringify(report, null, 2);
  }
}

// Run the monitoring system
const monitor = new PerformanceMonitor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📄 Generating final performance report...');
  const report = monitor.generateReport();
  
  // Save report to file
  const fs = require('fs');
  const filename = `performance-report-${Date.now()}.json`;
  fs.writeFileSync(filename, report);
  
  console.log(`📊 Performance report saved to: ${filename}`);
  
  monitor.stop();
  process.exit(0);
});

// Start monitoring
monitor.start().catch(console.error);

export default PerformanceMonitor;