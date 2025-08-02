import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TeamService } from '../services/team.service';

const router = Router();

// Validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
  organizationId: z.string().min(1, 'Organization ID is required'),
});

const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member'], { errorMap: () => ({ message: 'Role must be admin or member' }) }),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'], { errorMap: () => ({ message: 'Role must be admin or member' }) }),
});

const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long').optional(),
});

// POST /api/teams - Create a new team
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = createTeamSchema.parse(req.body);
    
    const team = await TeamService.createTeam((req.user as any).id, validatedData as any);

    res.status(201).json({
      message: 'Team created successfully',
      team,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teams - Get user's teams
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const teams = await TeamService.getUserTeams((req.user as any).id);

    res.json({
      teams,
      total: teams.length,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teams/:teamId - Get team details
router.get('/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { teamId } = req.params;
    const team = await TeamService.getTeam(teamId, (req.user as any).id);

    res.json({ team });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/teams/:teamId - Update team
router.put('/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { teamId } = req.params;
    const validatedData = updateTeamSchema.parse(req.body);

    const team = await TeamService.updateTeam(teamId, (req.user as any).id, validatedData);

    res.json({
      message: 'Team updated successfully',
      team,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams/:teamId/invite - Invite member to team
router.post('/:teamId/invite', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { teamId } = req.params;
    const validatedData = inviteMemberSchema.parse(req.body);

    const result = await TeamService.inviteMember(teamId, (req.user as any).id, validatedData as any);

    res.status(result.invited ? 201 : 200).json(result);

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/teams/:teamId/members/:memberId/role - Update member role
router.put('/:teamId/members/:memberId/role', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { teamId, memberId } = req.params;
    const validatedData = updateMemberRoleSchema.parse(req.body);

    await TeamService.updateMemberRole(teamId, (req.user as any).id, memberId, validatedData.role);

    res.json({
      message: 'Member role updated successfully',
      memberId,
      newRole: validatedData.role,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/teams/:teamId/members/:memberId - Remove member from team
router.delete('/:teamId/members/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { teamId, memberId } = req.params;

    await TeamService.removeMember(teamId, (req.user as any).id, memberId);

    res.json({
      message: 'Member removed from team successfully',
      memberId,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams/:teamId/leave - Leave team
router.post('/:teamId/leave', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { teamId } = req.params;

    await TeamService.leaveTeam(teamId, (req.user as any).id);

    res.json({
      message: 'Left team successfully',
      teamId,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teams/:teamId/projects - Get team projects
router.get('/:teamId/projects', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { teamId } = req.params;
    const projects = await TeamService.getTeamProjects(teamId, (req.user as any).id);

    res.json({
      projects,
      total: projects.length,
      teamId,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;