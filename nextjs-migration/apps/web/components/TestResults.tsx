import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface TestResult {
  id: string;
  testName: string;
  testSuite?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  errorMessage?: string;
  retryAttempt: number;
}

interface TestRun {
  id: string;
  branch: string;
  commit: string;
  buildId?: string;
  buildUrl?: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  testResults: TestResult[];
}

interface TestResultsProps {
  projectId: string;
}

const TestResults: React.FC<TestResultsProps> = ({ projectId }) => {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { token } = useAuth();

  const fetchTestRuns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/test-results/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch test results');
      }

      setTestRuns(data.testRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch test results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestRuns();
  }, [projectId, token]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'skipped':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getRunStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'running':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
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
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
        <button
          onClick={fetchTestRuns}
          className="ml-4 text-red-800 underline hover:text-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  if (testRuns.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No test results yet</h3>
        <p className="text-gray-500 mb-6">Set up webhooks to start receiving test results from your CI/CD pipeline.</p>
      </div>
    );
  }

  if (selectedRun) {
    return (
      <div className="space-y-6">
        {/* Back button and run info */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedRun(null)}
            className="flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Test Runs
          </button>
          
          <div className="text-right">
            <h3 className="font-semibold text-gray-900">Test Run Details</h3>
            <p className="text-sm text-gray-500">{formatDate(selectedRun.startedAt)}</p>
          </div>
        </div>

        {/* Run summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{selectedRun.passedTests}</div>
              <div className="text-sm text-gray-500">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{selectedRun.failedTests}</div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{selectedRun.skippedTests}</div>
              <div className="text-sm text-gray-500">Skipped</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{selectedRun.totalTests}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Branch: <code className="bg-gray-100 px-1 rounded">{selectedRun.branch}</code></span>
            <span>Commit: <code className="bg-gray-100 px-1 rounded">{selectedRun.commit.slice(0, 7)}</code></span>
            {selectedRun.buildUrl && (
              <a href={selectedRun.buildUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                View Build
              </a>
            )}
          </div>
        </div>

        {/* Individual test results */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Individual Test Results</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {selectedRun.testResults.map((test) => (
              <div key={test.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(test.status)}`}>
                        {test.status}
                      </span>
                      <span className="font-medium text-gray-900">{test.testName}</span>
                      {test.testSuite && (
                        <span className="text-sm text-gray-500">in {test.testSuite}</span>
                      )}
                    </div>
                    {test.errorMessage && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        {test.errorMessage}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>Duration: {formatDuration(test.duration)}</div>
                    {test.retryAttempt > 0 && (
                      <div className="text-orange-600">Retry #{test.retryAttempt}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
        <button
          onClick={fetchTestRuns}
          className="text-indigo-600 hover:text-indigo-800 text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {testRuns.map((run) => (
          <div
            key={run.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedRun(run)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRunStatusColor(run.status)}`}>
                  {run.status}
                </span>
                <span className="font-medium text-gray-900">
                  {run.branch} • {run.commit.slice(0, 7)}
                </span>
              </div>
              <span className="text-sm text-gray-500">{formatDate(run.startedAt)}</span>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">{run.passedTests}</div>
                <div className="text-xs text-gray-500">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">{run.failedTests}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-600">{run.skippedTests}</div>
                <div className="text-xs text-gray-500">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-600">{run.totalTests}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestResults;