import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import * as jwt from 'jsonwebtoken';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Get test history from stored test results
const getTestHistory = (projectId: string, testResults: Map<string, any>) => {
  // Get all test results for this project
  const projectResults = Array.from(testResults.values())
    .filter(result => result.projectId === projectId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Group by test name
  const testHistory: { [testName: string]: any[] } = {};
  
  for (const result of projectResults) {
    for (const test of result.tests) {
      if (!testHistory[test.name]) {
        testHistory[test.name] = [];
      }
      testHistory[test.name].push({
        date: result.timestamp,
        status: test.status,
        duration: test.duration || 0,
        errorMessage: test.errorMessage,
        stackTrace: test.stackTrace,
        retryCount: test.retryCount || 0,
      });
    }
  }
  
  // Convert to array format expected by analysis
  return Object.entries(testHistory).map(([testName, results]) => ({
    testName,
    results: results.slice(0, 50) // Limit to last 50 runs for analysis
  }));
};

// Simple flaky test detection algorithm
const analyzeFlakyTests = (testHistory: any[]) => {
  const flakyTests: any[] = [];
  
  for (const test of testHistory) {
    const { testName, results } = test;
    
    // Calculate failure rate
    const totalRuns = results.length;
    const failures = results.filter((r: any) => r.status === 'failed').length;
    const failureRate = failures / totalRuns;
    
    // Calculate duration variance (high variance indicates flakiness)
    const durations = results.map((r: any) => r.duration || 0);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / avgDuration;
    
    // Detect flaky patterns
    let isFlaky = false;
    let flakyReason: string[] = [];
    
    // Pattern 1: Intermittent failures (failure rate between 10% and 90%)
    if (failureRate > 0.1 && failureRate < 0.9) {
      isFlaky = true;
      flakyReason.push(`Intermittent failures (${(failureRate * 100).toFixed(1)}% failure rate)`);
    }
    
    // Pattern 2: High duration variance (coefficient of variation > 0.5)
    if (coefficientOfVariation > 0.5) {
      isFlaky = true;
      flakyReason.push(`Inconsistent performance (${(coefficientOfVariation * 100).toFixed(1)}% variation)`);
    }
    
    // Pattern 3: Alternating pass/fail pattern
    let alternatingCount = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i].status !== results[i-1].status) {
        alternatingCount++;
      }
    }
    const alternatingRatio = alternatingCount / (results.length - 1);
    if (alternatingRatio > 0.6 && failures > 1) {
      isFlaky = true;
      flakyReason.push(`Alternating pass/fail pattern (${(alternatingRatio * 100).toFixed(1)}%)`);
    }
    
    if (isFlaky) {
      flakyTests.push({
        testName,
        failureRate: failureRate * 100,
        avgDuration: Math.round(avgDuration),
        durationVariance: Math.round(standardDeviation),
        totalRuns,
        failures,
        reasons: flakyReason,
        confidence: Math.min(95, 50 + (failureRate * 100) + (coefficientOfVariation * 50)),
        lastFailure: results.find((r: any) => r.status === 'failed')?.date,
        recommendation: failures > totalRuns * 0.5 ? 'Disable test until fixed' : 'Enable automatic retry',
      });
    }
  }
  
  return flakyTests;
};

// Helper function to verify JWT and get user
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid token provided');
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('Flaky analysis function called:', {
      path: event.path,
      httpMethod: event.httpMethod,
    });

    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await getUserFromToken(authHeader);

    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    // Get query parameters
    const projectId = event.queryStringParameters?.projectId;
    
    if (!projectId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Project ID is required' }),
      };
    }

    // Get test history from in-memory store
    // In production, this would query from a proper database
    const testResults = new Map(); // This would be injected or retrieved from database
    const testHistory = getTestHistory(projectId, testResults);
    
    // Analyze for flaky tests
    const flakyTests = analyzeFlakyTests(testHistory);
    
    // Calculate summary statistics
    const totalTests = testHistory.length;
    const totalFlakyTests = flakyTests.length;
    const avgFailureRate = flakyTests.length > 0 
      ? flakyTests.reduce((sum, test) => sum + test.failureRate, 0) / flakyTests.length 
      : 0;
    
    const summary = {
      totalTests,
      flakyTests: totalFlakyTests,
      flakyPercentage: totalTests > 0 ? (totalFlakyTests / totalTests) * 100 : 0,
      avgFailureRate: Math.round(avgFailureRate * 100) / 100,
      criticalTests: flakyTests.filter(test => test.failureRate > 50).length,
      analysisDate: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        projectId,
        summary,
        flakyTests,
        recommendations: [
          flakyTests.length > 0 ? 'Enable automatic retry for flaky tests' : 'No flaky tests detected',
          totalFlakyTests > 5 ? 'Consider reviewing test infrastructure' : null,
          avgFailureRate > 30 ? 'High failure rate - investigate common causes' : null,
        ].filter(Boolean),
      }),
    };
  } catch (error) {
    console.error('Flaky analysis error:', error);
    return {
      statusCode: error instanceof Error && error.message.includes('token') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      }),
    };
  }
};