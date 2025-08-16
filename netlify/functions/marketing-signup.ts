import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

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
  experience: z.string().optional(),
  motivation: z.string().optional(),
  expectations: z.string().optional(),
  availableTime: z.string().optional(),
  communicationPreference: z.array(z.string()).optional(),
  referralSource: z.string().optional(),
  linkedinProfile: z.string().optional(),
  githubProfile: z.string().optional(),
  source: z.string().optional(),
  utmParameters: z.record(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  captchaToken: z.string().optional(),
});

type MarketingSignupRequest = z.infer<typeof MarketingSignupSchema>;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pxkjkqdkmnnjdrgyrocy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (error) {
    console.warn('Supabase client initialization failed:', error);
  }
}

// Fallback in-memory store if database is not available
let signups: Array<MarketingSignupRequest & { id: string; createdAt: string }> = [];

// CAPTCHA validation function
async function validateCaptcha(token: string): Promise<boolean> {
  console.log('[CAPTCHA] Starting validation process...');
  
  if (!token) {
    console.error('[CAPTCHA] No token provided');
    return false;
  }

  console.log('[CAPTCHA] Token received (length):', token.length);
  console.log('[CAPTCHA] Token preview:', token.substring(0, 20) + '...');

  const secretKey = process.env.HCAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.warn('[CAPTCHA] HCAPTCHA_SECRET_KEY not configured, skipping CAPTCHA validation');
    return true; // Allow signup if CAPTCHA is not configured (for development)
  }

  console.log('[CAPTCHA] Secret key is configured');

  try {
    console.log('[CAPTCHA] Making request to hCaptcha API...');
    
    const requestBody = `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`;
    console.log('[CAPTCHA] Request body length:', requestBody.length);
    
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    });

    console.log('[CAPTCHA] API response status:', response.status, response.statusText);

    if (!response.ok) {
      console.error('[CAPTCHA] API response not OK:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[CAPTCHA] Error response body:', errorText);
      return false;
    }

    const data = await response.json();
    console.log('[CAPTCHA] Full validation response:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      console.error('[CAPTCHA] Validation failed with error codes:', data['error-codes']);
      console.error('[CAPTCHA] Error details:', {
        'invalid-input-secret': 'The secret parameter is invalid or malformed',
        'invalid-input-response': 'The response parameter is invalid or malformed',
        'bad-request': 'The request is invalid or malformed',
        'timeout-or-duplicate': 'The response is no longer valid: either is too old or has been used previously',
        'missing-input-secret': 'The secret parameter is missing',
        'missing-input-response': 'The response parameter is missing'
      });
    } else {
      console.log('[CAPTCHA] Validation successful!');
    }
    
    return data.success === true;
  } catch (error) {
    console.error('[CAPTCHA] Validation error:', error);
    console.error('[CAPTCHA] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return false;
  }
}

