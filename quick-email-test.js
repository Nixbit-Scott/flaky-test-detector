#!/usr/bin/env node

// Quick SendGrid test - Update YOUR_EMAIL before running
const YOUR_EMAIL = 'scott@nixbit.dev'; // 🔥 UPDATE IF DIFFERENT

const fetch = globalThis.fetch || require('node-fetch');

async function quickTest() {
  console.log('🧪 Quick SendGrid Test');
  console.log('='.repeat(30));
  
  if (YOUR_EMAIL === 'your-email@domain.com') {
    console.log('❌ Please update YOUR_EMAIL in this script first!');
    console.log('   Edit quick-email-test.js and replace YOUR_EMAIL');
    return;
  }
  
  console.log(`📧 Testing welcome email to: ${YOUR_EMAIL}`);
  
  try {
    const response = await fetch('https://flakytestdetector.netlify.app/.netlify/functions/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: YOUR_EMAIL,
        template: 'welcome',
        data: {
          name: 'Test User',
          email: YOUR_EMAIL
        },
        provider: 'sendgrid'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Email sent');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Provider: ${result.provider}`);
      console.log('');
      console.log('📬 Check your email inbox!');
    } else {
      console.log('❌ FAILED');
      console.log(`   Error: ${result.error}`);
      
      if (result.error.includes('API key not configured')) {
        console.log('');
        console.log('🔧 Fix: Add SENDGRID_API_KEY to Netlify environment variables');
      }
    }
  } catch (error) {
    console.log('💥 Network Error');
    console.log(`   ${error.message}`);
  }
}

quickTest();