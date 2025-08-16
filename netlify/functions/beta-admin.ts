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

// Admin users (should match other admin functions)
const adminEmails = ['admin@nixbit.dev', 'scott@nixbit.dev'];

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (error) {
    console.warn('Supabase client initialization failed:', error);
  }
}

// In-memory store for beta testers (fallback when no database)
let betaTesters: Array<{
  id: string;
  email: string;
  name?: string;
  company?: string;
  teamSize?: string;
  status: 'pending' | 'approved' | 'provisioned' | 'rejected';
  signupDate: string;
  provisionedDate?: string;
  accessExpires?: string;
  notes?: string;
}> = [];

const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
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

    // No need to load data here as we'll fetch directly from database

    // Handle different HTTP methods and paths
    const path = event.path.replace('/.netlify/functions/beta-admin', '') || '/';
    
    switch (event.httpMethod) {
      case 'GET':
        if (path === '/' || path === '/list') {
          return await handleListBetaTesters();
        } else if (path.startsWith('/analytics')) {
          return await handleBetaAnalytics();
        }
        break;
      case 'POST':
        if (path === '/provision') {
          return await handleProvisionAccess(event.body);
        } else if (path === '/update-status') {
          return await handleUpdateStatus(event.body);
        }
        break;
      case 'PUT':
        if (path === '/update') {
          return await handleUpdateTester(event.body);
        }
        break;
      case 'DELETE':
        if (path === '/remove') {
          return await handleRemoveTester(event.queryStringParameters);
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
    console.error('Beta admin error:', error);
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

async function handleListBetaTesters() {
  // If Supabase is available, try to get data from database
  if (supabase) {
    try {
      const { data: signups, error } = await supabase
        .from('marketing_signups')
        .select('*')
        .or('source.eq.beta-signup-page,source.is.null')
        .order('created_at', { ascending: false });

      if (!error && signups) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: signups.map((signup: any) => ({
              id: signup.id,
              email: signup.email,
              name: signup.name,
              company: signup.company,
              teamSize: signup.team_size,
              status: signup.status || 'pending',
              signupDate: signup.created_at,
              provisionedDate: signup.provisioned_at,
              accessExpires: signup.access_expires,
              notes: signup.notes || [
                signup.role ? `Role: ${signup.role}` : null,
                signup.primary_usage ? `CI/CD: ${signup.primary_usage}` : null,
                signup.available_time ? `Time: ${signup.available_time}` : null,
                signup.motivation ? `Motivation: ${signup.motivation.substring(0, 100)}...` : null,
              ].filter(Boolean).join(' | '),
            })),
            total: signups.length,
          }),
        };
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }
  }

  // Fallback to in-memory data
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: betaTesters,
      total: betaTesters.length,
    }),
  };
}

async function handleBetaAnalytics() {
  const now = new Date();
  
  // Try to get analytics from database
  if (supabase) {
    try {
      const { data: signups, error } = await supabase
        .from('marketing_signups')
        .select('*')
        .or('source.eq.beta-signup-page,source.is.null');

      if (!error && signups) {
        const stats = {
          total: signups.length,
          pending: signups.filter((t: any) => t.status === 'pending' || !t.status).length,
          approved: signups.filter((t: any) => t.status === 'approved').length,
          provisioned: signups.filter((t: any) => t.status === 'provisioned').length,
          rejected: signups.filter((t: any) => t.status === 'rejected').length,
        };

        // Calculate signup trends (last 7 days)
        const signupTrends: Array<{ date: string; signups: number }> = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          
          const daySignups = signups.filter((t: any) => {
            const signupDate = new Date(t.created_at);
            return signupDate >= dayStart && signupDate < dayEnd;
          });

          signupTrends.push({
            date: dayStart.toISOString().split('T')[0],
            signups: daySignups.length,
          });
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              stats,
              trends: signupTrends,
              recentSignups: signups
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 10)
                .map((s: any) => ({
                  id: s.id,
                  email: s.email,
                  name: s.name,
                  company: s.company,
                  teamSize: s.team_size,
                  status: s.status || 'pending',
                  signupDate: s.created_at,
                })),
            },
          }),
        };
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }
  }
  
  // Fallback to in-memory data
  const stats = {
    total: betaTesters.length,
    pending: betaTesters.filter(t => t.status === 'pending').length,
    approved: betaTesters.filter(t => t.status === 'approved').length,
    provisioned: betaTesters.filter(t => t.status === 'provisioned').length,
    rejected: betaTesters.filter(t => t.status === 'rejected').length,
  };

  // Calculate signup trends (last 7 days)
  const signupTrends: Array<{ date: string; signups: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const daySignups = betaTesters.filter(t => {
      const signupDate = new Date(t.signupDate);
      return signupDate >= dayStart && signupDate < dayEnd;
    });

    signupTrends.push({
      date: dayStart.toISOString().split('T')[0],
      signups: daySignups.length,
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: {
        stats,
        trends: signupTrends,
        recentSignups: betaTesters
          .sort((a, b) => new Date(b.signupDate).getTime() - new Date(a.signupDate).getTime())
          .slice(0, 10),
      },
    }),
  };
}

