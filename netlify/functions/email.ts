import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Email service configuration
const EMAIL_CONFIG = {
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'noreply@nixbit.dev',
    fromName: process.env.FROM_NAME || 'Nixbit Flaky Test Detector',
  },
  postmark: {
    serverToken: process.env.POSTMARK_SERVER_TOKEN,
    fromEmail: process.env.FROM_EMAIL || 'noreply@nixbit.dev',
  },
  ses: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    fromEmail: process.env.FROM_EMAIL || 'noreply@nixbit.dev',
  }
};

// Email templates
const EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to Nixbit Flaky Test Detector',
    html: (data: { name: string; email: string }) => `
      <h1>Welcome to Nixbit, ${data.name}!</h1>
      <p>Thank you for signing up for Flaky Test Detector. We're excited to help you eliminate flaky tests from your CI/CD pipeline.</p>
      <h2>Getting Started</h2>
      <ol>
        <li>Connect your CI/CD system (GitHub Actions, GitLab CI, or Jenkins)</li>
        <li>Configure webhook endpoints to receive test results</li>
        <li>Set up retry logic for detected flaky tests</li>
      </ol>
      <p>If you need help, our documentation is available at <a href="https://nixbit.dev/docs">nixbit.dev/docs</a></p>
      <p>Best regards,<br>The Nixbit Team</p>
    `,
  },
  passwordReset: {
    subject: 'Reset Your Nixbit Password',
    html: (data: { name: string; resetLink: string }) => `
      <h1>Password Reset Request</h1>
      <p>Hi ${data.name},</p>
      <p>You requested a password reset for your Nixbit account. Click the link below to reset your password:</p>
      <p><a href="${data.resetLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
      <p>This link will expire in 1 hour. If you didn't request this reset, please ignore this email.</p>
      <p>Best regards,<br>The Nixbit Team</p>
    `,
  },
  betaWelcome: {
    subject: '🎉 Welcome to Nixbit Beta Program!',
    html: (data: { name: string; email: string; company: string; teamSize: string }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">🎉 Welcome to the Nixbit Beta Program!</h1>
        
        <p>Hi ${data.name || 'there'},</p>
        
        <p>Thank you for signing up for early access to <strong>Nixbit's Flaky Test Detector</strong>! We're excited to have you join our exclusive beta program.</p>
        
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1d4ed8; margin-top: 0;">📋 Your Application Details</h3>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Company:</strong> ${data.company || 'Not provided'}</p>
          <p><strong>Team Size:</strong> ${data.teamSize || 'Not specified'}</p>
        </div>
        
        <h3>🔍 What Happens Next?</h3>
        <ol>
          <li><strong>Review Process:</strong> I'll personally review your application within 24 hours</li>
          <li><strong>Access Credentials:</strong> If approved, you'll receive login credentials and setup instructions</li>
          <li><strong>Personal Onboarding:</strong> I'll help you integrate with your CI/CD pipeline</li>
          <li><strong>Direct Support:</strong> You'll have direct email access to me throughout the beta</li>
        </ol>
        
        <h3>💡 Beta Program Benefits</h3>
        <ul>
          <li>🆓 Free access to the full platform</li>
          <li>🎯 Direct input on product development</li>
          <li>💰 50% discount when we launch publicly</li>
          <li>📞 Weekly feedback calls (optional)</li>
        </ul>
        
        <p>Questions? Just reply to this email - it comes directly to me!</p>
        
        <p>Best regards,<br>
        <strong>Scott Sanderson</strong><br>
        Founder, Nixbit<br>
        <a href="mailto:scott@nixbit.dev">scott@nixbit.dev</a></p>
      </div>
    `,
  },
  betaAdminNotification: {
    subject: '🚨 New Beta Program Signup',
    html: (data: { name: string; email: string; company: string; teamSize: string; role: string; motivation: string; primaryUsage: string; availableTime: string }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">🚨 New Beta Signup Alert</h1>
        
        <p>A new user has signed up for the beta program!</p>
        
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">👤 Applicant Details</h3>
          <p><strong>Name:</strong> ${data.name || 'Not provided'}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Company:</strong> ${data.company || 'Not provided'}</p>
          <p><strong>Role:</strong> ${data.role || 'Not provided'}</p>
          <p><strong>Team Size:</strong> ${data.teamSize || 'Not provided'}</p>
          <p><strong>CI/CD System:</strong> ${data.primaryUsage || 'Not provided'}</p>
          <p><strong>Time Commitment:</strong> ${data.availableTime || 'Not provided'}</p>
        </div>
        
        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="color: #92400e; margin-top: 0;">💭 Their Motivation:</h4>
          <p style="font-style: italic;">"${data.motivation || 'No motivation provided'}"</p>
        </div>
        
        <h3>🎯 Next Steps:</h3>
        <ol>
          <li><strong><a href="${process.env.ADMIN_URL || 'https://nixbit.dev/admin'}/beta-management">Review in Admin Dashboard</a></strong></li>
          <li><strong>Create demo account</strong> (use existing demo credentials)</li>
          <li><strong>Send personal welcome email</strong> with access details</li>
        </ol>
        
        <p><em>This is an automated notification from the Nixbit Beta Program.</em></p>
      </div>
    `,
  },
  flakyTestAlert: {
    subject: 'Flaky Test Detected',
    html: (data: { projectName: string; testName: string; failureRate: number; dashboardLink: string }) => `
      <h1>Flaky Test Alert</h1>
      <p>A flaky test has been detected in your project <strong>${data.projectName}</strong>:</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p><strong>Test:</strong> ${data.testName}</p>
        <p><strong>Failure Rate:</strong> ${data.failureRate}%</p>
      </div>
      <p><a href="${data.dashboardLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View in Dashboard</a></p>
      <p>Consider enabling automatic retries for this test to reduce CI/CD pipeline failures.</p>
    `,
  },
};

