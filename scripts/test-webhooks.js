#!/usr/bin/env node

/**
 * Webhook Testing Script for Flaky Test Detector
 * 
 * This script simulates real CI/CD webhook payloads from GitHub Actions, 
 * GitLab CI, and Jenkins to test the webhook processing functionality.
 */

const crypto = require('crypto');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhooks';
const PROJECT_REPO = process.env.PROJECT_REPO || 'example-org/example-repo';

// Sample test data for different CI/CD systems
const SAMPLE_TESTS = [
  { name: 'test_user_authentication', suite: 'auth', type: 'unit' },
  { name: 'test_api_endpoints', suite: 'api', type: 'integration' },
  { name: 'test_database_connection', suite: 'db', type: 'integration' },
  { name: 'test_payment_flow', suite: 'payments', type: 'e2e' },
  { name: 'test_email_notifications', suite: 'notifications', type: 'unit' },
  { name: 'test_file_upload', suite: 'storage', type: 'integration' },
  { name: 'test_user_registration', suite: 'auth', type: 'e2e' },
  { name: 'test_data_validation', suite: 'validation', type: 'unit' },
];

// Generate realistic commit data
function generateCommitData() {
  return {
    sha: crypto.randomBytes(20).toString('hex'),
    author: {
      name: ['John Doe', 'Jane Smith', 'Alex Johnson', 'Sarah Wilson'][Math.floor(Math.random() * 4)],
      email: 'developer@example.com'
    },
    message: [
      'Fix authentication bug',
      'Add new payment integration',
      'Update user interface',
      'Improve test coverage',
      'Refactor database queries',
      'Fix flaky test issues'
    ][Math.floor(Math.random() * 6)]
  };
}

// Generate test results with some flaky patterns
function generateTestResults(numTests = 8) {
  const results = [];
  const selectedTests = SAMPLE_TESTS.slice(0, numTests);
  
  for (const test of selectedTests) {
    // Simulate flaky behavior for certain tests
    let status = 'passed';
    let errorMessage = null;
    let duration = Math.floor(Math.random() * 5000) + 100; // 100ms to 5s
    
    // Make certain tests flaky
    if (test.name.includes('payment') && Math.random() < 0.3) {
      status = 'failed';
      errorMessage = 'Timeout waiting for payment gateway response';
      duration = 30000; // Timeout duration
    } else if (test.name.includes('file_upload') && Math.random() < 0.25) {
      status = 'failed';
      errorMessage = 'Network connection failed during upload';
      duration = 15000;
    } else if (test.name.includes('email') && Math.random() < 0.2) {
      status = 'failed';
      errorMessage = 'SMTP server connection timeout';
      duration = 10000;
    } else if (Math.random() < 0.05) {
      status = 'failed';
      errorMessage = 'Unexpected assertion failure';
      duration = Math.floor(Math.random() * 2000) + 500;
    } else if (Math.random() < 0.02) {
      status = 'skipped';
      errorMessage = null;
      duration = null;
    }
    
    results.push({
      name: test.name,
      suite: test.suite,
      status,
      duration,
      errorMessage,
      retryAttempt: 0
    });
  }
  
  return results;
}

// GitHub Actions webhook payload
function generateGitHubPayload() {
  const commit = generateCommitData();
  const testResults = generateTestResults();
  const branch = ['main', 'develop', 'feature/new-feature'][Math.floor(Math.random() * 3)];
  
  const passed = testResults.filter(t => t.status === 'passed').length;
  const failed = testResults.filter(t => t.status === 'failed').length;
  const skipped = testResults.filter(t => t.status === 'skipped').length;
  
  return {
    action: 'completed',
    workflow_run: {
      id: Math.floor(Math.random() * 100000),
      name: 'CI/CD Pipeline',
      status: 'completed',
      conclusion: failed > 0 ? 'failure' : 'success',
      html_url: `https://github.com/${PROJECT_REPO}/actions/runs/${Math.floor(Math.random() * 100000)}`,
      head_branch: branch,
      head_sha: commit.sha,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 60 * 60 * 1000)).toISOString(),
      updated_at: new Date().toISOString(),
    },
    repository: {
      full_name: PROJECT_REPO,
      html_url: `https://github.com/${PROJECT_REPO}`
    },
    // Custom test results (this would typically come from a separate API call)
    test_results: {
      total: testResults.length,
      passed,
      failed,
      skipped,
      tests: testResults.map(test => ({
        name: test.name,
        classname: test.suite,
        status: test.status,
        time: test.duration ? test.duration / 1000 : null,
        failure: test.errorMessage ? { message: test.errorMessage } : null
      }))
    }
  };
}

