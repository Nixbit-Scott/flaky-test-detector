const axios = require('axios');

async function testCreateProject() {
  try {
    console.log('Testing project creation...');
    
    const response = await axios.post('http://localhost:3001/api/projects', {
      name: 'Test Project Direct',
      repository: 'https://github.com/test/repo',
      branch: 'main',
      retryEnabled: true,
      maxRetries: 3,
      retryDelay: 30,
      flakyThreshold: 0.3,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWR0cmZudzYwMDAwMjRyNHVxcGFnMTNrIiwiZW1haWwiOiJ0ZXN0QG5peGJpdC5kZXYiLCJpYXQiOjE3NTQxMDkzODAsImV4cCI6MTc1NDcxNDE4MH0.14Kn8Z5vBdOCICd7IpLn-2stggFVivt-0rzzS_Wl_3o',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testCreateProject();