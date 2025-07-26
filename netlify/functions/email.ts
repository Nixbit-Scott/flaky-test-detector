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
  template: z.enum(['welcome', 'passwordReset', 'flakyTestAlert']),
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