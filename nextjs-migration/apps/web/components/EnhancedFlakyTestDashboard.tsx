import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AIAnalysisCard, { AIAnalysis } from './AIAnalysisCard';
import AIAnalyticsDashboard from './AIAnalyticsDashboard';

interface FlakyTestWithAI {
  id: string;
  testName: string;
  testSuite?: string;
  failureRate: number;
  totalRuns: number;
  failedRuns: number;
  confidence: number;
  lastSeen: string;
  isActive: boolean;
  latestAnalysis?: AIAnalysis;
  analysisCount: number;
}

interface EnhancedFlakyTestDashboardProps {
  projectId: string;
}

const EnhancedFlakyTestDashboard: React.FC<EnhancedFlakyTestDashboardProps> = ({ projectId }) => {
  const [flakyTests, setFlakyTests] = useState<FlakyTestWithAI[]>([]);
  const [selectedTest, setSelectedTest] = useState<FlakyTestWithAI | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<'tests' | 'analytics'>('tests');
  const [triggeringAnalysis, setTriggeringAnalysis] = useState<string | null>(null);
  
  const { token } = useAuth();
  const pageSize = 10;

  const fetchFlakyTestsWithAI = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/flaky-tests/${projectId}/with-ai?page=${page}&pageSize=${pageSize}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch flaky tests');
      }

      const data = await response.json();
      setFlakyTests(data.data || []);
      setCurrentPage(data.pagination.page);
      setTotalPages(Math.ceil(data.pagination.total / pageSize));
      
    } catch (err) {
      console.error('Error fetching flaky tests with AI:', err);
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

      // Refresh the flaky tests list
      await fetchFlakyTestsWithAI(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze tests');
    } finally {
      setAnalyzing(false);
    }
  };

  const triggerAIAnalysis = async (testId: string) => {
    try {
      setTriggeringAnalysis(testId);
      
      // Get the latest test result for this test (simplified - in production, you'd have a better way to get this)
      const response = await fetch('/api/flaky-tests/ai-analysis/trigger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testResultId: 'latest' }), // This would be a real test result ID
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger AI analysis');
      }

      // Refresh the test data
      await fetchFlakyTestsWithAI(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger AI analysis');
    } finally {
      setTriggeringAnalysis(null);
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
      await fetchFlakyTestsWithAI(currentPage);
      if (selectedTest && selectedTest.testName === testName) {
        setSelectedTest(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark test as resolved');
    }
  };

  useEffect(() => {
    fetchFlakyTestsWithAI(1);
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

  if (loading && flakyTests.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error && flakyTests.length === 0) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <div className="font-medium">Error loading flaky tests:</div>
        <div className="text-sm mt-1">{error}</div>
        <button
          onClick={() => fetchFlakyTestsWithAI(1)}
          className="text-red-800 underline hover:text-red-900 text-sm mt-2"
        >
          Retry
        </button>
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
              {selectedTest.testSuite && (
                <p className="text-gray-600">in {selectedTest.testSuite}</p>
              )}
            </div>
            <div className="flex space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${risk.color}`}>
                {risk.label}
              </span>
              {!selectedTest.latestAnalysis && (
                <button
                  onClick={() => triggerAIAnalysis(selectedTest.id)}
                  disabled={triggeringAnalysis === selectedTest.id}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {triggeringAnalysis === selectedTest.id ? 'Analyzing...' : 'AI Analysis'}
                </button>
              )}
              <button
                onClick={() => markAsResolved(selectedTest.testName, selectedTest.testSuite)}
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
              <div className="text-2xl font-bold text-red-600">{selectedTest.failedRuns}</div>
              <div className="text-sm text-gray-500">Failed Runs</div>
            </div>
          </div>

          {/* Analysis count and last seen */}
          <div className="border-t border-gray-200 pt-4 mb-6">
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                <span className="font-medium">AI Analyses:</span> {selectedTest.analysisCount}
              </span>
              <span>
                <span className="font-medium">Last seen:</span> {new Date(selectedTest.lastSeen).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {selectedTest.latestAnalysis && (
          <AIAnalysisCard
            analysis={selectedTest.latestAnalysis}
            testName={selectedTest.testName}
            onTriggerNewAnalysis={() => triggerAIAnalysis(selectedTest.id)}
            isLoading={triggeringAnalysis === selectedTest.id}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">AI-Enhanced Flaky Test Detection</h3>
          <div className="flex space-x-3">
            <button
              onClick={() => fetchFlakyTestsWithAI(currentPage)}
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
        
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tests'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Flaky Tests ({flakyTests.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            AI Analytics
          </button>
        </nav>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'analytics' ? (
        <AIAnalyticsDashboard projectId={projectId} />
      ) : (
        <>
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
            <>
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">Detected Flaky Tests</h4>
                </div>
                <div className="divide-y divide-gray-200">
                  {flakyTests.map((test) => {
                    const risk = getRiskLevel(test.failureRate);
                    return (
                      <div
                        key={test.id}
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
                              {test.testSuite && (
                                <span className="text-sm text-gray-500">in {test.testSuite}</span>
                              )}
                              {test.latestAnalysis && (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                  🧠 AI Analyzed
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                              <span>Failure rate: {(test.failureRate * 100).toFixed(1)}%</span>
                              <span>Confidence: <span className={getConfidenceColor(test.confidence)}>{(test.confidence * 100).toFixed(0)}%</span></span>
                              <span>Runs: {test.failedRuns}/{test.totalRuns}</span>
                              {test.latestAnalysis && (
                                <span>
                                  Category: {test.latestAnalysis.primaryCategory.replace('-', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            <div>Last seen: {new Date(test.lastSeen).toLocaleDateString()}</div>
                            {test.analysisCount > 0 && (
                              <div className="text-xs text-indigo-600">
                                {test.analysisCount} AI {test.analysisCount === 1 ? 'analysis' : 'analyses'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => fetchFlakyTestsWithAI(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => fetchFlakyTestsWithAI(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default EnhancedFlakyTestDashboard;