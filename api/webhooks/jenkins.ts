import { VercelRequest, VercelResponse } from '@vercel/node';
import { WebhookParserService } from '../../backend/src/services/webhook-parser.service';
import { TestResultService } from '../../backend/src/services/test-result.service';
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

  try {
    console.log('Received Jenkins webhook', { 
      headers: req.headers, 
      bodySize: JSON.stringify(req.body).length 
    });

    // Parse webhook payload
    const normalizedData = WebhookParserService.parseWebhook(req.headers, req.body);
    
    console.log('Parsed Jenkins webhook data', {
      repository: normalizedData.repository,
      branch: normalizedData.branch,
      commit: normalizedData.commit,
      status: normalizedData.status,
      testCount: normalizedData.testResults.length,
    });

    // Process test results
    const result = await TestResultService.processWebhookData(normalizedData);
    
    console.log('Processed Jenkins webhook successfully', {
      testRunId: result.testRun.id,
      projectId: result.project.id,
      projectName: result.project.name,
    });

    return res.json({
      message: 'Jenkins webhook processed successfully',
      testRunId: result.testRun.id,
      projectId: result.project.id,
      testResults: normalizedData.testResults.length,
    });

  } catch (error) {
    console.error('Error processing Jenkins webhook', error);
    
    if (error instanceof Error) {
      // Don't expose internal errors to external webhooks
      if (error.message.includes('No project found')) {
        return res.status(200).json({
          message: 'Repository not configured for monitoring'
        });
      }
      
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process webhook'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}