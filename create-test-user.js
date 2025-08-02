const axios = require('axios');

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    const response = await axios.post('http://localhost:3001/api/auth/register', {
      email: 'test@nixbit.dev',
      name: 'Test User',
      password: 'testpassword123',
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('User created:', response.data);
    
    // Now login to get a token
    console.log('\nLogging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@nixbit.dev',
      password: 'testpassword123',
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Login successful:', loginResponse.data);
    return loginResponse.data.token;
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

createTestUser().then(token => {
  if (token) {
    console.log('\nToken for testing:', token);
    console.log('You can now use this token to test project creation');
  }
});