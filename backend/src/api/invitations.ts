import { Router } from 'express';
import { AcceptInvitationSchema } from '../../../shared/dist/index.js';
import { invitationService } from '../services/invitation.service';
import { logger } from '../utils/logger';

const router = Router();

// Get invitation details (public endpoint)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const invitation = await invitationService.getInvitation(token);
    
    // Don't expose sensitive data
    const publicInvitation = {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        domain: invitation.organization.domain,
      },
    };
    
    res.json(publicInvitation);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid invitation token') {
      res.status(404).json({ error: 'Invitation not found' });
    } else {
      logger.error('Failed to get invitation', { error });
      res.status(500).json({ error: 'Failed to get invitation' });
    }
  }
});

// Accept invitation (public endpoint)
router.post('/:token/accept', async (req, res) => {
  try {
    const { token } = req.params;
    const validatedData = AcceptInvitationSchema.parse(req.body);
    
    const result = await invitationService.acceptInvitation(token, validatedData);
    
    // Don't expose sensitive user data
    const response = {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        domain: result.organization.domain,
      },
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Invalid invitation') ||
      error.message.includes('already been processed') ||
      error.message.includes('expired') ||
      error.message.includes('User not found')
    )) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Failed to accept invitation', { error });
      res.status(500).json({ error: 'Failed to accept invitation' });
    }
  }
});

export default router;