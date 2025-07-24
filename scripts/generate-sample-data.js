#!/usr/bin/env node

/**
 * Sample Data Generator for Flaky Test Detector
 * 
 * This script generates realistic test data to demonstrate flaky test detection
 * and retry logic functionality. Run with: node scripts/generate-sample-data.js
 */

const crypto = require('crypto');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';
const PROJECT_ID = process.env.PROJECT_ID;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

if (!PROJECT_ID || !BEARER_TOKEN) {
  console.error('Please set PROJECT_ID and BEARER_TOKEN environment variables');
  process.exit(1);
}

// Test patterns for realistic flaky behavior
const TEST_PATTERNS = {
  stable: {
    name: 'StableTest',
    failureRate: 0.05, // 5% failure rate
    pattern: 'consistent'
  },
  intermittent: {
    name: 'IntermittentTest',
    failureRate: 0.25, // 25% failure rate
    pattern: 'random',
    errorMessages: [
      'Assertion failed: expected true but was false',
      'Test timed out after 30 seconds',
      'Null reference exception in test setup'
    ]
  },
  timingSensitive: {
    name: 'TimingSensitiveTest',
    failureRate: 0.35, // 35% failure rate
    pattern: 'timing',
    errorMessages: [
      'Timeout waiting for element to appear',
      'Race condition detected in async operation',
      'WebDriver wait timeout exceeded',
      'Animation not completed within expected time'
    ]
  },
  environmentDependent: {
    name: 'EnvironmentDependentTest',
    failureRate: 0.15, // 15% failure rate but varies by branch
    pattern: 'branch',
    errorMessages: [
      'Database connection failed',
      'External service unavailable',
      'Configuration not found for environment',
      'Network timeout connecting to test service'
    ]
  },
  highlyFlaky: {
    name: 'HighlyFlakyTest',
    failureRate: 0.6, // 60% failure rate
    pattern: 'burst',
    errorMessages: [
      'Concurrency issue detected',
      'State corruption in shared resource',
      'Memory leak causing test failure'
    ]
  }
};

const BRANCHES = ['main', 'develop', 'feature/new-ui', 'hotfix/critical-bug'];
const SUITES = ['unit', 'integration', 'e2e', 'api'];

// Generate realistic commit hash
function generateCommitHash() {
  return crypto.randomBytes(20).toString('hex');
}

// Generate test name with suite
function generateTestName(basePattern, suite, index) {
  const testTypes = {
    unit: ['Should', 'Test', 'Verify', 'Check'],
    integration: ['IT', 'Integration', 'Flow', 'Process'],
    e2e: ['E2E', 'UserJourney', 'Scenario', 'Workflow'],
    api: ['API', 'Endpoint', 'Service', 'Controller']
  };
  
  const prefix = testTypes[suite][index % testTypes[suite].length];
  return `${prefix}${basePattern.name}_${Math.floor(Math.random() * 100)}`;
}

// Determine if test should fail based on pattern
function shouldTestFail(pattern, runIndex, branch, consecutiveFailures) {
  const baseRate = pattern.failureRate;
  
  switch (pattern.pattern) {
    case 'consistent':
      return Math.random() < baseRate;
      
    case 'random':
      return Math.random() < baseRate;
      
    case 'timing':
      // Timing issues cluster together
      if (consecutiveFailures > 0) {
        return Math.random() < baseRate * 1.5; // Higher chance if already failing
      }
      return Math.random() < baseRate;
      
    case 'branch':
      // Different failure rates per branch
      const branchMultipliers = {
        'main': 0.5,
        'develop': 1.0,
        'feature/new-ui': 1.8,
        'hotfix/critical-bug': 1.2
      };
      const adjustedRate = baseRate * (branchMultipliers[branch] || 1.0);
      return Math.random() < adjustedRate;
      
    case 'burst':
      // Failures come in bursts
      if (runIndex % 10 < 6) { // 60% of time in burst mode
        return Math.random() < baseRate;
      }
      return Math.random() < baseRate * 0.1; // Much lower outside bursts
      
    default:
      return Math.random() < baseRate;
  }
}

// Generate error message
function getErrorMessage(pattern, failed) {
  if (!failed || !pattern.errorMessages) {
    return null;
  }
  
  return pattern.errorMessages[Math.floor(Math.random() * pattern.errorMessages.length)];
}

// Generate duration (in milliseconds)
function generateDuration(failed) {
  if (failed) {
    // Failed tests often take longer or timeout
    return Math.floor(Math.random() * 30000) + 5000; // 5-35 seconds
  }
  // Successful tests
  return Math.floor(Math.random() * 5000) + 100; // 100ms-5s
}

