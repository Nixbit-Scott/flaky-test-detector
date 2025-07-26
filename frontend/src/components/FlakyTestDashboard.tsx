import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

interface FlakyTest {
  testName: string;
  failureRate: number;
  avgDuration: number;
  durationVariance: number;
  totalRuns: number;
  failures: number;
  reasons: string[];
  confidence: number;
  lastFailure?: string;
  recommendation: string;
}

interface FlakyTestAnalysis {
  testName: string;
  testSuite?: string;
  failureRate: number;
  totalRuns: number;
  failedRuns: number;
  confidence: number;
  isFlaky: boolean;
  pattern: 'intermittent' | 'environment-dependent' | 'timing-sensitive' | 'unknown';
  recommendations: string[];
}

interface FlakyTestStats {
  totalTests: number;
  flakyTests: number;
  averageFailureRate: number;
  averageConfidence: number;
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

interface FlakyTestDashboardProps {
  projectId: string;
}

const FlakyTestDashboard: React.FC<FlakyTestDashboardProps> = ({ projectId }) => {
  const [flakyTests, setFlakyTests] = useState<FlakyTest[]>([]);
  const [stats, setStats] = useState<FlakyTestStats | null>(null);
  const [selectedTest, setSelectedTest] = useState<FlakyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [analysisResults, setAnalysisResults] = useState<FlakyTestAnalysis[]>([]);
  
  const { token } = useAuth();

  const fetchFlakyTests = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/flaky-analysis?projectId=${projectId}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch flaky analysis');
      }

      setFlakyTests(data.flakyTests || []);
      setStats({
        totalTests: data.summary.totalTests,
        flakyTests: data.summary.flakyTests,
        averageFailureRate: data.summary.avgFailureRate,
        averageConfidence: data.flakyTests.length > 0 
          ? data.flakyTests.reduce((sum: number, test: FlakyTest) => sum + test.confidence, 0) / data.flakyTests.length 
          : 0,
        riskDistribution: {
          high: data.flakyTests.filter((test: FlakyTest) => test.failureRate > 50).length,
          medium: data.flakyTests.filter((test: FlakyTest) => test.failureRate > 20 && test.failureRate <= 50).length,
          low: data.flakyTests.filter((test: FlakyTest) => test.failureRate <= 20).length,
        }
      });
    } catch (err) {
      console.error('Error fetching flaky tests:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch flaky tests');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      const response = await fetch('/api/flaky-tests/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze tests');
      }

      setAnalysisResults(data.flakyTests);
      // Refresh the flaky tests list
      await fetchFlakyTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze tests');
    } finally {
      setAnalyzing(false);
    }
  };

  const markAsResolved = async (testName: string, testSuite?: string) => {
    try {
      const queryParams = testSuite ? `?testSuite=${encodeURIComponent(testSuite)}` : '';
      const response = await fetch(`/api/flaky-tests/${projectId}/${encodeURIComponent(testName)}${queryParams}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to mark test as resolved');
      }

      // Refresh the list
      await fetchFlakyTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark test as resolved');
    }
  };

  useEffect(() => {
    fetchFlakyTests();
  }, [projectId, token]);

  const getRiskLevel = (failureRate: number) => {
    if (failureRate > 0.4) return { level: 'high', color: 'text-red-600 bg-red-100', label: 'High Risk' };
    if (failureRate > 0.2) return { level: 'medium', color: 'text-orange-600 bg-orange-100', label: 'Medium Risk' };
    return { level: 'low', color: 'text-yellow-600 bg-yellow-100', label: 'Low Risk' };
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPatternIcon = (pattern: string) => {
    switch (pattern) {
      case 'timing-sensitive': return '⏱️';
      case 'environment-dependent': return '🌍';
      case 'intermittent': return '🔄';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <div className="font-medium">Error loading flaky tests:</div>
          <div className="text-sm mt-1">{error}</div>
          <div className="mt-3 flex space-x-3">
            <button
              onClick={fetchFlakyTests}
              className="text-red-800 underline hover:text-red-900 text-sm"
            >
              Retry
            </button>
            <span className="text-red-600 text-sm">•</span>
            <button
              onClick={() => console.log('Project ID:', projectId, 'Token:', token ? 'Present' : 'Missing')}
              className="text-red-800 underline hover:text-red-900 text-sm"
            >
              Debug Info
            </button>
          </div>
        </div>
        
        {/* Fallback content */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Flaky Test Detection</h3>
          <p className="text-gray-600 mb-4">
            There was an issue connecting to the flaky test detection service. 
            This might be because:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
            <li>The backend service is not running</li>
            <li>Your authentication token has expired</li>
            <li>The project does not exist</li>
            <li>No test data has been submitted yet</li>
          </ul>
        </div>
      </div>
    );
  }

  if (selectedTest) {
    const risk = getRiskLevel(selectedTest.failureRate);
    
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedTest(null)}
          className="flex items-center text-indigo-600 hover:text-indigo-800"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Flaky Tests
        </button>

        {/* Test details */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{selectedTest.testName}</h3>
              <p className="text-gray-600">Test Suite Analysis</p>
            </div>
            <div className="flex space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${risk.color}`}>
                {risk.label}
              </span>
              <button
                onClick={() => markAsResolved(selectedTest.testName, undefined)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Mark as Resolved
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{(selectedTest.failureRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Failure Rate</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getConfidenceColor(selectedTest.confidence)}`}>
                {(selectedTest.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500">Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{selectedTest.totalRuns}</div>
              <div className="text-sm text-gray-500">Total Runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{selectedTest.failures}</div>
              <div className="text-sm text-gray-500">Failed Runs</div>
            </div>
          </div>

          {/* Additional info */}
          <div className="border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Last failure:</span> {selectedTest.lastFailure ? new Date(selectedTest.lastFailure).toLocaleString() : 'No recent failures'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Flaky Test Detection</h3>
        <div className="flex space-x-3">
          <button
            onClick={fetchFlakyTests}
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-sm">⚠️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Flaky Tests</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.flakyTests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-sm">🎯</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Failure Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{(stats.averageFailureRate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Confidence</p>
                <p className="text-2xl font-semibold text-gray-900">{(stats.averageConfidence * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-sm">🔥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">High Risk</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.riskDistribution.high}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis results */}
      {analysisResults.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Latest Analysis Results</h4>
          <p className="text-blue-800 text-sm">
            Found {analysisResults.length} flaky tests with patterns: 
            {analysisResults.map(r => getPatternIcon(r.pattern)).join(' ')}
          </p>
        </div>
      )}

      {/* Flaky tests list */}
      {flakyTests.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No flaky tests detected</h3>
          <p className="text-gray-500 mb-6">Run an analysis to detect flaky tests in your project.</p>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {analyzing ? 'Analyzing...' : 'Run First Analysis'}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Detected Flaky Tests</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {flakyTests.map((test) => {
              const risk = getRiskLevel(test.failureRate);
              return (
                <div
                  key={test.testName}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedTest(test)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${risk.color}`}>
                          {risk.label}
                        </span>
                        <span className="font-medium text-gray-900">{test.testName}</span>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                        <span>Failure rate: {(test.failureRate * 100).toFixed(1)}%</span>
                        <span>Confidence: <span className={getConfidenceColor(test.confidence)}>{(test.confidence * 100).toFixed(0)}%</span></span>
                        <span>Runs: {test.failures}/{test.totalRuns}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div>Last failure: {test.lastFailure ? new Date(test.lastFailure).toLocaleDateString() : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlakyTestDashboard;