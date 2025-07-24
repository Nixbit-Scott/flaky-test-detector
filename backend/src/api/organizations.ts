import { Router } from 'express';
import { 
  CreateOrganizationSchema, 
  UpdateOrganizationSchema,
  InviteUserSchema,
  AcceptInvitationSchema,
  UpdateMemberRoleSchema 
} from '../../../shared/dist/index.js';
import { authMiddleware } from '../middleware/auth';
import { 
  enforceMemberLimit,
  enforceFeatureAccess,
  enforceActiveSubscription,
  getOrganizationUsage 
} from '../middleware/subscription-enforcement';
import { organizationService } from '../services/organization.service';
import { invitationService } from '../services/invitation.service';
import { logger } from '../utils/logger';

const router = Router();

// Organization middleware to check permissions
const organizationPermissionMiddleware = (requiredRole: 'owner' | 'admin' | 'member' = 'member') => {
  return async (req: any, res: any, next: any) => {
    try {
      const { organizationId } = req.params;
      const userId = req.user.userId;

      const hasPermission = await organizationService.checkMemberPermission(
        organizationId,
        userId,
        requiredRole
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      logger.error('Organization permission check failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Create organization
router.post('/', authMiddleware, async (req, res) => {
  try {
    const validatedData = CreateOrganizationSchema.parse(req.body);
    const organization = await organizationService.createOrganization(validatedData, (req as any).user.userId);
    
    res.status(201).json(organization);
  } catch (error) {
    if (error instanceof Error && error.message.includes('validation')) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Failed to create organization', { error });
      res.status(500).json({ error: 'Failed to create organization' });
    }
  }
});

// Get user's organizations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const organizations = await organizationService.getUserOrganizations((req as any).user.userId);
    res.json(organizations);
  } catch (error) {
    logger.error('Failed to get organizations', { error });
    res.status(500).json({ error: 'Failed to get organizations' });
  }
});

// Get specific organization
router.get('/:organizationId', authMiddleware, organizationPermissionMiddleware('member'), async (req, res) => {
  try {
    const { organizationId } = req.params;
    const organization = await organizationService.getOrganization(organizationId);
    res.json(organization);
  } catch (error) {
    if (error instanceof Error && error.message === 'Organization not found') {
      res.status(404).json({ error: 'Organization not found' });
    } else {
      logger.error('Failed to get organization', { error });
      res.status(500).json({ error: 'Failed to get organization' });
    }
  }
});

// Update organization
router.put('/:organizationId', authMiddleware, organizationPermissionMiddleware('admin'), async (req, res) => {
  try {
    const { organizationId } = req.params;
    const validatedData = UpdateOrganizationSchema.parse(req.body);
    
    const organization = await organizationService.updateOrganization(organizationId, validatedData);
    res.json(organization);
  } catch (error) {
    if (error instanceof Error && error.message.includes('validation')) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Failed to update organization', { error });
      res.status(500).json({ error: 'Failed to update organization' });
    }
  }
});

// Delete organization
router.delete('/:organizationId', authMiddleware, organizationPermissionMiddleware('owner'), async (req, res) => {
  try {
    const { organizationId } = req.params;
    await organizationService.deleteOrganization(organizationId);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete organization', { error });
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// Invite user to organization
router.post('/:organizationId/invitations', authMiddleware, enforceActiveSubscription, enforceMemberLimit, organizationPermissionMiddleware('admin'), async (req: any, res: any) => {
  try {
    const { organizationId } = req.params;
    const validatedData = InviteUserSchema.parse(req.body);
    
    const invitation = await invitationService.inviteUser(organizationId, validatedData, (req as any).user.userId);
    res.status(201).json(invitation);
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('maximum member limit') ||
      error.message.includes('already a member') ||
      error.message.includes('already sent')
    )) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Failed to invite user', { error });
      res.status(500).json({ error: 'Failed to invite user' });
    }
  }
});

// Get organization invitations
router.get('/:organizationId/invitations', authMiddleware, organizationPermissionMiddleware('admin'), async (req, res) => {
  try {
    const { organizationId } = req.params;
    const invitations = await invitationService.getOrganizationInvitations(organizationId);
    res.json(invitations);
  } catch (error) {
    logger.error('Failed to get invitations', { error });
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// Cancel invitation
router.delete('/:organizationId/invitations/:invitationId', authMiddleware, organizationPermissionMiddleware('admin'), async (req, res) => {
  try {
    const { invitationId } = req.params;
    await invitationService.cancelInvitation(invitationId);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to cancel invitation', { error });
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// Resend invitation
router.post('/:organizationId/invitations/:invitationId/resend', authMiddleware, organizationPermissionMiddleware('admin'), async (req, res) => {
  try {
    const { invitationId } = req.params;
    await invitationService.resendInvitation(invitationId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Can only resend')) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Failed to resend invitation', { error });
      res.status(500).json({ error: 'Failed to resend invitation' });
    }
  }
});

// Update member role
router.put('/:organizationId/members/:userId/role', authMiddleware, organizationPermissionMiddleware('admin'), async (req, res) => {
  try {
    const { organizationId, userId } = req.params;
    const validatedData = UpdateMemberRoleSchema.parse(req.body);
    
    const member = await organizationService.updateMemberRole(organizationId, userId, validatedData.role);
    res.json(member);
  } catch (error) {
    if (error instanceof Error && error.message.includes('validation')) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Failed to update member role', { error });
      res.status(500).json({ error: 'Failed to update member role' });
    }
  }
});

// Remove member
router.delete('/:organizationId/members/:userId', authMiddleware, organizationPermissionMiddleware('admin'), async (req, res) => {
  try {
    const { organizationId, userId } = req.params;
    const currentUserId = (req as any).user.userId;
    
    // Don't allow removing yourself
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot remove yourself from organization' });
    }
    
    await organizationService.removeMember(organizationId, userId);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to remove member', { error });
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Get organization usage statistics
router.get('/:organizationId/usage', authMiddleware, organizationPermissionMiddleware('member'), async (req, res) => {
  try {
    const { organizationId } = req.params;
    const usage = await getOrganizationUsage(organizationId);
    res.json(usage);
  } catch (error) {
    logger.error('Failed to get organization usage', { error });
    res.status(500).json({ error: 'Failed to get organization usage' });
  }
});

export default router;