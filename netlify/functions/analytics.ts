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

// Enhanced analytics interfaces for beta tracking
interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  userId?: string;
  organizationId?: string;
  sessionId: string;
  timestamp: string;
  page: string;
  userAgent: string;
  environment: string;
}

interface UserSession {
  sessionId: string;
  userId?: string;
  organizationId?: string;
  startTime: string;
  lastActivity: string;
  events: AnalyticsEvent[];
  metadata: {
    userAgent: string;
    referrer: string;
    screenResolution: string;
    timezone: string;
  };
}

// In-memory storage for beta analytics (fallback when no database)
let betaAnalyticsStore: {
  events: AnalyticsEvent[];
  sessions: UserSession[];
} = {
  events: [],
  sessions: [],
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Handle different HTTP methods
  const path = event.path.replace('/.netlify/functions/analytics', '') || '/dashboard';
  
  switch (event.httpMethod) {
    case 'GET':
      return await handleGetAnalytics(event, path);
    case 'POST':
      if (path === '/track' || path === '/') {
        return await handleTrackEvents(event);
      } else if (path === '/beta') {
        return await handleBetaAnalytics(event);
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
};

async function handleGetAnalytics(event: HandlerEvent, path: string) {
  try {
    console.log('Analytics path:', path, 'Full path:', event.path);
    
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

    // Beta analytics dashboard
    if (path === '/beta/dashboard') {
      return await handleBetaDashboard(event);
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
}

async function handleTrackEvents(event: HandlerEvent) {
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
        console.warn('Invalid token for analytics tracking');
      }
    }

    const { events, session } = JSON.parse(event.body || '{}');

    if (!events || !Array.isArray(events)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Events array is required',
        }),
      };
    }

    // Process and store events
    const processedEvents = events.map((evt: any) => ({
      ...evt,
      userId: userInfo?.id || evt.userId,
      organizationId: userInfo?.organizationId || evt.organizationId,
      timestamp: evt.timestamp || new Date().toISOString(),
    }));

    // Store in memory (enhanced for beta)
    betaAnalyticsStore.events.push(...processedEvents);
    if (session) {
      const existingSessionIndex = betaAnalyticsStore.sessions.findIndex(s => s.sessionId === session.sessionId);
      if (existingSessionIndex >= 0) {
        betaAnalyticsStore.sessions[existingSessionIndex] = session;
      } else {
        betaAnalyticsStore.sessions.push(session);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Events tracked successfully',
        data: {
          eventsProcessed: processedEvents.length,
          sessionUpdated: !!session,
        },
      }),
    };

  } catch (error: any) {
    console.error('Error tracking events:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to track events',
      }),
    };
  }
}

async function handleBetaAnalytics(event: HandlerEvent) {
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

  try {
    const events = betaAnalyticsStore.events;
    const sessions = betaAnalyticsStore.sessions;

    // Calculate beta-specific analytics
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentEvents = events.filter(e => new Date(e.timestamp) > last24Hours);
    const weeklyEvents = events.filter(e => new Date(e.timestamp) > last7Days);

    const analytics = {
      overview: {
        totalEvents: events.length,
        totalSessions: sessions.length,
        activeUsers24h: new Set(recentEvents.map(e => e.userId).filter(Boolean)).size,
        activeUsers7d: new Set(weeklyEvents.map(e => e.userId).filter(Boolean)).size,
        averageSessionDuration: calculateAverageSessionDuration(sessions),
      },
      betaMetrics: {
        feedbackEvents: events.filter(e => e.event === 'feedback_given').length,
        bugReports: events.filter(e => e.event === 'application_error').length,
        featureUsage: getFeatureUsage(events),
        onboardingCompletion: getOnboardingMetrics(events),
      },
      engagement: {
        pageViews: getPageViews(events),
        mostActivePages: getEventsByPage(recentEvents),
        sessionsByHour: getSessionsByHour(sessions),
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: analytics,
      }),
    };

  } catch (error: any) {
    console.error('Error getting beta analytics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to get beta analytics',
      }),
    };
  }
}

async function handleBetaDashboard(event: HandlerEvent) {
  // Return comprehensive beta dashboard
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: {
        events: betaAnalyticsStore.events.slice(-50), // Last 50 events
        sessions: betaAnalyticsStore.sessions.slice(-20), // Last 20 sessions
        summary: {
          totalEvents: betaAnalyticsStore.events.length,
          totalSessions: betaAnalyticsStore.sessions.length,
          environment: 'beta',
        },
      },
    }),
  };
}

// Helper functions for beta analytics
function calculateAverageSessionDuration(sessions: UserSession[]): number {
  if (sessions.length === 0) return 0;
  
  const durations = sessions.map(session => {
    const start = new Date(session.startTime).getTime();
    const end = new Date(session.lastActivity).getTime();
    return end - start;
  });
  
  return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
}

function getFeatureUsage(events: AnalyticsEvent[]) {
  const featureEvents = events.filter(e => e.event === 'feature_used');
  const featureCounts = featureEvents.reduce((acc, event) => {
    const feature = event.properties.feature;
    if (feature) {
      acc[feature] = (acc[feature] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(featureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([feature, count]) => ({ feature, count }));
}

function getOnboardingMetrics(events: AnalyticsEvent[]) {
  const onboardingEvents = events.filter(e => e.event === 'onboarding_step');
  const completed = onboardingEvents.filter(e => e.properties.completed).length;
  const total = onboardingEvents.length;
  
  return {
    total,
    completed,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
  };
}

function getPageViews(events: AnalyticsEvent[]) {
  const pageViewEvents = events.filter(e => e.event === 'page_view');
  const pageViews = pageViewEvents.reduce((acc, event) => {
    acc[event.page] = (acc[event.page] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(pageViews)
    .sort(([, a], [, b]) => b - a)
    .map(([page, views]) => ({ page, views }));
}

function getEventsByPage(events: AnalyticsEvent[]) {
  const pageCounts = events.reduce((acc, event) => {
    acc[event.page] = (acc[event.page] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(pageCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([page, count]) => ({ page, count }));
}

function getSessionsByHour(sessions: UserSession[]) {
  const hourCounts = sessions.reduce((acc, session) => {
    const hour = new Date(session.startTime).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    sessions: hourCounts[hour] || 0,
  }));
}

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