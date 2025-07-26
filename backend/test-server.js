const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3003;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

// Test routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock auth endpoints for testing
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Mock successful login
  res.json({
    message: 'Login successful',
    user: { id: '1', email: email, name: 'Test User' },
    token: 'mock-jwt-token-12345'
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  // Mock successful registration
  res.status(201).json({
    message: 'User created successfully',
    user: { id: '1', email: email, name: name || 'User' }
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // Mock user data
  res.json({
    user: { id: '1', email: 'test@example.com', name: 'Test User' }
  });
});

// Catch all for API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found', path: req.path });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});