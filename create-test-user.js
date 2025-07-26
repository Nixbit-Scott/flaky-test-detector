#!/usr/bin/env node

/**
 * Script to create a test user in the database
 * Usage: node create-test-user.js [email] [password] [name]
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser(email, password, name) {
  try {
    console.log(`🔨 Creating test user with email: ${email}`);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      console.log('❌ User already exists with that email');
      return null;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    });
    
    console.log('✅ Test user created successfully:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || 'No name set'}`);
    console.log(`   Created: ${user.createdAt}`);
    
    return user;
  } catch (error) {
    console.error('💥 Error creating user:', error.message);
    return null;
  }
}

async function main() {
  const email = process.argv[2] || 'test@example.com';
  const password = process.argv[3] || 'password123';
  const name = process.argv[4] || 'Test User';
  
  await createTestUser(email, password, name);
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