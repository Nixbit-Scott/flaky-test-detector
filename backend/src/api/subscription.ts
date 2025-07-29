import { Router, Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { 
  SubscriptionEnforcementService,
  getOrganizationUsage,
  getPlanDetailsForOrganization
} from '../middleware/subscription-enforcement';
import { SUBSCRIPTION_PLANS, getPlanDetails, SubscriptionPlan } from 'shared';
import { logger } from '../utils/logger';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// Get current organization's subscription details
router.get('/current', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const organization = await SubscriptionEnforcementService.getUserOrganization(userId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const planDetails = await getPlanDetailsForOrganization(organization.id);
    
    res.json({
      success: true,
      data: planDetails
    });
  } catch (error) {
    logger.error('Failed to get subscription details', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get organization usage statistics
router.get('/usage', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const organization = await SubscriptionEnforcementService.getUserOrganization(userId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const usage = await getOrganizationUsage(organization.id);
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    logger.error('Failed to get organization usage', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all available plans for comparison
router.get('/plans', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: Object.values(SUBSCRIPTION_PLANS)
    });
  } catch (error) {
    logger.error('Failed to get subscription plans', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check feature access for current organization
router.post('/check-feature', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { feature } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!feature) {
      return res.status(400).json({ error: 'Feature name required' });
    }

    const organization = await SubscriptionEnforcementService.getUserOrganization(userId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const hasAccess = await SubscriptionEnforcementService.checkFeatureAccess(organization.id, feature);
    
    res.json({
      success: true,
      data: {
        hasAccess,
        feature,
        currentPlan: organization.plan
      }
    });
  } catch (error) {
    logger.error('Failed to check feature access', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get upgrade recommendations
router.get('/upgrade-recommendations', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const organization = await SubscriptionEnforcementService.getUserOrganization(userId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const currentPlan = organization.plan as SubscriptionPlan;
    const usage = await getOrganizationUsage(organization.id);
    
    // Determine if upgrade is recommended based on usage
    const recommendations = [];
    
    if (usage.percentages.members > 80 || usage.percentages.projects > 80 || usage.percentages.teams > 80) {
      recommendations.push({
        reason: 'approaching_limits',
        message: 'You are approaching your plan limits',
        urgency: 'medium',
        suggestedPlan: currentPlan === 'starter' ? 'team' : 'enterprise'
      });
    }

    if (usage.percentages.members >= 100 || usage.percentages.projects >= 100 || usage.percentages.teams >= 100) {
      recommendations.push({
        reason: 'limits_exceeded',
        message: 'You have exceeded your plan limits',
        urgency: 'high',
        suggestedPlan: currentPlan === 'starter' ? 'team' : 'enterprise'
      });
    }

    // Check for feature-based recommendations
    if (currentPlan === 'starter') {
      recommendations.push({
        reason: 'feature_upgrade',
        message: 'Upgrade to Team plan for advanced AI detection and quarantine features',
        urgency: 'low',
        suggestedPlan: 'team',
        features: ['ai_detection_advanced', 'auto_quarantine', 'advanced_integrations']
      });
    }

    res.json({
      success: true,
      data: {
        currentPlan: getPlanDetails(currentPlan),
        usage,
        recommendations,
        availableUpgrades: currentPlan !== 'enterprise' ? [
          currentPlan === 'starter' ? getPlanDetails('team') : getPlanDetails('enterprise')
        ] : []
      }
    });
  } catch (error) {
    logger.error('Failed to get upgrade recommendations', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;