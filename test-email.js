#!/usr/bin/env node

// Test script for email functionality
// Note: Use node-fetch if Node.js < 18, otherwise use built-in fetch
const fetch = globalThis.fetch || require('node-fetch');

const EMAIL_ENDPOINT = 'https://flakytestdetector.netlify.app/.netlify/functions/email';

async function testEmail() {
  console.log('🧪 Testing Email System...\n');

  const testCases = [
    {
      name: 'Welcome Email Test',
      data: {
        to: 'test@example.com',
        template: 'welcome',
        data: {
          name: 'Test User',
          email: 'test@example.com'
        },
        provider: 'sendgrid'
      }
    },
    {
      name: 'Password Reset Test',
      data: {
        to: 'test@example.com',
        template: 'passwordReset',
        data: {
          name: 'Test User',
          resetLink: 'https://flakytestdetector.netlify.app/reset-password?token=test123'
        },
        provider: 'sendgrid'
      }
    },
    {
      name: 'Flaky Test Alert Test',
      data: {
        to: 'test@example.com',
        template: 'flakyTestAlert',
        data: {
          projectName: 'My Test Project',
          testName: 'should_handle_concurrent_users',
          failureRate: 75,
          dashboardLink: 'https://flakytestdetector.netlify.app/dashboard'
        },
        provider: 'sendgrid'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📧 Testing: ${testCase.name}`);
    
    try {
      const response = await fetch(EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${testCase.name} - SUCCESS`);
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   Provider: ${result.provider}`);
      } else {
        console.log(`❌ ${testCase.name} - FAILED`);
        console.log(`   Error: ${result.error}`);
        if (result.details) {
          console.log(`   Details:`, result.details);
        }
      }
    } catch (error) {
      console.log(`💥 ${testCase.name} - NETWORK ERROR`);
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('');
  }
}

// Test auth integration
async function testAuthWithEmail() {
  console.log('🔐 Testing Auth + Email Integration...\n');
  
  const authEndpoint = 'https://flakytestdetector.netlify.app/.netlify/functions/auth';
  
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    name: 'Integration Test User',
    password: 'testpassword123'
  };
  
  try {
    console.log('📝 Testing user registration...');
    
    const response = await fetch(`${authEndpoint}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Registration SUCCESS');
      console.log(`   User: ${result.user.email}`);
      console.log(`   Welcome email should have been sent!`);
    } else {
      console.log('❌ Registration FAILED');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('💥 Auth test NETWORK ERROR');
    console.log(`   Error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Flaky Test Detector - Email System Test Suite');
  console.log('=' * 50);
  console.log('');
  
  await testEmail();
  await testAuthWithEmail();
  
  console.log('🏁 Test Suite Complete!');
  console.log('\nNext Steps:');
  console.log('1. Check email provider configurations in Netlify environment');
  console.log('2. Verify SENDGRID_API_KEY or POSTMARK_SERVER_TOKEN is set');
  console.log('3. Test with real email address to verify delivery');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEmail, testAuthWithEmail };