async function handleProvisionAccess(body: string | null) {
  const { email, accessDays = 30, notes } = JSON.parse(body || '{}');

  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Email is required',
      }),
    };
  }

  const now = new Date();
  const accessExpires = new Date(now.getTime() + accessDays * 24 * 60 * 60 * 1000);

  // Update in database if available
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('marketing_signups')
        .update({
          status: 'provisioned',
          provisioned_at: now.toISOString(),
          access_expires: accessExpires.toISOString(),
          notes: notes,
          updated_at: now.toISOString(),
        })
        .eq('email', email)
        .select()
        .single();

      if (!error && data) {
        // TODO: Send welcome email with login credentials
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Access provisioned successfully',
            data: {
              id: data.id,
              email: data.email,
              name: data.name,
              company: data.company,
              teamSize: data.team_size,
              status: data.status,
              signupDate: data.created_at,
              provisionedDate: data.provisioned_at,
              accessExpires: data.access_expires,
              notes: data.notes,
            },
          }),
        };
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }
  }

  // Fallback to in-memory
  const testerIndex = betaTesters.findIndex(t => t.email === email);
  if (testerIndex === -1) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Beta tester not found',
      }),
    };
  }

  betaTesters[testerIndex] = {
    ...betaTesters[testerIndex],
    status: 'provisioned',
    provisionedDate: now.toISOString(),
    accessExpires: accessExpires.toISOString(),
    notes: notes || betaTesters[testerIndex].notes,
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Access provisioned successfully',
      data: betaTesters[testerIndex],
    }),
  };
}

async function handleUpdateStatus(body: string | null) {
  const { email, status, notes } = JSON.parse(body || '{}');

  if (!email || !status) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Email and status are required',
      }),
    };
  }

  const validStatuses = ['pending', 'approved', 'provisioned', 'rejected'];
  if (!validStatuses.includes(status)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid status',
      }),
    };
  }

  // Update in database if available
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('marketing_signups')
        .update({
          status,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email)
        .select()
        .single();

      if (!error && data) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Status updated successfully',
            data: {
              id: data.id,
              email: data.email,
              name: data.name,
              company: data.company,
              teamSize: data.team_size,
              status: data.status,
              signupDate: data.created_at,
              notes: data.notes,
            },
          }),
        };
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }
  }

  // Fallback to in-memory
  const testerIndex = betaTesters.findIndex(t => t.email === email);
  if (testerIndex === -1) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Beta tester not found',
      }),
    };
  }

  betaTesters[testerIndex] = {
    ...betaTesters[testerIndex],
    status,
    notes: notes || betaTesters[testerIndex].notes,
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Status updated successfully',
      data: betaTesters[testerIndex],
    }),
  };
}

async function handleUpdateTester(body: string | null) {
  const { email, name, company, teamSize, notes } = JSON.parse(body || '{}');

  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Email is required',
      }),
    };
  }

  const testerIndex = betaTesters.findIndex(t => t.email === email);
  if (testerIndex === -1) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Beta tester not found',
      }),
    };
  }

  betaTesters[testerIndex] = {
    ...betaTesters[testerIndex],
    ...(name && { name }),
    ...(company && { company }),
    ...(teamSize && { teamSize }),
    ...(notes && { notes }),
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Tester updated successfully',
      data: betaTesters[testerIndex],
    }),
  };
}

async function handleRemoveTester(queryParams: any) {
  const email = queryParams?.email;

  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Email is required',
      }),
    };
  }

  const testerIndex = betaTesters.findIndex(t => t.email === email);
  if (testerIndex === -1) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Beta tester not found',
      }),
    };
  }

  const removedTester = betaTesters.splice(testerIndex, 1)[0];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Tester removed successfully',
      data: removedTester,
    }),
  };
}

export { handler };