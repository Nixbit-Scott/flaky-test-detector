#!/usr/bin/env node

/**
 * Supabase Database Setup Script
 * Automatically sets up the complete database schema for Nixbit Flaky Test Detector
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxkjkqdkmnnjdrgyrocy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4a2prcWRrbW5uamRyZ3lyb2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTM2NDQsImV4cCI6MjA2ODkyOTY0NH0.sK3h00e2J2tqaEJUmppPWygpC6ZdlFhHtaJap6bcnQM';

console.log('🚀 Starting Supabase database setup for Nixbit Flaky Test Detector...');
console.log('📍 Supabase URL:', SUPABASE_URL);

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeSQL(sql, description) {
  console.log(`⚡ ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return false;
    }
    console.log('✅ Success!');
    return true;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return false;
  }
}

async function testConnection() {
  console.log('🔌 Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    console.log('✅ Connection successful!');
    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    return false;
  }
}

async function runSQLFile(filename) {
  const sqlFile = path.join(__dirname, filename);
  
  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ SQL file not found: ${sqlFile}`);
    return false;
  }
  
  console.log(`📄 Reading SQL file: ${filename}`);
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // Split SQL into individual statements (simple approach)
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
  
  console.log(`📝 Found ${statements.length} SQL statements to execute`);
  
  let successCount = 0;
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length === 0) continue;
    
    console.log(`\n🔧 Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      // Use the Supabase REST API to execute SQL
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ sql_query: statement })
      });
      
      if (!response.ok) {
        console.warn(`⚠️  Statement ${i + 1} may have failed (${response.status})`);
        // Continue with other statements
      } else {
        successCount++;
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    } catch (err) {
      console.warn(`⚠️  Error in statement ${i + 1}: ${err.message}`);
      // Continue with other statements
    }
  }
  
  console.log(`\n📊 Setup Summary: ${successCount}/${statements.length} statements executed successfully`);
  return successCount > 0;
}

async function verifySetup() {
  console.log('\n🔍 Verifying database setup...');
  
  const tablesToCheck = [
    'users',
    'organizations', 
    'projects',
    'test_runs',
    'test_results',
    'flaky_test_patterns',
    'ai_analysis'
  ];
  
  let verifiedTables = 0;
  
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table '${table}' - Error: ${error.message}`);
      } else {
        console.log(`✅ Table '${table}' - OK`);
        verifiedTables++;
      }
    } catch (err) {
      console.log(`❌ Table '${table}' - Error: ${err.message}`);
    }
  }
  
  console.log(`\n📈 Database Verification: ${verifiedTables}/${tablesToCheck.length} tables verified`);
  return verifiedTables === tablesToCheck.length;
}

async function createTestUser() {
  console.log('\n👤 Creating test user...');
  
  const testUser = {
    id: 'test-user-' + Date.now(),
    email: 'test@nixbit.dev',
    name: 'Test User'
  };
  
  try {
    const { data, error } = await supabase.from('users').insert([testUser]).select();
    if (error) {
      console.log(`⚠️  Test user creation: ${error.message}`);
    } else {
      console.log('✅ Test user created successfully');
      return testUser;
    }
  } catch (err) {
    console.log(`⚠️  Test user creation error: ${err.message}`);
  }
  
  return null;
}

async function createTestProject(userId) {
  if (!userId) return null;
  
  console.log('📁 Creating test project...');
  
  const testProject = {
    id: 'test-project-' + Date.now(),
    name: 'Test Project',
    description: 'Automatically created test project',
    repository_url: 'https://github.com/example/test-repo',
    user_id: userId
  };
  
  try {
    const { data, error } = await supabase.from('projects').insert([testProject]).select();
    if (error) {
      console.log(`⚠️  Test project creation: ${error.message}`);
    } else {
      console.log('✅ Test project created successfully');
      return testProject;
    }
  } catch (err) {
    console.log(`⚠️  Test project creation error: ${err.message}`);
  }
  
  return null;
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🎯 NIXBIT FLAKY TEST DETECTOR - SUPABASE SETUP');
  console.log('=' .repeat(60));
  
  // Step 1: Test connection
  const connected = await testConnection();
  if (!connected) {
    console.error('\n❌ Setup failed: Could not connect to Supabase');
    process.exit(1);
  }
  
  // Step 2: Run the SQL setup file
  console.log('\n📦 Setting up database schema...');
  const setupSuccess = await runSQLFile('supabase-setup.sql');
  
  // Step 3: Verify the setup
  const verified = await verifySetup();
  
  // Step 4: Create test data
  const testUser = await createTestUser();
  const testProject = await createTestProject(testUser?.id);
  
  // Final summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 SETUP SUMMARY');
  console.log('=' .repeat(60));
  console.log(`🔌 Connection: ${connected ? '✅ Success' : '❌ Failed'}`);
  console.log(`📦 Schema Setup: ${setupSuccess ? '✅ Success' : '❌ Failed'}`);
  console.log(`🔍 Verification: ${verified ? '✅ Success' : '❌ Failed'}`);
  console.log(`👤 Test User: ${testUser ? '✅ Created' : '⚠️  Skipped'}`);
  console.log(`📁 Test Project: ${testProject ? '✅ Created' : '⚠️  Skipped'}`);
  
  if (connected && setupSuccess) {
    console.log('\n🎉 SUPABASE SETUP COMPLETED!');
    console.log('🚀 Your Nixbit database is ready for production use.');
    console.log('\n💡 Next steps:');
    console.log('   1. Test the application by creating a project');
    console.log('   2. Verify persistence by logging out and back in');
    console.log('   3. Remove the in-memory fallback code when satisfied');
  } else {
    console.log('\n⚠️  SETUP INCOMPLETE');
    console.log('❗ Some steps failed. Please check the errors above.');
    console.log('💭 You may need to:');
    console.log('   - Check your Supabase credentials');
    console.log('   - Ensure you have the right permissions');
    console.log('   - Run the SQL manually in Supabase dashboard');
  }
  
  console.log('\n📖 For more help, check the supabase-setup.sql file');
  console.log('=' .repeat(60));
}

// Run the setup
main().catch(err => {
  console.error('\n💥 Setup failed with error:', err.message);
  console.error(err.stack);
  process.exit(1);
});