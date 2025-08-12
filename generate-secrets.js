#!/usr/bin/env node

const crypto = require('crypto');

// Generate secure random secrets
function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

// Generate a strong password
function generatePassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
}

console.log('🔐 Generating new secure credentials...\n');

console.log('=== COPY THESE TO NETLIFY ENVIRONMENT VARIABLES ===\n');

console.log(`ADMIN_PASSWORD=${generatePassword()}`);
console.log(`JWT_SECRET=${generateSecret()}`);
console.log(`SESSION_SECRET=${generateSecret()}`);
console.log(`SSO_ENCRYPTION_KEY=${generateSecret(32)}`);

console.log('\n=== LOCAL DEVELOPMENT .env FILE ===\n');

console.log('# Database (update with your new Supabase password)');
console.log('DATABASE_URL="postgresql://postgres:[YOUR_NEW_SUPABASE_PASSWORD]@db.pxkjkqdkmnnjdrgyrocy.supabase.co:5432/postgres"');
console.log('\n# Authentication');
console.log(`ADMIN_PASSWORD="${generatePassword()}"`);
console.log(`JWT_SECRET="${generateSecret()}"`);
console.log(`SESSION_SECRET="${generateSecret()}"`);
console.log(`SSO_ENCRYPTION_KEY="${generateSecret(32)}"`);

console.log('\n⚠️  IMPORTANT REMINDERS:');
console.log('1. Update Supabase password FIRST');
console.log('2. Copy these values to Netlify environment variables');
console.log('3. Update your local .env file');
console.log('4. Never commit .env files to Git');
console.log('5. Restart your local development server after updating');