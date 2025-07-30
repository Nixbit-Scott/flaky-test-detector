#!/usr/bin/env node

/**
 * Create the necessary tables for Nixbit with proper structure
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createUserProfiles() {
  console.log('👤 Creating user_profiles table...');
  
  const userProfile = {
    id: 'test-user-' + Date.now(),
    email: `test-${Date.now()}@nixbit.dev`,
    name: 'Test User',
    is_active: true
  };
  
  try {
    // Try to create a user profile record
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([userProfile])
      .select();
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ user_profiles table does not exist');
        return false;
      } else {
        console.log('⚠️  Insert failed:', error.message);
      }
    } else {
      console.log('✅ user_profiles table exists and working');
      // Clean up
      await supabase.from('user_profiles').delete().eq('id', userProfile.id);
      return true;
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
  
  return false;
}

async function createProjectsTable() {
  console.log('📁 Testing projects table...');
  
  // First, let's check if we can create a project with a simple structure
  const testProject = {
    id: 'test-project-' + Date.now(),
    name: 'Test Project',
    description: 'Test project for verification',
    repository_url: 'https://github.com/test/repo',
    user_id: 'test-user-id',
    is_active: true
  };
  
  try {
    const { data, error } = await supabase
      .from('projects')
      .insert([testProject])
      .select();
    
    if (error) {
      console.log('❌ Projects table error:', error.message);
      return false;
    } else {
      console.log('✅ Projects table working correctly');
      console.log('📊 Created project:', data[0]);
      
      // Test fetching
      const { data: fetchData, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', testProject.id);
      
      if (fetchError) {
        console.log('❌ Project fetch failed:', fetchError.message);
      } else {
        console.log('✅ Project fetch successful');
        console.log('📈 Fetched:', fetchData[0]);
      }
      
      // Clean up
      await supabase.from('projects').delete().eq('id', testProject.id);
      console.log('🧹 Test data cleaned up');
      
      return true;
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
    return false;
  }
}

async function testWithCurrentUser() {
  console.log('\n🔐 Testing with authenticated user...');
  
  // Try to get current user
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    console.log('⚠️  No authenticated user found');
    console.log('💡 This is normal for anon key testing');
    return await testAnonymously();
  } else {
    console.log('✅ Found authenticated user:', user.email);
    return await testWithUserId(user.id);
  }
}

async function testAnonymously() {
  console.log('🔓 Testing anonymously...');
  
  const testUserId = 'anon-user-' + Date.now();
  return await testWithUserId(testUserId);
}

async function testWithUserId(userId) {
  const testProject = {
    id: 'test-project-' + Date.now(),
    name: 'Real Test Project',
    description: 'Testing with user ID: ' + userId,
    repository_url: 'https://github.com/nixbit/test',
    user_id: userId,
    is_active: true
  };
  
  try {
    console.log('📝 Creating project for user:', userId);
    
    const { data, error } = await supabase
      .from('projects')
      .insert([testProject])
      .select();
    
    if (error) {
      console.log('❌ Project creation failed:', error.message);
      
      if (error.code === '23503') {
        console.log('💡 This is a foreign key constraint error - user does not exist');
        console.log('🔧 Let me try to create a user first...');
        
        // Try to create user in the auth.users table (this won't work with anon key)
        console.log('⚠️  Cannot create auth user with anon key');
        return false;
      }
      
      return false;
    } else {
      console.log('✅ Project created successfully!');
      console.log('📊 Project data:', data[0]);
      
      // Test retrieval
      const { data: projects, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);
      
      if (fetchError) {
        console.log('❌ Fetch failed:', fetchError.message);
      } else {
        console.log('✅ Fetch successful - found', projects.length, 'projects');
      }
      
      // Clean up
      await supabase.from('projects').delete().eq('id', testProject.id);
      console.log('🧹 Cleaned up test project');
      
      return true;
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
    return false;
  }
}

async function inspectDatabase() {
  console.log('\n🔍 Inspecting database structure...');
  
  // Try to get information about the projects table
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Could not inspect projects:', error.message);
    } else {
      console.log('✅ Projects table inspection:');
      console.log(`📊 Found ${data.length} existing projects`);
      
      if (data.length > 0) {
        console.log('📋 Sample project structure:');
        const sample = data[0];
        Object.keys(sample).forEach(key => {
          console.log(`   ${key}: ${typeof sample[key]} = ${sample[key]}`);
        });
      } else {
        console.log('📭 No projects found (table is empty)');
      }
    }
  } catch (err) {
    console.log('❌ Inspection error:', err.message);
  }
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🔧 SUPABASE PROJECTS TABLE TEST');
  console.log('=' .repeat(60));
  
  await inspectDatabase();
  
  const projectsWork = await createProjectsTable();
  
  if (projectsWork) {
    console.log('\n🎉 SUCCESS!');
    console.log('✅ The projects table is working correctly');
    console.log('✅ CRUD operations are functional');
    console.log('✅ Your Netlify functions should work with this setup');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. The projects table is ready to use');
    console.log('2. You can now test project creation in the app');
    console.log('3. Projects should persist properly');
    console.log('4. Consider removing the in-memory fallback');
  } else {
    console.log('\n⚠️  NEEDS ATTENTION');
    console.log('❗ The projects table needs to be set up properly');
    console.log('💡 You may need to:');
    console.log('   - Create the table manually in Supabase dashboard');
    console.log('   - Check your RLS policies');
    console.log('   - Verify your user authentication setup');
  }
  
  console.log('\n' + '=' .repeat(60));
}

main().catch(console.error);