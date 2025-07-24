import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { UserService } from '../../backend/src/services/user.service';
import { corsHandler } from '../../backend/src/utils/cors';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
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
    const validatedData = loginSchema.parse(req.body);
    
    const result = await UserService.authenticateUser(validatedData);
    
    res.json({
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    if (error instanceof Error) {
      return res.status(401).json({
        error: error.message,
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}