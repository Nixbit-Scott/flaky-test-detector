import { VercelRequest, VercelResponse } from '@vercel/node';
import { corsHandler } from '../../backend/src/utils/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  corsHandler(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // With JWT, logout is handled client-side by removing the token
  res.json({ message: 'Logout successful' });
}