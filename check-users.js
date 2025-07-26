#!/usr/bin/env node

/**
 * Script to check if users exist in the database
 * Usage: node check-users.js [email]
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser(email) {
  try {
    console.log(`🔍 Checking for user with email: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastLoginAt: true,
        isSystemAdmin: true,
      }
    });

    if (user) {
      console.log('✅ User found:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.name || 'No name set'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Last Login: ${user.lastLoginAt || 'Never'}`);
      console.log(`   System Admin: ${user.isSystemAdmin ? 'Yes' : 'No'}`);
      return user;
    } else {
      console.log('❌ No user found with that email');
      return null;
    }
  } catch (error) {
    console.error('💥 Error checking user:', error.message);
    return null;
  }
}

async function listAllUsers() {
  try {
    console.log('📋 Listing all users in database:');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        isSystemAdmin: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    if (users.length === 0) {
      console.log('   No users found in database');
    } else {
      console.log(`   Found ${users.length} user(s):`);
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.name || 'No name'}) - Created: ${user.createdAt.toISOString().split('T')[0]}`);
      });
    }
    
    return users;
  } catch (error) {
    console.error('💥 Error listing users:', error.message);
    return [];
  }
}

async function getUserCount() {
  try {
    const count = await prisma.user.count();
    console.log(`📊 Total users in database: ${count}`);
    return count;
  } catch (error) {
    console.error('💥 Error getting user count:', error.message);
    return 0;
  }
}

async function main() {
  const email = process.argv[2];
  
  if (email) {
    // Check specific user
    await checkUser(email);
  } else {
    // Show all users
    await getUserCount();
    console.log('');
    await listAllUsers();
  }
  
  await prisma.$disconnect();
}

// Handle uncaught errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
  process.exit(1);
});

main().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});