import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { TestResultService } from '../../backend/src/services/test-result.service';
import { UserService } from '../../backend/src/services/user.service';
import { corsHandler } from '../../backend/src/utils/cors';

const submitTestResultsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  branch: z.string().min(1, 'Branch is required'),
  commit: z.string().min(1, 'Commit is required'),
  buildId: z.string().optional(),
  buildUrl: z.string().url().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  testResults: z.array(z.object({
    testName: z.string().min(1, 'Test name is required'),
    testSuite: z.string().optional(),
    status: z.enum(['passed', 'failed', 'skipped']),
    duration: z.number().optional(),
    errorMessage: z.string().optional(),
    stackTrace: z.string().optional(),
    retryAttempt: z.number().optional(),
  })),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  corsHandler(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract and verify token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = UserService.verifyToken(token);

    if (req.method === 'POST') {
      // Submit test results
      const validatedData = submitTestResultsSchema.parse(req.body);
      
      // Calculate test statistics
      const stats = TestResultService.calculateTestStatistics(validatedData.testResults);
      
      // Create test run
      const testRun = await TestResultService.createTestRun({
        projectId: validatedData.projectId,
        branch: validatedData.branch,
        commit: validatedData.commit,
        buildId: validatedData.buildId,
        buildUrl: validatedData.buildUrl,
        startedAt: new Date(validatedData.startedAt),
        completedAt: validatedData.completedAt ? new Date(validatedData.completedAt) : undefined,
        ...stats,
        testResults: validatedData.testResults,
      });

      return res.status(201).json({
        message: 'Test results submitted successfully',
        testRun,
      });
    }

    if (req.method === 'GET') {
      // Get test results for a project
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const results = await TestResultService.getTestResultsByProject(projectId, page, limit);
      return res.json(results);
    }

    return res.status(405).json({ error: 'Method not allowed' });

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