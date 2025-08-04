import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

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

interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'ui' | 'functionality' | 'performance' | 'data' | 'other';
  reproductionSteps: string;
  expectedBehavior: string;
  actualBehavior: string;
  environment: any;
  consoleLog?: string;
  networkLog?: string;
  userId?: string;
  organizationId?: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  submittedAt: string;
  assignedTo?: string;
  screenshots?: string[];
}

// In-memory storage for bug reports (fallback when no database)
let bugReportsStore: BugReport[] = [];

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
    const path = event.path.replace('/.netlify/functions/bug-report', '') || '/';
    
    switch (event.httpMethod) {
      case 'POST':
        if (path === '/' || path === '/submit') {
          return await handleSubmitBugReport(event);
        }
        break;
      case 'GET':
        if (path === '/list') {
          return await handleGetBugReports(event);
        } else if (path.startsWith('/report/')) {
          const reportId = path.replace('/report/', '');
          return await handleGetBugReport(event, reportId);
        }
        break;
      case 'PUT':
        if (path.startsWith('/report/')) {
          const reportId = path.replace('/report/', '');
          return await handleUpdateBugReport(event, reportId);
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
    console.error('Bug report error:', error);
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

async function handleSubmitBugReport(event: HandlerEvent) {
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
        console.warn('Invalid token for bug report submission');
      }
    }

    // Parse multipart form data for file uploads
    let bugReportData: any;
    let screenshots: string[] = [];

    // Handle different content types
    if (event.headers['content-type']?.includes('multipart/form-data')) {
      // This is a simplified approach - in a real implementation, you'd need
      // to properly handle multipart form data in serverless functions
      const body = event.body;
      if (body) {
        const decoded = event.isBase64Encoded ? Buffer.from(body, 'base64').toString() : body;
        // Extract JSON data from form (simplified parsing)
        const bugReportMatch = decoded.match(/Content-Disposition: form-data; name="bugReport"[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/);
        if (bugReportMatch) {
          bugReportData = JSON.parse(bugReportMatch[1]);
        }
        
        // Handle screenshot uploads (simplified)
        // In a real implementation, you'd properly parse the multipart data
        // and upload files to cloud storage
        screenshots = []; // Placeholder for actual file handling
      }
    } else {
      // Handle JSON payload
      const { bugReport } = JSON.parse(event.body || '{}');
      bugReportData = bugReport;
    }

    if (!bugReportData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Bug report data is required',
        }),
      };
    }

    // Validate required fields
    if (!bugReportData.title || !bugReportData.description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Title and description are required',
        }),
      };
    }

    const reportId = `bug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const submittedAt = new Date().toISOString();

    const bugReport: BugReport = {
      id: reportId,
      title: bugReportData.title,
      description: bugReportData.description,
      severity: bugReportData.severity || 'medium',
      category: bugReportData.category || 'functionality',
      reproductionSteps: bugReportData.reproductionSteps || '',
      expectedBehavior: bugReportData.expectedBehavior || '',
      actualBehavior: bugReportData.actualBehavior || '',
      environment: bugReportData.environment,
      consoleLog: bugReportData.consoleLog,
      networkLog: bugReportData.networkLog,
      userId: userInfo?.id || bugReportData.userId,
      organizationId: userInfo?.organizationId || bugReportData.organizationId,
      status: 'open',
      priority: mapSeverityToPriority(bugReportData.severity || 'medium'),
      submittedAt,
      screenshots,
    };

    // Try to store in Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('bug_reports')
          .insert([
            {
              id: reportId,
              title: bugReport.title,
              description: bugReport.description,
              severity: bugReport.severity,
              category: bugReport.category,
              reproduction_steps: bugReport.reproductionSteps,
              expected_behavior: bugReport.expectedBehavior,
              actual_behavior: bugReport.actualBehavior,
              environment: bugReport.environment,
              console_log: bugReport.consoleLog,
              network_log: bugReport.networkLog,
              user_id: bugReport.userId,
              organization_id: bugReport.organizationId,
              status: bugReport.status,
              priority: bugReport.priority,
              submitted_at: submittedAt,
              screenshots: screenshots,
              metadata: {
                userAgent: bugReport.environment?.userAgent,
                url: bugReport.environment?.url,
                viewport: bugReport.environment?.viewport,
              },
            }
          ]);

        if (!error) {
          console.log('Bug report stored in Supabase:', reportId);
        } else {
          console.error('Failed to store bug report in Supabase:', error);
          // Fall back to in-memory storage
          bugReportsStore.push(bugReport);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Fall back to in-memory storage
        bugReportsStore.push(bugReport);
      }
    } else {
      // Store in memory
      bugReportsStore.push(bugReport);
    }

    // Send notification for high-priority bugs
    if (bugReport.severity === 'high' || bugReport.severity === 'critical') {
      console.log(`High-priority bug report received: ${reportId} - ${bugReport.title}`);
      // TODO: Send email/Slack notification to development team
      await sendBugNotification(bugReport);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Bug report submitted successfully',
        data: {
          id: reportId,
          status: 'submitted',
          submittedAt,
          estimatedResponse: getEstimatedResponseTime(bugReport.severity),
        },
      }),
    };

  } catch (error: any) {
    console.error('Error submitting bug report:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to submit bug report',
      }),
    };
  }
}

async function handleGetBugReports(event: HandlerEvent) {
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

  try {
    let bugReports = bugReportsStore;

    // Try to get from Supabase if available
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('bug_reports')
          .select('*')
          .order('submitted_at', { ascending: false })
          .limit(100);

        if (!error && data) {
          bugReports = data.map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            severity: row.severity,
            category: row.category,
            reproductionSteps: row.reproduction_steps,
            expectedBehavior: row.expected_behavior,
            actualBehavior: row.actual_behavior,
            environment: row.environment,
            consoleLog: row.console_log,
            networkLog: row.network_log,
            userId: row.user_id,
            organizationId: row.organization_id,
            status: row.status,
            priority: row.priority,
            submittedAt: row.submitted_at,
            assignedTo: row.assigned_to,
            screenshots: row.screenshots || [],
          }));
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Use in-memory data as fallback
      }
    }

    // Calculate statistics
    const stats = {
      total: bugReports.length,
      byStatus: {
        open: bugReports.filter(r => r.status === 'open').length,
        inProgress: bugReports.filter(r => r.status === 'in-progress').length,
        resolved: bugReports.filter(r => r.status === 'resolved').length,
        closed: bugReports.filter(r => r.status === 'closed').length,
      },
      bySeverity: {
        low: bugReports.filter(r => r.severity === 'low').length,
        medium: bugReports.filter(r => r.severity === 'medium').length,
        high: bugReports.filter(r => r.severity === 'high').length,
        critical: bugReports.filter(r => r.severity === 'critical').length,
      },
      byCategory: {
        ui: bugReports.filter(r => r.category === 'ui').length,
        functionality: bugReports.filter(r => r.category === 'functionality').length,
        performance: bugReports.filter(r => r.category === 'performance').length,
        data: bugReports.filter(r => r.category === 'data').length,
        other: bugReports.filter(r => r.category === 'other').length,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          reports: bugReports,
          stats,
          total: bugReports.length,
        },
      }),
    };

  } catch (error: any) {
    console.error('Error getting bug reports:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to get bug reports',
      }),
    };
  }
}

async function handleGetBugReport(event: HandlerEvent, reportId: string) {
  const report = bugReportsStore.find(r => r.id === reportId);
  
  if (!report) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Bug report not found',
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: report,
    }),
  };
}

async function handleUpdateBugReport(event: HandlerEvent, reportId: string) {
  // Admin authentication would be required here
  const { status, assignedTo, priority, notes } = JSON.parse(event.body || '{}');

  const reportIndex = bugReportsStore.findIndex(r => r.id === reportId);
  if (reportIndex === -1) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Bug report not found',
      }),
    };
  }

  // Update the report
  if (status) bugReportsStore[reportIndex].status = status;
  if (assignedTo) bugReportsStore[reportIndex].assignedTo = assignedTo;
  if (priority) bugReportsStore[reportIndex].priority = priority;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Bug report updated successfully',
      data: bugReportsStore[reportIndex],
    }),
  };
}

// Helper functions
function mapSeverityToPriority(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  const mapping: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    critical: 'critical',
  };
  return mapping[severity] || 'medium';
}

function getEstimatedResponseTime(severity: string): string {
  const responseTimes: Record<string, string> = {
    critical: '1-2 hours',
    high: '4-8 hours',
    medium: '1-2 days',
    low: '3-5 days',
  };
  return responseTimes[severity] || '1-2 days';
}

async function sendBugNotification(bugReport: BugReport) {
  // In a real implementation, send notifications via:
  // - Email to development team
  // - Slack webhook
  // - Create GitHub issue
  // - Update project management tools
  
  console.log(`Bug notification sent for: ${bugReport.id} - ${bugReport.title}`);
  console.log(`Severity: ${bugReport.severity}, Category: ${bugReport.category}`);
  
  // TODO: Implement actual notification sending
  // Example:
  // await sendSlackMessage({
  //   channel: '#bug-reports',
  //   text: `🐛 New ${bugReport.severity} bug report: ${bugReport.title}`,
  //   attachments: [{
  //     color: getSeverityColor(bugReport.severity),
  //     fields: [
  //       { title: 'Reporter', value: bugReport.userId, short: true },
  //       { title: 'Category', value: bugReport.category, short: true },
  //       { title: 'Description', value: bugReport.description },
  //     ],
  //   }],
  // });
}

export { handler };