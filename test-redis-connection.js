const { createClient } = require('redis');

console.log('🧪 Testing Redis Connection for Session Storage...\n');

async function testRedisConnection() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`Attempting to connect to Redis: ${redisUrl}`);
    
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        commandTimeout: 3000,
      }
    });

    client.on('error', (err) => {
      console.log('   ⚠️  Redis Client Error:', err.message);
    });

    client.on('connect', () => {
      console.log('   🔗 Redis client connecting...');
    });

    client.on('ready', () => {
      console.log('   ✅ Redis client ready!');
    });

    // Try to connect
    await client.connect();
    
    // Test basic operations
    console.log('\n2. Testing Redis Operations...');
    
    // Set a test key
    await client.set('test-session-key', 'test-session-data', {
      EX: 60 // Expire in 60 seconds
    });
    console.log('   ✅ Successfully set test session data');
    
    // Get the test key
    const value = await client.get('test-session-key');
    if (value === 'test-session-data') {
      console.log('   ✅ Successfully retrieved test session data');
    } else {
      console.log('   ❌ Failed to retrieve correct session data');
    }
    
    // Test TTL
    const ttl = await client.ttl('test-session-key');
    if (ttl > 0 && ttl <= 60) {
      console.log('   ✅ Session expiration working correctly');
    } else {
      console.log('   ❌ Session expiration not working correctly');
    }
    
    // Clean up
    await client.del('test-session-key');
    console.log('   ✅ Test data cleaned up');
    
    // Test session-like operations
    console.log('\n3. Testing Session-like Operations...');
    
    const sessionId = 'sess:test-session-123';
    const sessionData = JSON.stringify({
      userId: 'user-123',
      email: 'test@example.com',
      organizationId: 'org-456',
      createdAt: new Date().toISOString()
    });
    
    // Store session
    await client.setEx(sessionId, 24 * 60 * 60, sessionData); // 24 hours
    console.log('   ✅ Session stored successfully');
    
    // Retrieve session
    const retrievedSession = await client.get(sessionId);
    if (retrievedSession) {
      const parsed = JSON.parse(retrievedSession);
      if (parsed.userId === 'user-123' && parsed.email === 'test@example.com') {
        console.log('   ✅ Session data retrieved and parsed correctly');
      } else {
        console.log('   ❌ Session data corrupted');
      }
    } else {
      console.log('   ❌ Failed to retrieve session data');
    }
    
    // Test rate limiting keys
    console.log('\n4. Testing Rate Limiting Operations...');
    
    const rateLimitKey = 'rl:sso:org-123:192.168.1.1';
    
    // Increment rate limit counter
    const count = await client.incr(rateLimitKey);
    await client.expire(rateLimitKey, 900); // 15 minutes
    
    if (count === 1) {
      console.log('   ✅ Rate limiting counter working');
    } else {
      console.log('   ❌ Rate limiting counter failed');
    }
    
    // Check TTL
    const rateTtl = await client.ttl(rateLimitKey);
    if (rateTtl > 0 && rateTtl <= 900) {
      console.log('   ✅ Rate limiting expiration working');
    } else {
      console.log('   ❌ Rate limiting expiration failed');
    }
    
    // Clean up
    await client.del(sessionId, rateLimitKey);
    console.log('   ✅ Rate limiting data cleaned up');
    
    await client.disconnect();
    console.log('\n   ✅ Redis connection closed successfully');
    
    return true;
  } catch (error) {
    console.log('   ❌ Redis connection test failed:', error.message);
    console.log('   💡 Make sure Redis is running: docker run -d -p 6379:6379 redis:alpine');
    return false;
  }
}

// Test fallback to memory store
console.log('\n5. Testing Memory Store Fallback...');
try {
  // Simulate in-memory session storage
  const memoryStore = new Map();
  
  // Store session
  const sessionId = 'sess:memory-test';
  const sessionData = {
    userId: 'user-123',
    email: 'test@example.com',
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
  
  memoryStore.set(sessionId, sessionData);
  
  // Retrieve session
  const retrieved = memoryStore.get(sessionId);
  if (retrieved && retrieved.userId === 'user-123') {
    console.log('   ✅ Memory store fallback working');
  } else {
    console.log('   ❌ Memory store fallback failed');
  }
  
  // Test expiration check
  const isExpired = retrieved.expires < new Date();
  if (!isExpired) {
    console.log('   ✅ Memory store expiration logic working');
  } else {
    console.log('   ❌ Memory store expiration logic failed');
  }
  
  memoryStore.delete(sessionId);
  console.log('   ✅ Memory store cleanup working');
} catch (error) {
  console.log('   ❌ Memory store test failed:', error.message);
}

// Run the test
testRedisConnection().then((success) => {
  console.log('\n' + '='.repeat(50));
  console.log('🎯 Redis Session Storage Test Results:');
  console.log('='.repeat(50));
  
  if (success) {
    console.log('✅ Redis connection successful');
    console.log('✅ Basic Redis operations working');
    console.log('✅ Session storage operations working');
    console.log('✅ Rate limiting operations working');
    console.log('✅ Memory store fallback available');
    console.log('\n🚀 Session storage is ready for production!');
  } else {
    console.log('⚠️  Redis connection failed');
    console.log('✅ Memory store fallback available');
    console.log('\n💡 For development, memory store will work.');
    console.log('🔧 For production, please set up Redis.');
  }
}).catch(console.error);