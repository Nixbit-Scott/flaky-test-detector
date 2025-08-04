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

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  rating?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  message: string;
  page: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  organizationId?: string;
}

interface FeedbackTrigger {
  id: string;
  type: 'contextual' | 'timed' | 'action-based';
  condition: string;
  message: string;
  delay?: number;
}

// In-memory storage for feedback (fallback when no database)
let feedbackStore: Array<{
  id: string;
  feedback: FeedbackData;
  trigger?: FeedbackTrigger;
  submittedAt: string;
}> = [];

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
    const path = event.path.replace('/.netlify/functions/feedback', '') || '/';
    
    switch (event.httpMethod) {
      case 'POST':
        if (path === '/' || path === '/submit') {
          return await handleSubmitFeedback(event);
        }
        break;
      case 'GET':
        if (path === '/list') {
          return await handleGetFeedback(event);
        } else if (path === '/analytics') {
          return await handleFeedbackAnalytics(event);
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
    console.error('Feedback error:', error);
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

async function handleSubmitFeedback(event: HandlerEvent) {
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
        // Continue without user info if token is invalid
        console.warn('Invalid token for feedback submission');
      }
    }

    const { feedback, trigger } = JSON.parse(event.body || '{}');

    if (!feedback || !feedback.message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Feedback message is required',
        }),
      };
    }

    // Validate feedback data
    const validTypes = ['bug', 'feature', 'improvement', 'general'];
    if (!validTypes.includes(feedback.type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid feedback type',
        }),
      };
    }

    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const submittedAt = new Date().toISOString();

    const feedbackRecord = {
      id: feedbackId,
      feedback: {
        ...feedback,
        userId: userInfo?.id || feedback.userId,
        organizationId: userInfo?.organizationId || feedback.organizationId,
        timestamp: submittedAt,
      },
      trigger,
      submittedAt,
    };

    // Try to store in Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('beta_feedback')
          .insert([
            {
              id: feedbackId,
              user_id: feedbackRecord.feedback.userId,
              organization_id: feedbackRecord.feedback.organizationId,
              type: feedbackRecord.feedback.type,
              rating: feedbackRecord.feedback.rating,
              sentiment: feedbackRecord.feedback.sentiment,
              message: feedbackRecord.feedback.message,
              page: feedbackRecord.feedback.page,
              user_agent: feedbackRecord.feedback.userAgent,
              trigger_id: trigger?.id,
              trigger_type: trigger?.type,
              trigger_condition: trigger?.condition,
              submitted_at: submittedAt,
              metadata: {
                trigger: trigger,
                environment: process.env.VITE_ENVIRONMENT || 'production',
              },
            }
          ]);

        if (!error) {
          console.log('Feedback stored in Supabase:', feedbackId);
        } else {
          console.error('Failed to store feedback in Supabase:', error);
          // Fall back to in-memory storage
          feedbackStore.push(feedbackRecord);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Fall back to in-memory storage
        feedbackStore.push(feedbackRecord);
      }
    } else {
      // Store in memory
      feedbackStore.push(feedbackRecord);
    }

    // Send notification to admin (in a real implementation)
    if (feedback.type === 'bug' || feedback.sentiment === 'negative') {
      console.log(`High-priority feedback received: ${feedbackId}`);
      // TODO: Send email/Slack notification to team
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          id: feedbackId,
          submittedAt,
        },
      }),
    };

  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to submit feedback',
      }),
    };
  }
}

async function handleGetFeedback(event: HandlerEvent) {
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
  const adminEmails = ['admin@nixbit.dev', 'scott@nixbit.dev'];
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
    let feedbackData = feedbackStore;

    // Try to get from Supabase if available
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('beta_feedback')
          .select('*')
          .order('submitted_at', { ascending: false })
          .limit(100);

        if (!error && data) {
          feedbackData = data.map((row: any) => ({
            id: row.id,
            feedback: {
              type: row.type,
              rating: row.rating,
              sentiment: row.sentiment,
              message: row.message,
              page: row.page,
              userAgent: row.user_agent,
              timestamp: row.submitted_at,
              userId: row.user_id,
              organizationId: row.organization_id,
            },
            trigger: row.metadata?.trigger,
            submittedAt: row.submitted_at,
          }));
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Use in-memory data as fallback
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: feedbackData,
        total: feedbackData.length,
      }),
    };

  } catch (error: any) {
    console.error('Error getting feedback:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to get feedback',
      }),
    };
  }
}

async function handleFeedbackAnalytics(event: HandlerEvent) {
  // Similar authentication as above
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
    let feedbackData = feedbackStore;

    // Get from Supabase if available
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('beta_feedback')
          .select('type, sentiment, rating, submitted_at, trigger_type')
          .order('submitted_at', { ascending: false });

        if (!error && data) {
          feedbackData = data.map((row: any) => ({
            feedback: {
              type: row.type,
              sentiment: row.sentiment,
              rating: row.rating,
            },
            trigger: { type: row.trigger_type },
            submittedAt: row.submitted_at,
          }));
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    // Calculate analytics
    const analytics = {
      total: feedbackData.length,
      byType: {
        bug: feedbackData.filter(f => f.feedback.type === 'bug').length,
        feature: feedbackData.filter(f => f.feedback.type === 'feature').length,
        improvement: feedbackData.filter(f => f.feedback.type === 'improvement').length,
        general: feedbackData.filter(f => f.feedback.type === 'general').length,
      },
      bySentiment: {
        positive: feedbackData.filter(f => f.feedback.sentiment === 'positive').length,
        neutral: feedbackData.filter(f => f.feedback.sentiment === 'neutral').length,
        negative: feedbackData.filter(f => f.feedback.sentiment === 'negative').length,
      },
      averageRating: feedbackData
        .filter(f => f.feedback.rating)
        .reduce((sum, f) => sum + (f.feedback.rating || 0), 0) / 
        feedbackData.filter(f => f.feedback.rating).length || 0,
      byTrigger: {
        contextual: feedbackData.filter(f => f.trigger?.type === 'contextual').length,
        timed: feedbackData.filter(f => f.trigger?.type === 'timed').length,
        actionBased: feedbackData.filter(f => f.trigger?.type === 'action-based').length,
        manual: feedbackData.filter(f => !f.trigger).length,
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
    console.error('Error getting feedback analytics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to get feedback analytics',
      }),
    };
  }
}

export { handler };