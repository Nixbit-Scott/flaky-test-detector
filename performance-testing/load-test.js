/**
 * Performance Load Testing Suite for Nixbit
 * Tests high-volume webhook processing, API endpoints, and database performance
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const webhookProcessingRate = new Rate('webhook_processing_success');
const apiResponseTime = new Trend('api_response_time');
const dbQueryTime = new Trend('db_query_time');
const errorCounter = new Counter('errors');

// Test configuration
export const options = {
  scenarios: {
    // Webhook load testing - simulate CI/CD systems sending webhooks
    webhook_load: {
      executor: 'ramping-vus',
      exec: 'webhookLoadTest',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 10 },   // Ramp up to 10 VUs
        { duration: '5m', target: 50 },   // Ramp up to 50 VUs (high load)
        { duration: '5m', target: 100 },  // Peak load - 100 concurrent webhooks
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },
    
    // API endpoint testing - dashboard and analytics
    api_load: {
      executor: 'constant-vus',
      exec: 'apiLoadTest',
      vus: 20,
      duration: '10m',
      startTime: '1m', // Start after webhook test begins
    },
    
    // Database stress testing
    database_stress: {
      executor: 'ramping-vus',
      exec: 'databaseStressTest',
      startVUs: 1,
      stages: [
        { duration: '3m', target: 5 },
        { duration: '5m', target: 15 },
        { duration: '2m', target: 0 },
      ],
      startTime: '2m',
    }
  },
  
  thresholds: {
    // Performance requirements
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'],     // Less than 10% failures
    webhook_processing_success: ['rate>0.9'], // 90% webhook success
    api_response_time: ['p(95)<1000'], // API responses under 1s
    errors: ['count<100'],             // Less than 100 errors total
  },
};

// Test data generators
function generateTestResult() {
  return {
    testName: `test_${Math.random().toString(36).substr(2, 9)}`,
    testSuite: `suite_${Math.random().toString(36).substr(2, 5)}`,
    status: Math.random() > 0.15 ? 'passed' : 'failed', // 15% failure rate
    duration: Math.floor(Math.random() * 10000) + 100,
    branch: Math.random() > 0.5 ? 'main' : 'feature/test-branch',
    commitSha: Math.random().toString(36).substr(2, 10),
    timestamp: new Date().toISOString(),
    environment: 'ci',
    metadata: {
      runner: 'github-actions',
      nodeVersion: '18.x',
      os: 'ubuntu-latest'
    }
  };
}

function generateWebhookPayload() {
  const testResults = [];
  const numTests = Math.floor(Math.random() * 50) + 10; // 10-60 tests per run
  
  for (let i = 0; i < numTests; i++) {
    testResults.push(generateTestResult());
  }
  
  return {
    projectId: 'test-project-' + Math.floor(Math.random() * 5), // 5 test projects
    runId: Math.random().toString(36).substr(2, 12),
    testResults,
    metadata: {
      totalTests: numTests,
      passedTests: testResults.filter(t => t.status === 'passed').length,
      failedTests: testResults.filter(t => t.status === 'failed').length,
      startTime: new Date(Date.now() - Math.random() * 600000).toISOString(),
      endTime: new Date().toISOString()
    }
  };
}

// Test scenarios
export function webhookLoadTest() {
  const payload = generateWebhookPayload();
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-api-key', // Should be configured for testing
    },
  };
  
  const response = http.post(
    'http://localhost:3001/api/test-results/webhook',
    JSON.stringify(payload),
    params
  );
  
  const success = check(response, {
    'webhook processed successfully': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 5000,
  });
  
  webhookProcessingRate.add(success);
  if (!success) {
    errorCounter.add(1);
  }
  
  sleep(Math.random() * 2); // Random delay between 0-2s
}

export function apiLoadTest() {
  const endpoints = [
    '/api/analytics/dashboard',
    '/api/flaky-tests',
    '/api/projects',
    '/api/quarantine/stats/test-project-1',
    '/api/executive-dashboard/summary'
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const params = {
    headers: {
      'Authorization': 'Bearer test-jwt-token', // Should be configured
    },
  };
  
  const start = Date.now();
  const response = http.get(`http://localhost:3001${endpoint}`, params);
  const duration = Date.now() - start;
  
  apiResponseTime.add(duration);
  
  check(response, {
    'API request successful': (r) => r.status === 200,
    'API response time under 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}

export function databaseStressTest() {
  // Test analytics queries that are heavy on the database
  const heavyEndpoints = [
    '/api/analytics/trends?timeRange=90d',
    '/api/flaky-tests/patterns?projectId=test-project-1',
    '/api/quarantine/analytics/test-project-1?timeRange=90d',
    '/api/executive-dashboard/detailed-metrics'
  ];
  
  const endpoint = heavyEndpoints[Math.floor(Math.random() * heavyEndpoints.length)];
  const params = {
    headers: {
      'Authorization': 'Bearer test-jwt-token',
    },
  };
  
  const start = Date.now();
  const response = http.get(`http://localhost:3001${endpoint}`, params);
  const duration = Date.now() - start;
  
  dbQueryTime.add(duration);
  
  check(response, {
    'DB query successful': (r) => r.status === 200,
    'DB query time acceptable': (r) => r.timings.duration < 5000,
  });
  
  if (response.status !== 200) {
    errorCounter.add(1);
  }
  
  sleep(Math.random() * 3);
}

// Setup and teardown
export function setup() {
  console.log('🚀 Starting Nixbit Performance Tests');
  console.log('Testing webhook processing, API performance, and database stress');
  
  // Verify server is running
  const healthResponse = http.get('http://localhost:3001/health');
  if (healthResponse.status !== 200) {
    throw new Error('Server not available for testing');
  }
  
  return { serverReady: true };
}

export function teardown(data) {
  console.log('📊 Performance Testing Complete');
  console.log('Check the results for performance metrics and recommendations');
}