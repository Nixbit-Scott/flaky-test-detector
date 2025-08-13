import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check if SendGrid API key is configured
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'noreply@nixbit.dev';
  const fromName = process.env.FROM_NAME || 'Nixbit Flaky Test Detector';

  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'SendGrid API key not configured',
        message: 'Please set SENDGRID_API_KEY environment variable in Netlify',
        envCheck: {
          hasApiKey: false,
          fromEmail,
          fromName,
        }
      }),
    };
  }

  // For GET requests, just return the configuration status
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'SendGrid configured',
        envCheck: {
          hasApiKey: true,
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
          fromEmail,
          fromName,
        }
      }),
    };
  }

  // For POST requests, send a test email
  try {
    const body = JSON.parse(event.body || '{}');
    const testEmail = body.email || 'scott@nixbit.dev';
    
    const emailData = {
      personalizations: [
        {
          to: [{ email: testEmail }],
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: `Test Email from Nixbit - ${new Date().toISOString()}`,
      content: [
        {
          type: 'text/html',
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">SendGrid Test Email</h1>
              <p>This is a test email sent from your Netlify Functions endpoint.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3>Configuration Details:</h3>
                <ul>
                  <li><strong>From Email:</strong> ${fromEmail}</li>
                  <li><strong>From Name:</strong> ${fromName}</li>
                  <li><strong>Sent To:</strong> ${testEmail}</li>
                  <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
                  <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</li>
                </ul>
              </div>
              <p>If you received this email, your SendGrid integration is working correctly!</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
              <p style="color: #666; font-size: 12px;">
                This is an automated test email from Nixbit Flaky Test Detector.
              </p>
            </div>
          `,
        },
      ],
    };

    console.log('Sending test email to:', testEmail);
    console.log('Using SendGrid API endpoint: https://api.sendgrid.com/v3/mail/send');

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const responseText = await response.text();
    console.log('SendGrid Response Status:', response.status);
    console.log('SendGrid Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error('SendGrid API error:', responseText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'SendGrid API error',
          status: response.status,
          details: responseText ? JSON.parse(responseText) : 'No error details',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        messageId: response.headers.get('x-message-id') || 'unknown',
        details: {
          to: testEmail,
          from: fromEmail,
          timestamp: new Date().toISOString(),
        }
      }),
    };

  } catch (error) {
    console.error('Error sending test email:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to send test email',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
    };
  }
};