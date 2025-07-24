import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { UserService } from '../../backend/src/services/user.service';
import { corsHandler } from '../../backend/src/utils/cors';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  corsHandler(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const validatedData = registerSchema.parse(req.body);
    
    const user = await UserService.createUser(validatedData);
    
    res.status(201).json({
      message: 'User created successfully',
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    if (error instanceof Error) {
      return res.status(400).json({
        error: error.message,
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}