// Make API request
async function makeRequest(endpoint, method = 'GET', body = null) {
  const fetch = (await import('node-fetch')).default;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.error || response.statusText}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    throw error;
  }
}

// Generate and submit test run
async function generateTestRun(runIndex) {
  const branch = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
  const commit = generateCommitHash();
  const suite = SUITES[Math.floor(Math.random() * SUITES.length)];
  
  // Track consecutive failures for timing pattern
  const failureTracking = {};
  
  const testResults = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  
  // Generate tests for each pattern
  for (const [patternKey, pattern] of Object.entries(TEST_PATTERNS)) {
    const numTests = Math.floor(Math.random() * 5) + 2; // 2-6 tests per pattern
    
    for (let i = 0; i < numTests; i++) {
      const testName = generateTestName(pattern, suite, i);
      
      // Track consecutive failures for this test
      if (!failureTracking[testName]) {
        failureTracking[testName] = 0;
      }
      
      const failed = shouldTestFail(pattern, runIndex, branch, failureTracking[testName]);
      const skipped = Math.random() < 0.02; // 2% chance of skip
      
      let status;
      if (skipped) {
        status = 'skipped';
        skippedTests++;
        failureTracking[testName] = 0;
      } else if (failed) {
        status = 'failed';
        failedTests++;
        failureTracking[testName]++;
      } else {
        status = 'passed';
        passedTests++;
        failureTracking[testName] = 0;
      }
      
      totalTests++;
      
      testResults.push({
        testName,
        testSuite: suite,
        status,
        duration: skipped ? null : generateDuration(failed),
        errorMessage: getErrorMessage(pattern, failed),
        retryAttempt: 0,
      });
    }
  }
  
  // Create realistic timestamps
  const startedAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)); // Within last 7 days
  const completedAt = new Date(startedAt.getTime() + Math.floor(Math.random() * 30 * 60 * 1000)); // Test run took up to 30 minutes
  
  const testRunData = {
    projectId: PROJECT_ID,
    branch,
    commit,
    buildId: `build-${runIndex}`,
    buildUrl: `https://ci.example.com/builds/${runIndex}`,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    testResults,
  };
  
  console.log(`Generating test run ${runIndex}: ${branch} (${testResults.length} tests, ${failedTests} failed)`);
  
  try {
    const response = await makeRequest('/test-results', 'POST', testRunData);
    console.log(`✓ Test run ${runIndex} created successfully`);
    return response;
  } catch (error) {
    console.error(`✗ Failed to create test run ${runIndex}:`, error.message);
    throw error;
  }
}

// Generate retry attempts for failed tests
async function generateRetryAttempts() {
  console.log('\nGenerating retry attempts for recent failures...');
  
  try {
    // Get recent test runs
    const response = await makeRequest(`/test-results/${PROJECT_ID}?limit=5`);
    const testRuns = response.testRuns;
    
    for (const run of testRuns) {
      const failedTests = run.testResults.filter(t => t.status === 'failed');
      
      for (const failedTest of failedTests.slice(0, 2)) { // Retry first 2 failed tests
        if (Math.random() < 0.7) { // 70% chance of retry
          const retrySuccess = Math.random() < 0.4; // 40% retry success rate
          
          const retryResult = {
            ...failedTest,
            id: undefined, // Let API generate new ID
            status: retrySuccess ? 'passed' : 'failed',
            retryAttempt: 1,
            duration: generateDuration(!retrySuccess),
            errorMessage: retrySuccess ? null : failedTest.errorMessage,
          };
          
          // Note: In a real implementation, you'd have a specific retry endpoint
          // For demo purposes, we'll just log this
          console.log(`  Retry: ${failedTest.testName} -> ${retryResult.status}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to generate retry attempts:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting sample data generation...');
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  
  try {
    // Generate multiple test runs
    const numRuns = parseInt(process.env.NUM_RUNS) || 15;
    console.log(`\nGenerating ${numRuns} test runs...`);
    
    for (let i = 1; i <= numRuns; i++) {
      await generateTestRun(i);
      
      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✅ Successfully generated ${numRuns} test runs!`);
    
    // Generate retry attempts
    await generateRetryAttempts();
    
    console.log('\n🎯 Sample data generation complete!');
    console.log('\nNow you can:');
    console.log('1. View test results in the dashboard');
    console.log('2. Run flaky test analysis');
    console.log('3. Configure retry logic');
    console.log('4. Test webhook endpoints');
    
  } catch (error) {
    console.error('\n❌ Data generation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateTestRun,
  TEST_PATTERNS,
  makeRequest
};