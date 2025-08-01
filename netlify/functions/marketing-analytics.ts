import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import jwt from 'jsonwebtoken';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Import signups from marketing-signup.ts - they need to share the same data store
// For now, we'll create a simple solution by using the same pattern
// In production, this would use a shared database

// Marketing analytics data store with proper initialization
let signups: Array<{
  id: string;
  email: string;
  name?: string;
  company?: string;
  teamSize?: string;
  currentPainPoints?: string[];
  interestedFeatures?: string[];
  source?: string;
  utmParameters?: Record<string, string>;
  createdAt: string;
}> = [];

// Initialize flag to prevent multiple initializations
let isInitialized = false;

// Initialize with some sample data for demo purposes
function initializeSampleData() {
  if (isInitialized || signups.length > 0) {
    return; // Already initialized
  }
  
  isInitialized = true;
    const now = new Date();
    const sampleSignups = [
      {
        id: 'sample_1',
        email: 'demo@example.com',
        company: 'Demo Corp',
        source: 'footer-newsletter',
        utmParameters: { utm_source: 'website', utm_medium: 'footer', utm_campaign: 'newsletter' },
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      },
      {
        id: 'sample_2',
        email: 'test@startup.io',
        company: 'Startup Inc',
        source: 'homepage',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      },
      {
        id: 'sample_3',
        email: 'user@techco.com',
        source: 'social',
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      }
    ];
    signups.push(...sampleSignups);
}

// Admin users (should match auth.ts)
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

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed',
      }),
    };
  }

  try {
    // Initialize sample data for demo
    initializeSampleData();

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

    // Calculate analytics
    const now = new Date();
    const analytics = calculateSignupAnalytics(signups, now);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: analytics,
      }),
    };

  } catch (error: any) {
    console.error('Marketing analytics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to fetch analytics',
      }),
    };
  }
};

function calculateSignupAnalytics(signups: any[], now: Date) {
  // Time period calculations
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Filter signups by time period
  const weeklySignups = signups.filter(s => new Date(s.createdAt) >= oneWeekAgo);
  const monthlySignups = signups.filter(s => new Date(s.createdAt) >= oneMonthAgo);
  const yearlySignups = signups.filter(s => new Date(s.createdAt) >= oneYearAgo);

  // Calculate daily signups for the last 30 days
  const dailySignups = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    
    const daySignups = signups.filter(s => {
      const signupDate = new Date(s.createdAt);
      return signupDate >= startOfDay && signupDate < endOfDay;
    });

    dailySignups.push({
      date: startOfDay.toISOString().split('T')[0],
      count: daySignups.length,
    });
  }

  // Calculate weekly signups for the last 12 weeks
  const weeklyData = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    
    const weekSignups = signups.filter(s => {
      const signupDate = new Date(s.createdAt);
      return signupDate >= weekStart && signupDate < weekEnd;
    });

    weeklyData.push({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      count: weekSignups.length,
    });
  }

  // Calculate monthly signups for the last 12 months
  const monthlyData = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    const monthSignups = signups.filter(s => {
      const signupDate = new Date(s.createdAt);
      return signupDate >= monthStart && signupDate < monthEnd;
    });

    monthlyData.push({
      month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
      monthName: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      count: monthSignups.length,
    });
  }

  // Source analysis
  const sourceBreakdown = signups.reduce((acc: Record<string, number>, signup) => {
    const source = signup.source || 'unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});

  // Growth rates
  const prevWeekStart = new Date(oneWeekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekSignups = signups.filter(s => {
    const date = new Date(s.createdAt);
    return date >= prevWeekStart && date < oneWeekAgo;
  });

  const prevMonthStart = new Date(oneMonthAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prevMonthSignups = signups.filter(s => {
    const date = new Date(s.createdAt);
    return date >= prevMonthStart && date < oneMonthAgo;
  });

  const weeklyGrowthRate = prevWeekSignups.length > 0 
    ? ((weeklySignups.length - prevWeekSignups.length) / prevWeekSignups.length) * 100 
    : weeklySignups.length > 0 ? 100 : 0;

  const monthlyGrowthRate = prevMonthSignups.length > 0 
    ? ((monthlySignups.length - prevMonthSignups.length) / prevMonthSignups.length) * 100 
    : monthlySignups.length > 0 ? 100 : 0;

  return {
    summary: {
      total: signups.length,
      thisWeek: weeklySignups.length,
      thisMonth: monthlySignups.length,
      thisYear: yearlySignups.length,
      weeklyGrowthRate: Math.round(weeklyGrowthRate * 100) / 100,
      monthlyGrowthRate: Math.round(monthlyGrowthRate * 100) / 100,
    },
    trends: {
      daily: dailySignups,
      weekly: weeklyData,
      monthly: monthlyData,
    },
    sources: sourceBreakdown,
    recentSignups: signups
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(s => ({
        email: s.email,
        source: s.source,
        company: s.company,
        createdAt: s.createdAt,
      })),
  };
}

export { handler };