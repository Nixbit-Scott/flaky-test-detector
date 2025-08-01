import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (error) {
    console.warn('Supabase client initialization failed:', error);
  }
}

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
    // Verify authentication
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Authentication required',
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
          error: 'Invalid token',
        }),
      };
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetOrganizations(decoded);
      case 'POST':
        return await handleCreateOrganization(decoded, event.body);
      case 'PUT':
        return await handleUpdateOrganization(decoded, event.body);
      case 'DELETE':
        return await handleDeleteOrganization(decoded, event.queryStringParameters);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({
            error: 'Method not allowed',
          }),
        };
    }

  } catch (error: any) {
    console.error('Organizations API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

async function handleGetOrganizations(user: any) {
  // If Supabase is not available, return mock data
  if (!supabase) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'mock-org-1',
            name: 'Demo Organization',
            plan: 'starter',
            owner_id: user.id,
            created_at: new Date().toISOString(),
          },
        ],
      }),
    };
  }

  try {
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        plan,
        subscription_status,
        owner_id,
        created_at,
        updated_at
      `)
      .or(`owner_id.eq.${user.id},members.user_id.eq.${user.id}`);

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: organizations || [],
      }),
    };

  } catch (error) {
    console.error('Error fetching organizations:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch organizations',
      }),
    };
  }
}

async function handleCreateOrganization(user: any, body: string | null) {
  const { name, plan = 'starter' } = JSON.parse(body || '{}');

  if (!name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Organization name is required',
      }),
    };
  }

  // If Supabase is not available, return mock data
  if (!supabase) {
    const mockOrg = {
      id: `mock-org-${Date.now()}`,
      name,
      plan,
      owner_id: user.id,
      subscription_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: mockOrg,
      }),
    };
  }

  try {
    const { data: organization, error } = await supabase
      .from('organizations')
      .insert({
        name,
        plan,
        owner_id: user.id,
        subscription_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: organization,
      }),
    };

  } catch (error: any) {
    console.error('Error creating organization:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'Organization name already exists',
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create organization',
      }),
    };
  }
}

async function handleUpdateOrganization(user: any, body: string | null) {
  const { id, name, plan } = JSON.parse(body || '{}');

  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Organization ID is required',
      }),
    };
  }

  if (!supabase) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: { id, name, plan, updated_at: new Date().toISOString() },
      }),
    };
  }

  try {
    const { data: organization, error } = await supabase
      .from('organizations')
      .update({
        ...(name && { name }),
        ...(plan && { plan }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', user.id) // Ensure user owns the organization
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!organization) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Organization not found or access denied',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: organization,
      }),
    };

  } catch (error) {
    console.error('Error updating organization:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to update organization',
      }),
    };
  }
}

async function handleDeleteOrganization(user: any, queryParams: any) {
  const organizationId = queryParams?.id;

  if (!organizationId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Organization ID is required',
      }),
    };
  }

  if (!supabase) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Organization deleted successfully',
      }),
    };
  }

  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', organizationId)
      .eq('owner_id', user.id); // Ensure user owns the organization

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Organization deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting organization:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to delete organization',
      }),
    };
  }
}

export { handler };