// Validation schemas
const emailSchema = z.object({
  to: z.string().email(),
  template: z.enum(['welcome', 'passwordReset', 'flakyTestAlert', 'betaWelcome', 'betaAdminNotification']),
  data: z.record(z.any()),
  provider: z.enum(['sendgrid', 'postmark', 'ses']).optional(),
});

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { to, template, data, provider = 'sendgrid' } = emailSchema.parse(body);

    const emailTemplate = EMAIL_TEMPLATES[template];
    if (!emailTemplate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email template' }),
      };
    }

    const emailData = {
      to,
      subject: emailTemplate.subject,
      html: emailTemplate.html(data),
    };

    let result;
    switch (provider) {
      case 'sendgrid':
        result = await sendWithSendGrid(emailData);
        break;
      case 'postmark':
        result = await sendWithPostmark(emailData);
        break;
      case 'ses':
        result = await sendWithSES(emailData);
        break;
      default:
        throw new Error('Invalid email provider');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: result.messageId,
        provider,
      }),
    };

  } catch (error) {
    console.error('Email sending error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send email',
      }),
    };
  }
};

async function sendWithSendGrid(emailData: { to: string; subject: string; html: string }) {
  const { apiKey, fromEmail, fromName } = EMAIL_CONFIG.sendgrid;
  
  if (!apiKey) {
    throw new Error('SendGrid API key not configured');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: emailData.to }],
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: emailData.subject,
      content: [
        {
          type: 'text/html',
          value: emailData.html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${error}`);
  }

  return { messageId: response.headers.get('x-message-id') || 'unknown' };
}

async function sendWithPostmark(emailData: { to: string; subject: string; html: string }) {
  const { serverToken, fromEmail } = EMAIL_CONFIG.postmark;
  
  if (!serverToken) {
    throw new Error('Postmark server token not configured');
  }

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': serverToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      From: fromEmail,
      To: emailData.to,
      Subject: emailData.subject,
      HtmlBody: emailData.html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Postmark API error: ${error}`);
  }

  const result = await response.json();
  return { messageId: result.MessageID };
}

async function sendWithSES(emailData: { to: string; subject: string; html: string }) {
  // AWS SES implementation would require AWS SDK
  // For now, return a placeholder
  throw new Error('AWS SES integration not implemented yet');
}