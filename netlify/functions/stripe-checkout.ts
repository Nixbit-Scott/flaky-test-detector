import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'Method not allowed',
      }),
    };
  }

  try {
    // Verify authentication
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Authentication required',
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
          error: 'Invalid token',
        }),
      };
    }

    const { planId, organizationName } = JSON.parse(event.body || '{}');

    if (!planId || !organizationName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields: planId and organizationName',
        }),
      };
    }

    // Create or get Stripe customer
    let customer = await findOrCreateCustomer(decoded.email, decoded.id);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: customer.id,
      line_items: [
        {
          price: getPriceIdForPlan(planId),
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${getBaseUrl()}/organization/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/organization/pricing`,
      metadata: {
        userId: decoded.id,
        organizationName,
        planId,
      },
      subscription_data: {
        metadata: {
          userId: decoded.id,
          organizationName,
          planId,
        },
      },
    });

    // If Supabase is available, create organization record
    if (supabase) {
      try {
        await supabase
          .from('organizations')
          .insert({
            name: organizationName,
            owner_id: decoded.id,
            stripe_customer_id: customer.id,
            plan: 'free', // Will be updated by webhook after payment
            subscription_status: 'incomplete',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      } catch (dbError) {
        console.error('Error creating organization record:', dbError);
        // Don't fail the checkout if DB insert fails
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
    };

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

async function findOrCreateCustomer(email: string, userId: string): Promise<Stripe.Customer> {
  // Search for existing customer
  const existingCustomers = await stripe.customers.list({
    email: email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return await stripe.customers.create({
    email: email,
    metadata: {
      userId: userId,
    },
  });
}

function getPriceIdForPlan(planId: string): string {
  // Replace these with your actual Stripe price IDs
  const priceMap: Record<string, string> = {
    'starter': 'price_1234567890', // Replace with actual price ID
    'team': 'price_1234567891',    // Replace with actual price ID
    'enterprise': 'price_1234567892', // Replace with actual price ID
  };

  const priceId = priceMap[planId];
  if (!priceId) {
    throw new Error(`Unknown plan: ${planId}`);
  }

  return priceId;
}

function getBaseUrl(): string {
  // In production, this should be your actual domain
  if (process.env.NODE_ENV === 'production') {
    return 'https://nixbit.dev';
  }
  return 'http://localhost:5173';
}

export { handler };