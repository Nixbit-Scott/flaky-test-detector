#!/usr/bin/env node

// SendGrid integration test script
const fetch = globalThis.fetch || require('node-fetch');

const NETLIFY_URL = 'https://flakytestdetector.netlify.app';

async function testSendGridIntegration() {
  console.log('🧪 Testing SendGrid Email Integration...\n');

  // Test 1: Welcome Email
  console.log('📧 Test 1: Welcome Email');
  try {
    const response = await fetch(`${NETLIFY_URL}/.netlify/functions/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'your-email@example.com', // 🔥 REPLACE WITH YOUR ACTUAL EMAIL
        template: 'welcome',
        data: {
          name: 'Test User',
          email: 'your-email@example.com'
        },
        provider: 'sendgrid'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Welcome email - SUCCESS');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Provider: ${result.provider}`);
    } else {
      console.log('❌ Welcome email - FAILED');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('💥 Welcome email - NETWORK ERROR');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test 2: Password Reset Email
  console.log('📧 Test 2: Password Reset Email');
  try {
    const response = await fetch(`${NETLIFY_URL}/.netlify/functions/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'your-email@example.com', // 🔥 REPLACE WITH YOUR ACTUAL EMAIL
        template: 'passwordReset',
        data: {
          name: 'Test User',
          resetLink: `${NETLIFY_URL}/reset-password?token=test123456`
        },
        provider: 'sendgrid'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Password reset email - SUCCESS');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ Password reset email - FAILED');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('💥 Password reset email - NETWORK ERROR');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test 3: Flaky Test Alert
  console.log('📧 Test 3: Flaky Test Alert');
  try {
    const response = await fetch(`${NETLIFY_URL}/.netlify/functions/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'your-email@example.com', // 🔥 REPLACE WITH YOUR ACTUAL EMAIL
        template: 'flakyTestAlert',
        data: {
          projectName: 'My Demo Project',
          testName: 'should_handle_concurrent_users',
          failureRate: 85,
          dashboardLink: `${NETLIFY_URL}/app/dashboard`
        },
        provider: 'sendgrid'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Flaky test alert - SUCCESS');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ Flaky test alert - FAILED');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('💥 Flaky test alert - NETWORK ERROR');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');
}

async function testAuthWithWelcomeEmail() {
  console.log('🔐 Testing Auth + Welcome Email Integration...\n');
  
  const testUser = {
    email: `test-${Date.now()}@yourdomain.com`, // 🔥 REPLACE WITH YOUR DOMAIN
    name: 'SendGrid Test User',
    password: 'testpassword123'
  };
  
  try {
    console.log('📝 Testing user registration with welcome email...');
    
    const response = await fetch(`${NETLIFY_URL}/.netlify/functions/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Registration + Welcome Email - SUCCESS');
      console.log(`   User: ${result.user.email}`);
      console.log(`   Welcome email should have been sent!`);
      console.log(`   Check your inbox for the welcome email.`);
    } else {
      console.log('❌ Registration - FAILED');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('💥 Auth + Email test - NETWORK ERROR');
    console.log(`   Error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 SendGrid Integration Test Suite');
  console.log('=' .repeat(50));
  console.log('');
  
  console.log('⚠️  IMPORTANT: Update email addresses in this script before running!');
  console.log('   Replace "your-email@example.com" with your actual email address.');
  console.log('');
  
  await testSendGridIntegration();
  await testAuthWithWelcomeEmail();
  
  console.log('');
  console.log('🏁 SendGrid Test Suite Complete!');
  console.log('');
  console.log('📋 Checklist:');
  console.log('✅ 1. SendGrid API key configured in Netlify');
  console.log('✅ 2. Sender email verified in SendGrid');
  console.log('✅ 3. FROM_EMAIL environment variable set');
  console.log('✅ 4. Test emails received in inbox');
  console.log('');
  console.log('🎉 If all tests pass, your email system is fully operational!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSendGridIntegration, testAuthWithWelcomeEmail };