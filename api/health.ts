import { VercelRequest, VercelResponse } from '@vercel/node';
import { corsHandler } from '../backend/src/utils/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  corsHandler(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0'
  });
}