// GitLab CI webhook payload
function generateGitLabPayload() {
  const commit = generateCommitData();
  const testResults = generateTestResults();
  const branch = ['main', 'develop', 'feature/new-feature'][Math.floor(Math.random() * 3)];
  
  const failed = testResults.filter(t => t.status === 'failed').length;
  
  return {
    object_kind: 'pipeline',
    object_attributes: {
      id: Math.floor(Math.random() * 100000),
      ref: branch,
      sha: commit.sha,
      status: failed > 0 ? 'failed' : 'success',
      created_at: new Date(Date.now() - Math.floor(Math.random() * 60 * 60 * 1000)).toISOString(),
      finished_at: new Date().toISOString(),
      web_url: `https://gitlab.example.com/${PROJECT_REPO}/-/pipelines/${Math.floor(Math.random() * 100000)}`
    },
    project: {
      name: PROJECT_REPO.split('/')[1],
      path_with_namespace: PROJECT_REPO,
      web_url: `https://gitlab.example.com/${PROJECT_REPO}`
    },
    commit: {
      id: commit.sha,
      message: commit.message,
      author: commit.author
    },
    builds: [{
      id: Math.floor(Math.random() * 100000),
      stage: 'test',
      name: 'test:unit',
      status: failed > 0 ? 'failed' : 'success',
      created_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 60 * 1000)).toISOString(),
      finished_at: new Date().toISOString(),
      web_url: `https://gitlab.example.com/${PROJECT_REPO}/-/jobs/${Math.floor(Math.random() * 100000)}`
    }],
    // Custom test results
    test_results: testResults
  };
}

// Jenkins webhook payload
function generateJenkinsPayload() {
  const commit = generateCommitData();
  const testResults = generateTestResults();
  const branch = ['main', 'develop', 'feature/new-feature'][Math.floor(Math.random() * 3)];
  
  const failed = testResults.filter(t => t.status === 'failed').length;
  const buildNumber = Math.floor(Math.random() * 1000) + 1;
  
  return {
    name: 'test-pipeline',
    url: `https://jenkins.example.com/job/test-pipeline/${buildNumber}/`,
    build: {
      full_url: `https://jenkins.example.com/job/test-pipeline/${buildNumber}/`,
      number: buildNumber,
      phase: 'FINISHED',
      status: failed > 0 ? 'FAILURE' : 'SUCCESS',
      url: `job/test-pipeline/${buildNumber}/`,
      scm: {
        url: `https://github.com/${PROJECT_REPO}.git`,
        branch: `origin/${branch}`,
        commit: commit.sha
      },
      artifacts: {}
    },
    // Jenkins-style test results
    testResults: {
      totalCount: testResults.length,
      failCount: failed,
      skipCount: testResults.filter(t => t.status === 'skipped').length,
      suites: [{
        cases: testResults.map(test => ({
          className: test.suite,
          name: test.name,
          status: test.status.toUpperCase(),
          duration: test.duration || 0,
          errorDetails: test.errorMessage,
          errorStackTrace: test.errorMessage ? `Error: ${test.errorMessage}\n    at test (test.js:1:1)` : null
        }))
      }]
    }
  };
}

