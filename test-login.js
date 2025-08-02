const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login with test@nixbit.dev...');
    
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@nixbit.dev',
      password: 'testpassword123',
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Login successful:', response.data);
    
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

testLogin();