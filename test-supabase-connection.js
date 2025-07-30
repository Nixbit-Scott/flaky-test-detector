#!/usr/bin/env node

/**
 * Test Supabase Connection and Basic Table Creation
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration from .env file
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Testing Supabase Connection...');
console.log('📍 URL:', SUPABASE_URL);
console.log('🔑 Key:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : 'Not provided');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('\n🔌 Testing basic connection...');
  
  try {
    // Try a simple operation
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('⚠️  Auth session check:', error.message);
    } else {
      console.log('✅ Basic connection successful');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    return false;
  }
}

async function checkTables() {
  console.log('\n📋 Checking if our tables exist...');
  
  const tables = ['users', 'projects'];
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`);
        results[table] = false;
      } else {
        console.log(`✅ Table '${table}': exists and accessible`);
        results[table] = true;
      }
    } catch (err) {
      console.log(`❌ Table '${table}': ${err.message}`);
      results[table] = false;
    }
  }
  
  return results;
}

async function createBasicTables() {
  console.log('\n🔨 Attempting to create basic tables...');
  console.log('ℹ️  Note: This may fail if you need admin privileges');
  
  // Try to create tables using SQL
  const createUsersSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  const createProjectsSQL = `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      repository_url TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  try {
    // This may not work with the anon key - we would need service role key
    console.log('⚠️  Creating tables requires service role key, which we may not have...');
    return false;
  } catch (err) {
    console.log('❌ Table creation failed:', err.message);
    return false;
  }
}

async function testCRUDOperations() {
  console.log('\n🧪 Testing CRUD operations (if tables exist)...');
  
  // Test user creation
  const testUserId = 'test-user-' + Date.now();
  const testUser = {
    id: testUserId,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User'
  };
  
  try {
    console.log('📝 Testing user creation...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([testUser])
      .select();
    
    if (userError) {
      console.log('❌ User creation failed:', userError.message);
      return false;
    } else {
      console.log('✅ User created successfully');
      
      // Test project creation
      const testProject = {
        id: 'test-project-' + Date.now(),
        name: 'Test Project',
        description: 'Test Description',
        user_id: testUserId
      };
      
      console.log('📝 Testing project creation...');
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([testProject])
        .select();
      
      if (projectError) {
        console.log('❌ Project creation failed:', projectError.message);
      } else {
        console.log('✅ Project created successfully');
        console.log('📊 Project data:', projectData[0]);
        
        // Test project retrieval
        console.log('📖 Testing project retrieval...');
        const { data: projects, error: fetchError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', testUserId);
        
        if (fetchError) {
          console.log('❌ Project fetch failed:', fetchError.message);
        } else {
          console.log('✅ Project fetch successful');
          console.log(`📈 Found ${projects.length} projects for user`);
        }
        
        // Clean up test data
        console.log('🧹 Cleaning up test data...');
        await supabase.from('projects').delete().eq('id', testProject.id);
        await supabase.from('users').delete().eq('id', testUserId);
        console.log('✅ Test data cleaned up');
        
        return true;
      }
    }
  } catch (err) {
    console.log('❌ CRUD test failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('=' .repeat(50));
  console.log('🎯 SUPABASE CONNECTION TEST');
  console.log('=' .repeat(50));
  
  // Test basic connection
  const connected = await testConnection();
  
  // Check existing tables
  const tableResults = await checkTables();
  const tablesExist = Object.values(tableResults).some(exists => exists);
  
  // If tables don't exist, we can't create them with anon key
  if (!tablesExist) {
    console.log('\n⚠️  TABLES DO NOT EXIST');
    console.log('❗ You need to create the database tables manually.');
    console.log('💡 Here are your options:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy and paste the content of supabase-setup.sql');
    console.log('   3. Run the SQL to create all tables');
    console.log('   4. Come back and run this test again');
    console.log('\n🔗 Supabase Dashboard: https://supabase.com/dashboard');
  } else {
    // Test CRUD operations
    const crudSuccess = await testCRUDOperations();
    
    console.log('\n' + '=' .repeat(50));
    console.log('📋 TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log(`🔌 Connection: ${connected ? '✅ Success' : '❌ Failed'}`);
    console.log(`📋 Tables Exist: ${tablesExist ? '✅ Yes' : '❌ No'}`);
    console.log(`🧪 CRUD Operations: ${crudSuccess ? '✅ Success' : '❌ Failed'}`);
    
    if (connected && tablesExist && crudSuccess) {
      console.log('\n🎉 SUPABASE IS FULLY WORKING!');
      console.log('🚀 Your database is ready for the application.');
    }
  }
  
  console.log('\n📖 Next: Check supabase-setup.sql for the complete schema');
  console.log('=' .repeat(50));
}

main().catch(err => {
  console.error('\n💥 Test failed:', err.message);
  console.error(err.stack);
});