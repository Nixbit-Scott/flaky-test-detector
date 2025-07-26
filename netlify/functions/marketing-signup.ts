import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Marketing signup schema
const MarketingSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  company: z.string().max(200).optional(),
  teamSize: z.enum(['1-5', '6-15', '16-50', '50+']).optional(),
  currentPainPoints: z.array(z.string()).optional(),
  interestedFeatures: z.array(z.string()).optional(),
  source: z.string().optional(),
  utmParameters: z.record(z.string()).optional(),
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
      company: signup.company,
      source: signup.source,
      utmParameters: signup.utmParameters,
    });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Thank you for your interest! We\'ll be in touch soon.',
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
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid input data',
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