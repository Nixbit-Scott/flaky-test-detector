/**
 * Nixbit Performance Benchmarking Suite
 * Measures baseline performance and identifies optimization opportunities
 */

import autocannon from 'autocannon';
import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:3001';
const API_KEY = 'benchmark-test-key';
const JWT_TOKEN = 'benchmark-jwt-token';

class NixbitBenchmark {
  constructor() {
    this.results = {
      webhookProcessing: null,
      apiEndpoints: {},
      databaseQueries: {},
      aiAnalysis: null,
      memoryUsage: [],
      cpuUsage: []
    };
  }

  async runAllBenchmarks() {
    console.log('🚀 Starting Nixbit Performance Benchmarks\n');

    try {
      // Verify server is running
      await this.verifyServer();

      // Run individual benchmarks
      await this.benchmarkWebhookProcessing();
      await this.benchmarkAPIEndpoints();
      await this.benchmarkDatabaseQueries();
      await this.benchmarkAIAnalysis();
      await this.benchmarkSystemResources();

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Benchmark failed:', error.message);
      process.exit(1);
    }
  }

  async verifyServer() {
    console.log('🔍 Verifying server status...');
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Server is running\n');
      return response.data;
    } catch (error) {
      throw new Error('Server not available for benchmarking');
    }
  }

  async benchmarkWebhookProcessing() {
    console.log('📡 Benchmarking Webhook Processing...');

    const testPayload = this.generateWebhookPayload(50); // 50 test results

    const result = await autocannon({
      url: `${BASE_URL}/api/test-results/webhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(testPayload),
      connections: 10,
      duration: 30,
      pipelining: 1
    });

    this.results.webhookProcessing = {
      requestsPerSecond: result.requests.average,
      latency: {
        average: result.latency.average,
        p50: result.latency.p50,
        p95: result.latency.p95,
        p99: result.latency.p99
      },
      throughput: result.throughput.average,
      errors: result.errors,
      timeouts: result.timeouts
    };

    console.log(`   Requests/sec: ${result.requests.average}`);
    console.log(`   Avg Latency: ${result.latency.average}ms`);
    console.log(`   95th Percentile: ${result.latency.p95}ms\n`);
  }

  async benchmarkAPIEndpoints() {
    console.log('🔌 Benchmarking API Endpoints...');

    const endpoints = [
      { path: '/api/projects', name: 'Projects List' },
      { path: '/api/flaky-tests', name: 'Flaky Tests' },
      { path: '/api/analytics/dashboard', name: 'Analytics Dashboard' },
      { path: '/api/quarantine/stats/test-project', name: 'Quarantine Stats' },
      { path: '/api/executive-dashboard/summary', name: 'Executive Summary' }
    ];

    for (const endpoint of endpoints) {
      console.log(`   Testing ${endpoint.name}...`);

      const result = await autocannon({
        url: `${BASE_URL}${endpoint.path}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`
        },
        connections: 20,
        duration: 15
      });

      this.results.apiEndpoints[endpoint.name] = {
        requestsPerSecond: result.requests.average,
        latency: {
          average: result.latency.average,
          p95: result.latency.p95
        },
        errors: result.errors
      };

      console.log(`     ${result.requests.average} req/sec, ${result.latency.p95}ms p95`);
    }
    console.log();
  }

  async benchmarkDatabaseQueries() {
    console.log('🗄️  Benchmarking Database Query Performance...');

    const queries = [
      { 
        endpoint: '/api/analytics/trends?timeRange=30d',
        name: 'Analytics Trends',
        complexity: 'medium'
      },
      {
        endpoint: '/api/flaky-tests/patterns?projectId=test-project&includeHistory=true',
        name: 'Flaky Test Patterns',
        complexity: 'high'
      },
      {
        endpoint: '/api/test-results?limit=100&includeMetadata=true',
        name: 'Test Results with Metadata',
        complexity: 'medium'
      },
      {
        endpoint: '/api/quarantine/analytics/test-project?timeRange=90d',
        name: 'Quarantine Analytics',
        complexity: 'high'
      }
    ];

    for (const query of queries) {
      console.log(`   Testing ${query.name} (${query.complexity} complexity)...`);

      const startTime = performance.now();
      
      try {
        const response = await axios.get(`${BASE_URL}${query.endpoint}`, {
          headers: { 'Authorization': `Bearer ${JWT_TOKEN}` },
          timeout: 30000
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        this.results.databaseQueries[query.name] = {
          duration,
          complexity: query.complexity,
          success: response.status === 200,
          dataSize: JSON.stringify(response.data).length
        };

        console.log(`     ${duration.toFixed(2)}ms, ${(JSON.stringify(response.data).length / 1024).toFixed(1)}KB`);

      } catch (error) {
        console.log(`     ❌ Failed: ${error.message}`);
        this.results.databaseQueries[query.name] = {
          duration: null,
          complexity: query.complexity,
          success: false,
          error: error.message
        };
      }
    }
    console.log();
  }

  async benchmarkAIAnalysis() {
    console.log('🤖 Benchmarking AI Analysis Performance...');

    const aiPayload = {
      projectId: 'ai-benchmark-project',
      testResults: this.generateComplexTestResults(100),
      analysisType: 'comprehensive',
      includeMLFeatures: true,
      generatePredictions: true
    };

    const iterations = 5;
    const durations = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      try {
        const response = await axios.post(
          `${BASE_URL}/api/flaky-tests/ai-analysis/enhanced`,
          aiPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${JWT_TOKEN}`
            },
            timeout: 60000
          }
        );

        const endTime = performance.now();
        const duration = endTime - startTime;
        durations.push(duration);

        console.log(`   Iteration ${i + 1}: ${duration.toFixed(2)}ms`);

      } catch (error) {
        console.log(`   Iteration ${i + 1}: ❌ Failed - ${error.message}`);
        durations.push(null);
      }
    }

    const validDurations = durations.filter(d => d !== null);
    if (validDurations.length > 0) {
      this.results.aiAnalysis = {
        averageDuration: validDurations.reduce((a, b) => a + b, 0) / validDurations.length,
        minDuration: Math.min(...validDurations),
        maxDuration: Math.max(...validDurations),
        successRate: validDurations.length / iterations,
        iterations: iterations
      };

      console.log(`   Average: ${this.results.aiAnalysis.averageDuration.toFixed(2)}ms`);
      console.log(`   Success Rate: ${(this.results.aiAnalysis.successRate * 100).toFixed(1)}%\n`);
    } else {
      console.log('   ❌ All AI analysis attempts failed\n');
    }
  }

  async benchmarkSystemResources() {
    console.log('💾 Monitoring System Resource Usage...');

    // This would typically integrate with system monitoring tools
    // For now, we'll simulate resource monitoring during load
    console.log('   Running load test while monitoring resources...');

    const loadTest = autocannon({
      url: `${BASE_URL}/api/analytics/dashboard`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` },
      connections: 30,
      duration: 20
    });

    // Simulate resource monitoring (in production, use actual system metrics)
    const resourceMonitoring = setInterval(() => {
      // Placeholder for actual memory/CPU monitoring
      this.results.memoryUsage.push({
        timestamp: Date.now(),
        heapUsed: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
        external: process.memoryUsage().external / 1024 / 1024
      });
    }, 1000);

    await loadTest;
    clearInterval(resourceMonitoring);

    console.log(`   Monitored for ${this.results.memoryUsage.length} seconds`);
    console.log(`   Peak heap usage: ${Math.max(...this.results.memoryUsage.map(m => m.heapUsed)).toFixed(2)}MB\n`);
  }

  generateWebhookPayload(numTests = 50) {
    const testResults = [];
    
    for (let i = 0; i < numTests; i++) {
      testResults.push({
        testName: `benchmark_test_${i}`,
        testSuite: `benchmark_suite_${Math.floor(i / 10)}`,
        status: Math.random() > 0.2 ? 'passed' : 'failed',
        duration: Math.floor(Math.random() * 5000) + 100,
        branch: 'benchmark-branch',
        commitSha: `commit${i}`,
        timestamp: new Date().toISOString(),
        environment: 'benchmark',
        metadata: {
          runner: 'benchmark-runner',
          testId: i
        }
      });
    }

    return {
      projectId: 'benchmark-project',
      runId: `benchmark-run-${Date.now()}`,
      testResults,
      metadata: {
        totalTests: numTests,
        benchmarkRun: true
      }
    };
  }

  generateComplexTestResults(count) {
    return Array.from({ length: count }, (_, i) => ({
      testName: `complex_test_${i}`,
      testSuite: `complex_suite_${Math.floor(i / 20)}`,
      status: Math.random() > 0.3 ? 'passed' : 'failed',
      duration: Math.floor(Math.random() * 10000) + 500,
      branch: Math.random() > 0.5 ? 'main' : `feature/branch-${i % 5}`,
      commitSha: `commit-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      environment: 'ai-benchmark',
      errorMessage: Math.random() > 0.7 ? `AI test error ${i}` : null,
      stackTrace: Math.random() > 0.8 ? `Stack trace for test ${i}` : null,
      metadata: {
        complexity: Math.random() > 0.5 ? 'high' : 'medium',
        tags: [`tag${i % 10}`, `category${i % 5}`],
        flaky: Math.random() > 0.8
      }
    }));
  }

  generateReport() {
    console.log('📊 NIXBIT PERFORMANCE BENCHMARK REPORT');
    console.log('=' * 50);
    
    // Webhook Processing
    if (this.results.webhookProcessing) {
      console.log('\n🔸 WEBHOOK PROCESSING PERFORMANCE');
      const wp = this.results.webhookProcessing;
      console.log(`   Requests per second: ${wp.requestsPerSecond.toFixed(2)}`);
      console.log(`   Average latency: ${wp.latency.average.toFixed(2)}ms`);
      console.log(`   95th percentile: ${wp.latency.p95.toFixed(2)}ms`);
      console.log(`   99th percentile: ${wp.latency.p99.toFixed(2)}ms`);
      console.log(`   Throughput: ${(wp.throughput / 1024 / 1024).toFixed(2)} MB/s`);
      
      // Performance assessment
      if (wp.requestsPerSecond > 100 && wp.latency.p95 < 1000) {
        console.log('   ✅ EXCELLENT webhook performance');
      } else if (wp.requestsPerSecond > 50 && wp.latency.p95 < 2000) {
        console.log('   ⚠️  GOOD webhook performance, minor optimization possible');
      } else {
        console.log('   ❌ POOR webhook performance, optimization needed');
      }
    }

    // API Endpoints
    console.log('\n🔸 API ENDPOINT PERFORMANCE');
    Object.entries(this.results.apiEndpoints).forEach(([name, data]) => {
      console.log(`   ${name}: ${data.requestsPerSecond.toFixed(2)} req/s, ${data.latency.p95.toFixed(2)}ms p95`);
    });

    // Database Queries
    console.log('\n🔸 DATABASE QUERY PERFORMANCE');
    Object.entries(this.results.databaseQueries).forEach(([name, data]) => {
      if (data.success) {
        console.log(`   ${name}: ${data.duration.toFixed(2)}ms, ${(data.dataSize / 1024).toFixed(1)}KB`);
      } else {
        console.log(`   ${name}: ❌ Failed`);
      }
    });

    // AI Analysis
    if (this.results.aiAnalysis) {
      console.log('\n🔸 AI ANALYSIS PERFORMANCE');
      const ai = this.results.aiAnalysis;
      console.log(`   Average duration: ${ai.averageDuration.toFixed(2)}ms`);
      console.log(`   Success rate: ${(ai.successRate * 100).toFixed(1)}%`);
      console.log(`   Min/Max: ${ai.minDuration.toFixed(2)}ms / ${ai.maxDuration.toFixed(2)}ms`);
    }

    // System Resources
    if (this.results.memoryUsage.length > 0) {
      console.log('\n🔸 SYSTEM RESOURCE USAGE');
      const maxHeap = Math.max(...this.results.memoryUsage.map(m => m.heapUsed));
      const avgHeap = this.results.memoryUsage.reduce((a, m) => a + m.heapUsed, 0) / this.results.memoryUsage.length;
      console.log(`   Peak heap usage: ${maxHeap.toFixed(2)} MB`);
      console.log(`   Average heap usage: ${avgHeap.toFixed(2)} MB`);
    }

    // Recommendations
    console.log('\n🔸 PERFORMANCE RECOMMENDATIONS');
    this.generateRecommendations();

    console.log('\n🏁 Benchmark Complete!');
  }

  generateRecommendations() {
    const recommendations = [];

    // Webhook performance recommendations
    if (this.results.webhookProcessing) {
      const wp = this.results.webhookProcessing;
      if (wp.latency.p95 > 2000) {
        recommendations.push('• Optimize webhook processing - consider async processing');
      }
      if (wp.requestsPerSecond < 50) {
        recommendations.push('• Scale webhook processing capacity - add more workers');
      }
    }

    // Database recommendations
    const dbQueries = Object.values(this.results.databaseQueries);
    const slowQueries = dbQueries.filter(q => q.success && q.duration > 5000);
    if (slowQueries.length > 0) {
      recommendations.push('• Optimize slow database queries - add indexes and query optimization');
    }

    // AI analysis recommendations
    if (this.results.aiAnalysis && this.results.aiAnalysis.averageDuration > 30000) {
      recommendations.push('• Optimize AI analysis - consider caching and model optimization');
    }

    // General recommendations
    recommendations.push('• Implement Redis caching for frequently accessed data');
    recommendations.push('• Consider database read replicas for analytics queries');
    recommendations.push('• Monitor and alert on performance metrics in production');

    if (recommendations.length === 0) {
      console.log('   🎉 Performance looks good! Continue monitoring in production.');
    } else {
      recommendations.forEach(rec => console.log(`   ${rec}`));
    }
  }
}

// Run benchmarks
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new NixbitBenchmark();
  benchmark.runAllBenchmarks().catch(console.error);
}

export default NixbitBenchmark;