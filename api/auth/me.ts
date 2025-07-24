import { VercelRequest, VercelResponse } from '@vercel/node';
import { UserService } from '../../backend/src/services/user.service';
import { corsHandler } from '../../backend/src/utils/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  corsHandler(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = UserService.verifyToken(token);
    
    const user = await UserService.getUserById(decoded.userId);
    
    res.json({ user });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
}