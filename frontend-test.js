// Test script to run in browser console
// This will test the login API directly from the frontend

async function testLoginFromFrontend() {
  try {
    console.log('Testing login from frontend...');
    
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@nixbit.dev',
        password: 'testpassword123'
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('Token:', data.token);
      console.log('User:', data.user);
      
      // Test storing in localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('✅ Credentials stored in localStorage');
      
      // Refresh the page to trigger AuthContext
      window.location.reload();
      
    } else {
      console.log('❌ Login failed:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Run the test
testLoginFromFrontend();