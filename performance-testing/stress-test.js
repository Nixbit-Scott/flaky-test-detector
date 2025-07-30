/**
 * Stress Testing Suite for Nixbit Critical Paths
 * Focuses on breaking points and edge cases
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Stress test metrics
const systemStabilityRate = new Rate('system_stability');
const memoryUsageTrend = new Trend('memory_usage_mb');
const cpuUsageTrend = new Trend('cpu_usage_percent');
const criticalErrorCounter = new Counter('critical_errors');

export const options = {
  scenarios: {
    // Webhook flood - simulate CI system sending massive batches
    webhook_flood: {
      executor: 'ramping-arrival-rate',
      exec: 'webhookFloodTest',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '2m', target: 50 },   // 50 webhooks/sec
        { duration: '3m', target: 100 },  // 100 webhooks/sec
        { duration: '2m', target: 200 },  // 200 webhooks/sec (stress point)
        { duration: '1m', target: 0 },
      ],
    },
    
    // Large dataset processing
    large_dataset_processing: {
      executor: 'ramping-vus',
      exec: 'largeDatasetTest',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 5 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      startTime: '30s',
    },
    
    // AI analysis under load
    ai_analysis_stress: {
      executor: 'constant-vus',
      exec: 'aiAnalysisStressTest',
      vus: 15,
      duration: '5m',
      startTime: '1m',
    },
    
    // Database connection exhaustion
    database_connection_stress: {
      executor: 'ramping-vus',
      exec: 'databaseConnectionTest',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      startTime: '2m',
    }
  },
  
  thresholds: {
    http_req_duration: ['p(99)<10000'], // 99% under 10s (stress conditions)
    http_req_failed: ['rate<0.2'],      // Allow 20% failures under stress
    system_stability: ['rate>0.8'],     // 80% system stability
    critical_errors: ['count<50'],      // Less than 50 critical errors
  },
};

// Stress test data generators
function generateLargeWebhookPayload() {
  const testResults = [];
  const numTests = Math.floor(Math.random() * 500) + 200; // 200-700 tests
  
  for (let i = 0; i < numTests; i++) {
    testResults.push({
      testName: `stress_test_${i}_${Math.random().toString(36).substr(2, 15)}`,
      testSuite: `large_suite_${Math.floor(i / 50)}`,
      status: Math.random() > 0.3 ? 'passed' : 'failed', // 30% failure rate
      duration: Math.floor(Math.random() * 30000) + 500,
      branch: Math.random() > 0.5 ? 'main' : `feature/stress-${Math.floor(Math.random() * 10)}`,
      commitSha: Math.random().toString(36).substr(2, 10),
      timestamp: new Date().toISOString(),
      environment: 'stress-test',
      errorMessage: Math.random() > 0.7 ? `Error ${i}: ${Math.random().toString(36)}` : null,
      stackTrace: Math.random() > 0.8 ? generateStackTrace() : null,
      metadata: {
        runner: 'stress-test-runner',
        nodeVersion: '18.x',
        os: 'ubuntu-latest',
        tags: generateRandomTags(),
        annotations: generateAnnotations()
      }
    });
  }
  
  return {
    projectId: `stress-project-${Math.floor(Math.random() * 3)}`,
    runId: `stress-run-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
    testResults,
    metadata: {
      totalTests: numTests,
      passedTests: testResults.filter(t => t.status === 'passed').length,
      failedTests: testResults.filter(t => t.status === 'failed').length,
      startTime: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      endTime: new Date().toISOString(),
      stressTestLevel: 'high',
      expectedLoad: 'extreme'
    }
  };
}

function generateStackTrace() {
  const traces = [
    'at Object.<anonymous> (/app/test.js:15:23)\\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)',
    'at processImmediate (internal/timers.js:462:26)\\n    at runTest (/app/runner.js:45:12)',
    'at async Promise.all (index 0)\\n    at async testSuite (/app/suite.js:89:5)'
  ];
  return traces[Math.floor(Math.random() * traces.length)];
}

function generateRandomTags() {
  const tags = ['unit', 'integration', 'e2e', 'smoke', 'regression', 'performance'];
  return tags.filter(() => Math.random() > 0.5);
}

function generateAnnotations() {
  return {
    flaky: Math.random() > 0.8,
    critical: Math.random() > 0.9,
    slow: Math.random() > 0.7,
    intermittent: Math.random() > 0.85
  };
}

// Stress test scenarios
export function webhookFloodTest() {
  const payload = generateLargeWebhookPayload();
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'stress-test-api-key',
      'X-Stress-Test': 'true',
    },
    timeout: '30s', // Allow longer timeouts under stress
  };
  
  const response = http.post(
    'http://localhost:3001/api/test-results/webhook',
    JSON.stringify(payload),
    params
  );
  
  const stable = check(response, {
    'system handles flood': (r) => r.status < 500, // Allow 4xx but not 5xx
    'response within timeout': (r) => r.timings.duration < 30000,
  });
  
  systemStabilityRate.add(stable);
  
  if (response.status >= 500) {
    criticalErrorCounter.add(1);
  }
  
  // No sleep - flood scenario
}

export function largeDatasetTest() {
  // Simulate processing of large historical datasets
  const params = {
    headers: {
      'Authorization': 'Bearer stress-test-token',
      'X-Stress-Test': 'true',
    },
    timeout: '60s',
  };
  
  const endpoints = [
    '/api/analytics/trends?timeRange=365d&includeDetails=true',
    '/api/flaky-tests/patterns?projectId=stress-project-1&includeHistory=true&limit=1000',
    '/api/executive-dashboard/detailed-metrics?timeRange=365d',
    '/api/quarantine/analytics/stress-project-1?timeRange=365d&includeTimeSeries=true'
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const response = http.get(`http://localhost:3001${endpoint}`, params);
  
  check(response, {
    'large dataset processed': (r) => r.status === 200 || r.status === 206, // Allow partial content
    'processing time reasonable': (r) => r.timings.duration < 60000,
  });
  
  sleep(Math.random() * 5);
}

export function aiAnalysisStressTest() {
  // Stress test AI analysis with complex patterns
  const complexPayload = {
    projectId: `ai-stress-project-${Math.floor(Math.random() * 2)}`,
    testResults: Array.from({ length: 100 }, (_, i) => ({
      testName: `ai_complex_test_${i}`,
      testSuite: `ai_suite_${Math.floor(i / 10)}`,
      status: Math.random() > 0.4 ? 'passed' : 'failed',
      duration: Math.floor(Math.random() * 15000) + 1000,
      patterns: generateComplexPatterns(),
      historicalData: generateHistoricalData()
    })),
    analysisDepth: 'comprehensive',
    includeMLFeatures: true,
    generatePredictions: true
  };
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer stress-test-token',
      'X-AI-Stress-Test': 'true',
    },
    timeout: '45s',
  };
  
  const response = http.post(
    'http://localhost:3001/api/flaky-tests/ai-analysis/enhanced',
    JSON.stringify(complexPayload),
    params
  );
  
  check(response, {
    'AI analysis completes': (r) => r.status === 200,
    'AI processing time acceptable': (r) => r.timings.duration < 45000,
  });
  
  sleep(2);
}

export function databaseConnectionTest() {
  // Test database connection limits with concurrent queries
  const queries = [
    '/api/analytics/dashboard',
    '/api/flaky-tests?limit=100',
    '/api/projects',
    '/api/test-results?limit=200',
    '/api/quarantine/stats/stress-project-1'
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  const params = {
    headers: {
      'Authorization': 'Bearer stress-test-token',
      'X-DB-Stress-Test': 'true',
    },
    timeout: '20s',
  };
  
  const response = http.get(`http://localhost:3001${query}`, params);
  
  const connectionSuccessful = check(response, {
    'database connection available': (r) => r.status !== 503,
    'query executes': (r) => r.status === 200 || r.status === 429, // Allow rate limiting
  });
  
  if (!connectionSuccessful) {
    criticalErrorCounter.add(1);
  }
  
  sleep(0.1); // Minimal sleep for connection stress
}

function generateComplexPatterns() {
  return {
    timePatterns: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      failureRate: Math.random()
    })),
    branchPatterns: ['main', 'develop', 'feature/*'].map(branch => ({
      branch,
      failureRate: Math.random(),
      frequency: Math.floor(Math.random() * 100)
    })),
    environmentPatterns: ['production', 'staging', 'ci'].map(env => ({
      environment: env,
      successRate: Math.random(),
      avgDuration: Math.floor(Math.random() * 10000)
    }))
  };
}

function generateHistoricalData() {
  return Array.from({ length: 90 }, (_, day) => ({
    date: new Date(Date.now() - day * 24 * 60 * 60 * 1000).toISOString(),
    runs: Math.floor(Math.random() * 50) + 10,
    failures: Math.floor(Math.random() * 15),
    avgDuration: Math.floor(Math.random() * 5000) + 1000
  }));
}

export function setup() {
  console.log('🔥 Starting Nixbit Stress Tests');
  console.log('Testing system limits and breaking points...');
  
  // Verify server can handle stress testing
  const response = http.get('http://localhost:3001/health');
  if (response.status !== 200) {
    throw new Error('Server not ready for stress testing');
  }
  
  console.log('⚠️  Warning: This test will push the system to its limits');
  return { stressTestReady: true };
}

export function teardown(data) {
  console.log('🏁 Stress Testing Complete');
  console.log('📊 Review metrics to identify system bottlenecks and limits');
  console.log('🔧 Use results to plan infrastructure scaling and optimizations');
}