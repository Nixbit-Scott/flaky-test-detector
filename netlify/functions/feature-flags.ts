import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { FeatureFlagService, FeatureFlag } from '../../shared/src/services/feature-flags';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Admin users who can manage feature flags
const adminEmails = ['admin@nixbit.dev', 'scott@nixbit.dev'];

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/feature-flags', '') || '/';
    
    switch (event.httpMethod) {
      case 'GET':
        if (path === '/' || path === '/list') {
          return await handleGetFeatureFlags(event);
        }
        break;
      case 'POST':
        if (path === '/update') {
          return await handleUpdateFeatureFlag(event);
        }
        break;
      case 'PUT':
        if (path === '/toggle') {
          return await handleToggleFeatureFlag(event);
        }
        break;
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Endpoint not found',
      }),
    };

  } catch (error: any) {
    console.error('Feature flags error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Internal server error',
      }),
    };
  }
};

async function handleGetFeatureFlags(event: HandlerEvent) {
  try {
    // Get user info from token if provided
    let userInfo: any = null;
    const authHeader = event.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
      
      try {
        userInfo = jwt.verify(token, jwtSecret);
      } catch (jwtError) {
        // Token invalid, continue without user info
        console.warn('Invalid token for feature flags request');
      }
    }

    // Determine environment
    const environment = process.env.VITE_ENVIRONMENT || 'production';
    
    // Get appropriate flags based on environment
    let flags: FeatureFlag[] = [];
    
    if (environment === 'beta') {
      flags = FeatureFlagService.getBetaFlags();
    } else if (environment === 'development') {
      // Development flags - all features enabled
      flags = [
        ...FeatureFlagService.getBetaFlags(),
        {
          key: 'debug_mode',
          name: 'Debug Mode',
          description: 'Enable debug logging and development tools',
          enabled: true,
          rolloutPercentage: 100,
          environment: 'development'
        }
      ];
    } else {
      // Production flags - conservative rollout
      flags = [
        {
          key: 'enhanced_analytics',
          name: 'Enhanced Analytics',
          description: 'Advanced analytics dashboard with user behavior tracking',
          enabled: true,
          rolloutPercentage: 100,
        },
        {
          key: 'feedback_collection',
          name: 'In-App Feedback Collection',
          description: 'Contextual feedback forms throughout the application',
          enabled: true,
          rolloutPercentage: 50, // Limited rollout in production
        },
        {
          key: 'ai_insights_v2',
          name: 'AI Insights V2',
          description: 'Next generation AI-powered test insights',
          enabled: false, // Disabled in production until beta testing complete
          rolloutPercentage: 0,
        }
      ];
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          flags,
          environment,
          userInfo: userInfo ? {
            id: userInfo.id,
            email: userInfo.email,
            organizationId: userInfo.organizationId,
          } : null,
        },
      }),
    };

  } catch (error: any) {
    console.error('Error getting feature flags:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to get feature flags',
      }),
    };
  }
}

async function handleUpdateFeatureFlag(event: HandlerEvent) {
  // Verify admin authentication
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Authentication required',
      }),
    };
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  let decoded: any;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (jwtError) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid token',
      }),
    };
  }

  // Check if user is admin
  if (!adminEmails.includes(decoded.email)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Admin access required',
      }),
    };
  }

  try {
    const { flagKey, updates } = JSON.parse(event.body || '{}');

    if (!flagKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Flag key is required',
        }),
      };
    }

    // In a real implementation, you would update the flag in a database
    // For now, we'll just return success
    console.log(`Admin ${decoded.email} updated feature flag ${flagKey}:`, updates);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Feature flag updated successfully',
        data: {
          flagKey,
          updates,
          updatedBy: decoded.email,
          updatedAt: new Date().toISOString(),
        },
      }),
    };

  } catch (error: any) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid request body',
      }),
    };
  }
}

async function handleToggleFeatureFlag(event: HandlerEvent) {
  // Similar to update but simpler - just toggle enabled status
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Authentication required',
      }),
    };
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  let decoded: any;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (jwtError) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid token',
      }),
    };
  }

  if (!adminEmails.includes(decoded.email)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Admin access required',
      }),
    };
  }

  try {
    const { flagKey, enabled } = JSON.parse(event.body || '{}');

    if (!flagKey || typeof enabled !== 'boolean') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Flag key and enabled status are required',
        }),
      };
    }

    console.log(`Admin ${decoded.email} toggled feature flag ${flagKey} to ${enabled}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Feature flag toggled successfully',
        data: {
          flagKey,
          enabled,
          toggledBy: decoded.email,
          toggledAt: new Date().toISOString(),
        },
      }),
    };

  } catch (error: any) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid request body',
      }),
    };
  }
}

export { handler };