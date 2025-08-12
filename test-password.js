const bcrypt = require('bcryptjs');

async function testPassword() {
  const plainPassword = 'Fu^P)axAto-kgbnn';
  
  // Hash the password
  const hash = await bcrypt.hash(plainPassword, 10);
  console.log('Hash:', hash);
  
  // Test comparing
  const isValid = await bcrypt.compare(plainPassword, hash);
  console.log('Password valid:', isValid);
  
  // Test with the exact password you're trying
  const testHash = await bcrypt.hash('Fu^P)axAto-kgbnn', 10);
  const testValid = await bcrypt.compare('Fu^P)axAto-kgbnn', testHash);
  console.log('Test password valid:', testValid);
}

testPassword();