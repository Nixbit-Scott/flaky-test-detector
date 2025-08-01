import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
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
    const signature = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing webhook signature or secret',
        }),
      };
    }

    // Construct the event
    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body || '',
        signature,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid signature',
        }),
      };
    }

    console.log('Received Stripe webhook:', stripeEvent.type);

    // Handle the event
    switch (stripeEvent.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        received: true,
      }),
    };

  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Subscription created:', subscription.id);
  
  if (!supabase) {
    console.warn('Supabase not available for subscription created event');
    return;
  }

  try {
    // Update organization with active subscription
    const { error } = await supabase
      .from('organizations')
      .update({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        plan: mapStripePriceIdToPlan(subscription.items.data[0]?.price?.id),
        subscription_status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', subscription.customer);

    if (error) {
      console.error('Error updating organization subscription:', error);
    }
  } catch (error) {
    console.error('Database error in handleSubscriptionCreated:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id);
  
  if (!supabase) {
    console.warn('Supabase not available for subscription updated event');
    return;
  }

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        plan: mapStripePriceIdToPlan(subscription.items.data[0]?.price?.id),
        subscription_status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Error updating organization subscription:', error);
    }
  } catch (error) {
    console.error('Database error in handleSubscriptionUpdated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  if (!supabase) {
    console.warn('Supabase not available for subscription deleted event');
    return;
  }

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        plan: 'free',
        subscription_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Error updating organization subscription:', error);
    }
  } catch (error) {
    console.error('Database error in handleSubscriptionDeleted:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded for invoice:', invoice.id);
  // Additional logic for successful payments (e.g., send receipt, unlock features)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id);
  // Additional logic for failed payments (e.g., send notification, suspend access)
}

function mapStripePriceIdToPlan(priceId?: string): string {
  // Map Stripe price IDs to your plan names
  // You'll need to update these with your actual Stripe price IDs
  const priceIdMap: Record<string, string> = {
    'price_starter_monthly': 'starter',
    'price_team_monthly': 'team', 
    'price_enterprise_monthly': 'enterprise',
    'price_starter_yearly': 'starter',
    'price_team_yearly': 'team',
    'price_enterprise_yearly': 'enterprise',
  };

  return priceIdMap[priceId || ''] || 'free';
}

export { handler };