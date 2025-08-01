import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'Method not allowed',
      }),
    };
  }

  try {
    // Extract the path to determine which analytics endpoint to handle
    const path = event.path.replace('/.netlify/functions/analytics', '') || '/dashboard';
    console.log('Analytics path:', path, 'Full path:', event.path);
    
    // For now, let's return mock data without authentication to test the basic functionality
    // This can be re-enabled once we confirm the endpoint is working
    
    // Handle different analytics endpoints
    if (path === '/dashboard' || path === '' || path === '/') {
      const summary = getMockDashboardSummary();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          summary,
          userId: 'mock-user',
          generatedAt: new Date().toISOString(),
        }),
      };
    }

    // Handle project-specific analytics  
    const projectMatch = path.match(/^\/project\/(.+)$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const days = parseInt(event.queryStringParameters?.days || '30');
      const analytics = await getProjectAnalytics(projectId, days);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          analytics,
          period: `${days} days`,
          generatedAt: new Date().toISOString(),
        }),
      };
    }

    // Default fallback - return dashboard data for any unmatched path
    const summary = getMockDashboardSummary();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary,
        userId: 'mock-user',
        generatedAt: new Date().toISOString(),
        debug: {
          path,
          originalPath: event.path,
          method: event.httpMethod,
        },
      }),
    };

  } catch (error: any) {
    console.error('Analytics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

async function getDashboardSummary(userId: string) {
  // If Supabase is not available, return mock data
  if (!supabase) {
    return getMockDashboardSummary();
  }

  try {
    // Get user's projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        created_at,
        test_runs(count),
        flaky_test_patterns(count)
      `)
      .eq('user_id', userId);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return getMockDashboardSummary();
    }

    const totalProjects = projects?.length || 0;
    const totalTestRuns = projects?.reduce((sum: number, p: any) => sum + (p.test_runs?.length || 0), 0) || 0;
    const totalFlakyTests = projects?.reduce((sum: number, p: any) => sum + (p.flaky_test_patterns?.length || 0), 0) || 0;

    // Calculate worst projects (simplified)
    const worstProjects = projects?.slice(0, 5).map((p: any) => ({
      id: p.id,
      name: p.name,
      flakyTestCount: p.flaky_test_patterns?.length || 0,
      healthScore: calculateHealthScore(p.test_runs?.length || 0, p.flaky_test_patterns?.length || 0),
    })) || [];

    return {
      totalProjects,
      totalTestRuns,
      totalFlakyTests,
      worstProjects,
      recentActivity: [],
      averageStability: totalTestRuns > 0 ? Math.max(0, 100 - (totalFlakyTests / totalTestRuns * 100)) : 100,
      weeklyTrend: 0,
      projects: worstProjects.map((p: any) => ({
        id: p.id,
        name: p.name,
        totalTestRuns: 0,
        flakyTests: p.flakyTestCount,
        testStability: p.healthScore,
      })),
    };

  } catch (error) {
    console.error('Database error:', error);
    return getMockDashboardSummary();
  }
}

async function getProjectAnalytics(projectId: string, days: number) {
  // Return mock analytics for now
  return {
    overview: {
      totalTestRuns: 150,
      totalTests: 45,
      flakyTests: 3,
      averageFailureRate: 6.7,
      testStability: 93.3,
      lastAnalysis: new Date().toISOString(),
    },
    trends: {
      testRuns: [],
      failureRates: [],
      flakyTestsDetected: [],
      retrySuccess: [],
    },
    distribution: {
      testsByStatus: [
        { status: 'passed', count: 42, percentage: 93.3 },
        { status: 'failed', count: 3, percentage: 6.7 },
      ],
      testsBySuite: [],
      failuresByPattern: [],
    },
    insights: {
      mostFlakyTests: [],
      slowestTests: [],
      recentlyFixed: [],
    },
    health: {
      score: 93.3,
      trend: 'stable',
      issues: [],
    },
  };
}

function getMockDashboardSummary() {
  return {
    totalProjects: 3,
    totalTestRuns: 450,
    totalFlakyTests: 12,
    averageStability: 87.5,
    weeklyTrend: 2.3,
    worstProjects: [
      {
        id: 'mock-1',
        name: 'Sample Project 1',
        flakyTestCount: 5,
        healthScore: 85,
      },
      {
        id: 'mock-2',
        name: 'Sample Project 2',
        flakyTestCount: 3,
        healthScore: 90,
      },
      {
        id: 'mock-3',
        name: 'Sample Project 3',
        flakyTestCount: 4,
        healthScore: 88,
      },
    ],
    recentActivity: [],
    projects: [
      {
        id: 'mock-1',
        name: 'Sample Project 1',
        totalTestRuns: 150,
        flakyTests: 5,
        testStability: 85,
      },
      {
        id: 'mock-2',
        name: 'Sample Project 2',
        totalTestRuns: 200,
        flakyTests: 3,
        testStability: 90,
      },
      {
        id: 'mock-3',
        name: 'Sample Project 3',
        totalTestRuns: 100,
        flakyTests: 4,
        testStability: 88,
      },
    ],
  };
}

function calculateHealthScore(testRuns: number, flakyTests: number): number {
  if (testRuns === 0) return 100;
  const flakyRate = flakyTests / testRuns;
  return Math.max(0, Math.round((1 - flakyRate) * 100));
}

export { handler };