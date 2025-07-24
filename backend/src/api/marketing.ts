import { Router, Request, Response } from 'express';
import { MarketingSignupSchema, UpdateMarketingSignupSchema } from '../../../shared/dist/index.js';
import { marketingService } from '../services/marketing.service';
import { authMiddleware } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for marketing endpoints
const marketingSignupLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many signup attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoint - Marketing signup (no auth required)
router.post('/signup', marketingSignupLimit, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = MarketingSignupSchema.parse(req.body);
    
    // Extract client metadata
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    };

    // Create or update signup
    const signup = await marketingService.createSignup(validatedData, metadata);
    
    // Calculate lead score asynchronously
    marketingService.calculateLeadScore(signup.id).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Thank you for your interest! We\'ll be in touch soon.',
      data: {
        id: signup.id,
        email: signup.email,
        createdAt: signup.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Marketing signup error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process signup. Please try again.',
    });
  }
});

// Public endpoint - Unsubscribe from emails
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    await marketingService.unsubscribeEmail(email);

    res.json({
      success: true,
      message: 'Successfully unsubscribed from marketing emails',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe',
    });
  }
});

// Admin-only endpoints (require authentication)
router.use(authMiddleware);

// Get all marketing signups (admin only)
router.get('/signups', async (req: Request, res: Response) => {
  try {
    // Check if user is system admin
    if (!(req as any).user.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const converted = req.query.converted === 'true' ? true : req.query.converted === 'false' ? false : undefined;
    const source = req.query.source as string;

    const result = await marketingService.getAllSignups({
      page,
      limit,
      converted,
      source,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get signups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch signups',
    });
  }
});

// Get signup statistics (admin only)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Check if user is system admin
    if (!(req as any).user.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const stats = await marketingService.getSignupStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
    });
  }
});

// Get specific signup (admin only)
router.get('/signups/:id', async (req: Request, res: Response) => {
  try {
    // Check if user is system admin
    if (!(req as any).user.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const signup = await marketingService.getSignup(req.params.id);
    
    if (!signup) {
      return res.status(404).json({
        success: false,
        message: 'Signup not found',
      });
    }

    res.json({
      success: true,
      data: signup,
    });
  } catch (error) {
    console.error('Get signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch signup',
    });
  }
});

// Update signup (admin only)
router.put('/signups/:id', async (req: Request, res: Response) => {
  try {
    // Check if user is system admin
    if (!(req as any).user.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const validatedData = UpdateMarketingSignupSchema.parse(req.body);
    const signup = await marketingService.updateSignup(req.params.id, validatedData);

    res.json({
      success: true,
      data: signup,
    });
  } catch (error: any) {
    console.error('Update signup error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update signup',
    });
  }
});

// Mark signup as converted (admin only)
router.post('/signups/:id/convert', async (req: Request, res: Response) => {
  try {
    // Check if user is system admin
    if (!(req as any).user.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const signup = await marketingService.getSignup(req.params.id);
    if (!signup) {
      return res.status(404).json({
        success: false,
        message: 'Signup not found',
      });
    }

    const updatedSignup = await marketingService.markAsConverted(signup.email, userId);

    res.json({
      success: true,
      data: updatedSignup,
    });
  } catch (error) {
    console.error('Convert signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark signup as converted',
    });
  }
});

export default router;