const handler: Handler = async (event: HandlerEvent) => {
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
    try {
      // Try to fetch from database first
      if (supabase) {
        const { data: dbSignups, error } = await supabase
          .from('marketing_signups')
          .select('*')
          .eq('source', 'beta-signup-page')
          .order('created_at', { ascending: false });

        if (!error && dbSignups) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: dbSignups.map((s: any) => ({
                id: s.id,
                email: s.email,
                name: s.name,
                company: s.company,
                teamSize: s.team_size,
                role: s.role,
                primaryUsage: s.primary_usage,
                motivation: s.motivation,
                availableTime: s.available_time,
                source: s.source,
                createdAt: s.created_at,
                status: s.status || 'pending',
              })),
              total: dbSignups.length,
            }),
          };
        }
      }
    } catch (error) {
      console.error('Error fetching from database:', error);
    }

    // Fallback to in-memory store
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

    // Validate CAPTCHA if token is provided
    if (validatedData.captchaToken) {
      console.log('[SIGNUP] CAPTCHA token found, validating...');
      const captchaValid = await validateCaptcha(validatedData.captchaToken);
      console.log('[SIGNUP] CAPTCHA validation result:', captchaValid);
      
      if (!captchaValid) {
        console.error('[SIGNUP] CAPTCHA validation failed, rejecting signup');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'CAPTCHA verification failed. Please try again.',
          }),
        };
      }
      console.log('[SIGNUP] CAPTCHA validation passed, proceeding with signup');
    } else {
      console.log('[SIGNUP] No CAPTCHA token provided');
    }

    // Check if email already exists
    let existingSignup: { id: string; email: string; createdAt: string } | null = null;
    
    // Try database first
    if (supabase) {
      try {
        const { data: existing, error } = await supabase
          .from('marketing_signups')
          .select('id, email, created_at')
          .eq('email', validatedData.email)
          .single();
        
        if (existing && !error) {
          existingSignup = {
            id: existing.id,
            email: existing.email,
            createdAt: existing.created_at,
          };
        }
      } catch (dbError) {
        console.error('Database check error:', dbError);
      }
    }
    
    // Fallback to in-memory check
    if (!existingSignup) {
      const memorySignup = signups.find(s => s.email === validatedData.email);
      if (memorySignup) {
        existingSignup = {
          id: memorySignup.id,
          email: memorySignup.email,
          createdAt: memorySignup.createdAt,
        };
      }
    }
    
    if (existingSignup) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Thank you for your interest! We already have your information and will be in touch soon.',
          data: existingSignup,
        }),
      };
    }

    // Create new signup
    let signup: any = {
      ...validatedData,
      id: `signup_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: new Date().toISOString(),
    };

    // Try to save to database
    if (supabase) {
      try {
        // Transform teamSize to match database format
        const teamSizeMap: { [key: string]: string } = {
          '1-5 developers': '1-5',
          '6-15 developers': '6-15',
          '16-50 developers': '16-50',
          '50+ developers': '50+',
        };
        
        const dbData = {
          email: validatedData.email,
          name: validatedData.name || null,
          company: validatedData.company || null,
          role: validatedData.role || null,
          team_size: teamSizeMap[validatedData.teamSize || ''] || validatedData.teamSize || null,
          current_pain_points: validatedData.currentPainPoints || [],
          interested_features: validatedData.interestedFeatures || [],
          primary_usage: validatedData.primaryUsage || null,
          experience: validatedData.experience || null,
          referral_source: validatedData.referralSource || null,
          linkedin_profile: validatedData.linkedinProfile || null,
          github_profile: validatedData.githubProfile || null,
          motivation: validatedData.motivation || null,
          expectations: validatedData.expectations || null,
          available_time: validatedData.availableTime || null,
          communication_preference: validatedData.communicationPreference || [],
          source: validatedData.source || 'unknown',
          utm_parameters: validatedData.utmParameters || {},
          metadata: {
            ...validatedData.metadata || {},
            captchaVerified: !!validatedData.captchaToken,
          },
          status: 'pending',
        };

        const { data: savedSignup, error } = await supabase
          .from('marketing_signups')
          .insert([dbData])
          .select()
          .single();

        if (!error && savedSignup) {
          console.log('Signup saved to database:', savedSignup.email);
          signup = {
            id: savedSignup.id,
            email: savedSignup.email,
            name: savedSignup.name,
            company: savedSignup.company,
            teamSize: savedSignup.team_size,
            role: savedSignup.role,
            primaryUsage: savedSignup.primary_usage,
            motivation: savedSignup.motivation,
            source: savedSignup.source,
            createdAt: savedSignup.created_at,
          };
        } else {
          console.error('Failed to save to database:', error);
          // Still add to memory as fallback
          signups.push(signup);
        }
      } catch (dbError) {
        console.error('Database save error:', dbError);
        // Still add to memory as fallback
        signups.push(signup);
      }
    } else {
      // No database available, use in-memory
      signups.push(signup);
    }

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