// Send webhook request
async function sendWebhook(payload, ciSystem) {
  const fetch = (await import('node-fetch')).default;
  
  // Different CI systems use different endpoints and headers
  const endpoints = {
    github: '/github',
    gitlab: '/gitlab',
    jenkins: '/jenkins'
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': `${ciSystem}-webhook-test`
  };
  
  // Add CI-specific headers
  switch (ciSystem) {
    case 'github':
      headers['X-GitHub-Event'] = 'workflow_run';
      headers['X-GitHub-Delivery'] = crypto.randomUUID();
      break;
    case 'gitlab':
      headers['X-Gitlab-Event'] = 'Pipeline Hook';
      headers['X-Gitlab-Token'] = 'test-token';
      break;
    case 'jenkins':
      headers['X-Jenkins-Event'] = 'build';
      break;
  }
  
  try {
    console.log(`📤 Sending ${ciSystem} webhook...`);
    
    const response = await fetch(`${WEBHOOK_URL}${endpoints[ciSystem]}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    const responseData = await response.text();
    
    if (response.ok) {
      console.log(`✅ ${ciSystem} webhook processed successfully`);
      return { success: true, data: responseData };
    } else {
      console.error(`❌ ${ciSystem} webhook failed: ${response.status} ${response.statusText}`);
      console.error('Response:', responseData);
      return { success: false, error: responseData };
    }
  } catch (error) {
    console.error(`❌ ${ciSystem} webhook request failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// Test different webhook scenarios
async function testWebhookScenarios() {
  console.log('🧪 Testing different webhook scenarios...\n');
  
  const scenarios = [
    {
      name: 'GitHub Actions - Successful Build',
      generator: generateGitHubPayload,
      ciSystem: 'github'
    },
    {
      name: 'GitLab CI - Build with Failures',
      generator: generateGitLabPayload,
      ciSystem: 'gitlab'
    },
    {
      name: 'Jenkins - Mixed Results',
      generator: generateJenkinsPayload,
      ciSystem: 'jenkins'
    }
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n🔄 Testing: ${scenario.name}`);
    
    const payload = scenario.generator();
    const result = await sendWebhook(payload, scenario.ciSystem);
    
    results.push({
      scenario: scenario.name,
      success: result.success,
      error: result.error
    });
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

// Generate continuous webhook stream
async function generateContinuousWebhooks(durationMinutes = 5) {
  console.log(`🔄 Generating continuous webhooks for ${durationMinutes} minutes...\n`);
  
  const endTime = Date.now() + (durationMinutes * 60 * 1000);
  const ciSystems = ['github', 'gitlab', 'jenkins'];
  const generators = {
    github: generateGitHubPayload,
    gitlab: generateGitLabPayload,
    jenkins: generateJenkinsPayload
  };
  
  let webhookCount = 0;
  
  while (Date.now() < endTime) {
    const ciSystem = ciSystems[Math.floor(Math.random() * ciSystems.length)];
    const payload = generators[ciSystem]();
    
    await sendWebhook(payload, ciSystem);
    webhookCount++;
    
    // Random delay between 5-30 seconds
    const delay = Math.floor(Math.random() * 25000) + 5000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log(`\n✅ Generated ${webhookCount} webhooks over ${durationMinutes} minutes`);
}

// Main execution
async function main() {
  console.log('🚀 Starting webhook testing...');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Project Repository: ${PROJECT_REPO}\n`);
  
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'scenarios':
        const results = await testWebhookScenarios();
        console.log('\n📊 Test Results Summary:');
        results.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`  ${status} ${result.scenario}`);
          if (result.error) {
            console.log(`      Error: ${result.error}`);
          }
        });
        break;
        
      case 'continuous':
        const duration = parseInt(process.argv[3]) || 5;
        await generateContinuousWebhooks(duration);
        break;
        
      case 'single':
        const ciSystem = process.argv[3] || 'github';
        const generators = {
          github: generateGitHubPayload,
          gitlab: generateGitLabPayload,
          jenkins: generateJenkinsPayload
        };
        
        if (!generators[ciSystem]) {
          console.error(`❌ Unknown CI system: ${ciSystem}`);
          console.log('Available: github, gitlab, jenkins');
          process.exit(1);
        }
        
        const payload = generators[ciSystem]();
        await sendWebhook(payload, ciSystem);
        break;
        
      default:
        console.log('Usage:');
        console.log('  node test-webhooks.js scenarios           # Test all webhook scenarios');
        console.log('  node test-webhooks.js continuous [mins]   # Generate continuous webhooks');
        console.log('  node test-webhooks.js single [ci-system]  # Send single webhook');
        console.log('');
        console.log('CI Systems: github, gitlab, jenkins');
        break;
    }
  } catch (error) {
    console.error('\n❌ Webhook testing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateGitHubPayload,
  generateGitLabPayload,
  generateJenkinsPayload,
  sendWebhook
};