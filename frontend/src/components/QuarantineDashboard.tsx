import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface QuarantinedTest {
  id: string;
  testName: string;
  testSuite?: string;
  failureRate: number;
  totalRuns: number;
  failedRuns: number;
  confidence: number;
  quarantinedAt?: string;
  quarantinedBy?: string;
  quarantineReason?: string;
  quarantineDays: number;
  latestHistory?: {
    action: string;
    reason?: string;
    triggeredBy?: string;
    createdAt: string;
  };
  currentImpact?: {
    buildsBlocked: number;
    ciTimeWasted: number;
    developerHours: number;
  };
}

interface QuarantineStats {
  totalQuarantined: number;
  autoQuarantined: number;
  manualQuarantined: number;
  autoUnquarantined: number;
  quarantineSavings: {
    ciTimeMinutes: number;
    developerHours: number;
    buildsProtected: number;
  };
  avgQuarantineDays: number;
  falsePositiveRate: number;
}

interface QuarantineDashboardProps {
  projectId: string;
}

const QuarantineDashboard: React.FC<QuarantineDashboardProps> = ({ projectId }) => {
  const [quarantinedTests, setQuarantinedTests] = useState<QuarantinedTest[]>([]);
  const [stats, setStats] = useState<QuarantineStats | null>(null);
  const [selectedTest, setSelectedTest] = useState<QuarantinedTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const { token } = useAuth();

  const fetchQuarantineData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [testsResponse, statsResponse] = await Promise.all([
        fetch(`/api/quarantine/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/quarantine/stats/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!testsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch quarantine data');
      }

      const testsData = await testsResponse.json();
      const statsData = await statsResponse.json();

      setQuarantinedTests(testsData.data || []);
      setStats(statsData.data);
      
    } catch (err) {
      console.error('Error fetching quarantine data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnquarantine = async (test: QuarantinedTest) => {
    try {
      setActionLoading(test.id);
      
      const response = await fetch('/api/quarantine/unquarantine', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flakyTestPatternId: test.id,
          reason: 'Manual unquarantine from dashboard',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unquarantine test');
      }

      // Refresh data
      await fetchQuarantineData();
      setSelectedTest(null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unquarantine test');
    } finally {
      setActionLoading(null);
    }
  };

  const runUnquarantineCheck = async () => {
    try {
      setActionLoading('check');
      
      const response = await fetch(`/api/quarantine/run-check/${projectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run unquarantine check');
      }

      // Refresh data after check
      await fetchQuarantineData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run check');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchQuarantineData();
  }, [projectId, token]);

  const getQuarantineStatusColor = (days: number) => {
    if (days <= 3) return 'text-yellow-600 bg-yellow-100';
    if (days <= 7) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getQuarantineStatusLabel = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
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
        <div className="font-medium">Error loading quarantine data:</div>
        <div className="text-sm mt-1">{error}</div>
        <button
          onClick={fetchQuarantineData}
          className="text-red-800 underline hover:text-red-900 text-sm mt-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (selectedTest) {
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
          Back to Quarantine Dashboard
        </button>

        {/* Test details */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{selectedTest.testName}</h3>
              {selectedTest.testSuite && (
                <p className="text-gray-600">in {selectedTest.testSuite}</p>
              )}
              <div className="mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getQuarantineStatusColor(selectedTest.quarantineDays)}`}>
                  🔒 Quarantined {getQuarantineStatusLabel(selectedTest.quarantineDays)} ago
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => handleUnquarantine(selectedTest)}
                disabled={actionLoading === selectedTest.id}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === selectedTest.id ? 'Unquarantining...' : 'Unquarantine'}
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
              <div className="text-2xl font-bold text-yellow-600">{(selectedTest.confidence * 100).toFixed(0)}%</div>
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

          {/* Quarantine details */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Quarantine Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-gray-700">Quarantined By</div>
                <div className="text-gray-900">{selectedTest.quarantinedBy === 'auto' ? 'Automatic System' : 'Manual'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Reason</div>
                <div className="text-gray-900">{selectedTest.quarantineReason || 'N/A'}</div>
              </div>
              {selectedTest.quarantinedAt && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Quarantined At</div>
                  <div className="text-gray-900">{new Date(selectedTest.quarantinedAt).toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>

          {/* Impact metrics */}
          {selectedTest.currentImpact && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Impact Metrics</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-700">Builds Protected</div>
                  <div className="text-2xl font-bold text-green-600">{selectedTest.currentImpact.buildsBlocked}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">CI Time Saved</div>
                  <div className="text-2xl font-bold text-blue-600">{selectedTest.currentImpact.ciTimeWasted}min</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Developer Hours Saved</div>
                  <div className="text-2xl font-bold text-purple-600">{selectedTest.currentImpact.developerHours.toFixed(1)}h</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Quarantine Management</h3>
          <p className="text-sm text-gray-500">
            Manage quarantined tests and review quarantine effectiveness
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchQuarantineData}
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={runUnquarantineCheck}
            disabled={actionLoading === 'check'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {actionLoading === 'check' ? 'Checking...' : 'Run Stability Check'}
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
                  <span className="text-red-600 text-sm">🔒</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Quarantined Tests</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalQuarantined}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-sm">🛡️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Builds Protected</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.quarantineSavings.buildsProtected}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm">⏱️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Time Saved</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.quarantineSavings.ciTimeMinutes}min</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-sm">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Duration</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.avgQuarantineDays.toFixed(1)} days</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quarantined tests list */}
      {quarantinedTests.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🔓</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Tests in Quarantine</h3>
          <p className="text-gray-500 mb-6">All tests are currently running freely in your CI/CD pipeline.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Quarantined Tests ({quarantinedTests.length})</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {quarantinedTests.map((test) => (
              <div
                key={test.id}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedTest(test)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getQuarantineStatusColor(test.quarantineDays)}`}>
                        {getQuarantineStatusLabel(test.quarantineDays)}
                      </span>
                      <span className="font-medium text-gray-900">{test.testName}</span>
                      {test.testSuite && (
                        <span className="text-sm text-gray-500">in {test.testSuite}</span>
                      )}
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {test.quarantinedBy === 'auto' ? '🤖 Auto' : '👤 Manual'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Failure rate: {(test.failureRate * 100).toFixed(1)}%</span>
                      <span>Confidence: {(test.confidence * 100).toFixed(0)}%</span>
                      <span>Runs: {test.failedRuns}/{test.totalRuns}</span>
                      {test.currentImpact && (
                        <span>Builds saved: {test.currentImpact.buildsBlocked}</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">Reason:</span> {test.quarantineReason || 'N/A'}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>Quarantined: {test.quarantinedAt ? new Date(test.quarantinedAt).toLocaleDateString() : 'Unknown'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuarantineDashboard;