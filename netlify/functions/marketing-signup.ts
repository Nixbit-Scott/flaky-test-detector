import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Marketing signup schema - supports both general and beta signups
const MarketingSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  teamSize: z.enum(['1-5', '6-15', '16-50', '50+', '1-5 developers', '6-15 developers', '16-50 developers', '50+ developers']).optional(),
  currentPainPoints: z.array(z.string()).optional(),
  interestedFeatures: z.array(z.string()).optional(),
  primaryUsage: z.string().optional(),
  motivation: z.string().optional(),
  availableTime: z.string().optional(),
  referralSource: z.string().optional(),
  source: z.string().optional(),
  utmParameters: z.record(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

type MarketingSignupRequest = z.infer<typeof MarketingSignupSchema>;

// Simple in-memory store for demo (in production, use database)
let signups: Array<MarketingSignupRequest & { id: string; createdAt: string }> = [];

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Handle GET request for beta admin to fetch signups
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: signups.filter(signup => signup.source === 'beta-signup-page'),
        total: signups.filter(signup => signup.source === 'beta-signup-page').length,
      }),
    };
  }

  // Only allow POST for signup
  if (event.httpMethod !== 'POST') {
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
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = MarketingSignupSchema.parse(body);

    // Check if email already exists
    const existingSignup = signups.find(s => s.email === validatedData.email);
    if (existingSignup) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Thank you for your interest! We already have your information and will be in touch soon.',
          data: {
            id: existingSignup.id,
            email: existingSignup.email,
            createdAt: existingSignup.createdAt,
          },
        }),
      };
    }

    // Create new signup
    const signup = {
      ...validatedData,
      id: `signup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    signups.push(signup);

    // Log signup for debugging (in production, save to database)
    console.log('New marketing signup:', {
      email: signup.email,
      name: signup.name,
      company: signup.company,
      role: signup.role,
      teamSize: signup.teamSize,
      primaryUsage: signup.primaryUsage,
      source: signup.source,
      utmParameters: signup.utmParameters,
    });

    // Send automated emails for beta signups
    const isBetaSignup = validatedData.source === 'beta-signup-page';
    
    if (isBetaSignup) {
      try {
        // Get the site URL from environment or use production URL
        const siteUrl = process.env.URL || 'https://nixbit.dev';
        
        // Send welcome email to beta user
        const welcomeEmailResponse = await fetch(`${siteUrl}/.netlify/functions/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: signup.email,
            template: 'betaWelcome',
            data: {
              name: signup.name,
              email: signup.email,
              company: signup.company,
              teamSize: signup.teamSize,
            }
          })
        });

        // Send notification email to admin
        const adminEmailResponse = await fetch(`${siteUrl}/.netlify/functions/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: 'scott@nixbit.dev',
            template: 'betaAdminNotification',
            data: {
              name: signup.name,
              email: signup.email,
              company: signup.company,
              teamSize: signup.teamSize,
              role: signup.role,
              motivation: signup.motivation,
              primaryUsage: signup.primaryUsage,
              availableTime: signup.availableTime,
            }
          })
        });

        console.log('Beta signup emails sent:', {
          welcomeEmail: welcomeEmailResponse.ok,
          adminNotification: adminEmailResponse.ok,
        });
      } catch (emailError) {
        console.error('Error sending beta signup emails:', emailError);
        // Don't fail the signup if email fails
      }
    }

    // Customize message based on signup source
    const successMessage = isBetaSignup 
      ? 'Welcome to the Nixbit Beta Program! Check your email for next steps.'
      : 'Thank you for your interest! We\'ll be in touch soon.';

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: successMessage,
        data: {
          id: signup.id,
          email: signup.email,
          createdAt: signup.createdAt,
        },
      }),
    };
  } catch (error: any) {
    console.error('Marketing signup error:', error);

    if (error.name === 'ZodError') {
      // Extract the first error for a user-friendly message
      const firstError = error.errors[0];
      let userMessage = 'Please check your form input and try again.';
      
      if (firstError) {
        if (firstError.path.includes('email')) {
          userMessage = 'Please enter a valid email address.';
        } else if (firstError.path.includes('name')) {
          userMessage = 'Please enter your name.';
        } else if (firstError.path.includes('company')) {
          userMessage = 'Please enter your company name.';
        } else if (firstError.path.includes('teamSize')) {
          userMessage = 'Please select a valid team size.';
        }
      }
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: userMessage,
          errors: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to process signup. Please try again.',
      }),
    };
  }
};

export { handler };