import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    const user = await UserService.createUser(validatedData);
    
    res.status(201).json({
      message: 'User created successfully',
      user,
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
      res.status(400).json({
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    const result = await UserService.authenticateUser(validatedData);
    
    res.json({
      message: 'Login successful',
      ...result,
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
      res.status(401).json({
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    const user = await UserService.getUserById(req.user.userId);
    
    res.json({ user });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // With JWT, logout is handled client-side by removing the token
  res.json({ message: 'Logout successful' });
});

export default router;