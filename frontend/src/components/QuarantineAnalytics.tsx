import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface QuarantineAnalyticsProps {
  projectId: string;
}

interface QuarantineMetrics {
  totalQuarantined: number;
  autoQuarantined: number;
  manualQuarantined: number;
  autoUnquarantined: number;
  avgQuarantineDays: number;
  falsePositiveRate: number;
  quarantineSavings: {
    ciTimeMinutes: number;
    developerHours: number;
    buildsProtected: number;
  };
  trendsData: Array<{
    date: string;
    quarantined: number;
    unquarantined: number;
    activeFlakyTests: number;
  }>;
  automationStatus: {
    enabled: boolean;
    schedule: string;
    lastEvaluation?: string;
    evaluationsRun: number;
  };
}

const QuarantineAnalytics: React.FC<QuarantineAnalyticsProps> = ({ projectId }) => {
  const [metrics, setMetrics] = useState<QuarantineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { token } = useAuth();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/quarantine/analytics/${projectId}?timeRange=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quarantine analytics');
      }

      const data = await response.json();
      setMetrics(data.data);

    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [projectId, token, timeRange]);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes.toFixed(0)}min`;
    const hours = minutes / 60;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  const getEffectivenessColor = (rate: number): string => {
    if (rate <= 0.1) return 'text-green-600';
    if (rate <= 0.25) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <span className="text-red-400 mr-3">⚠️</span>
          <div>
            <h3 className="text-sm font-medium text-red-800">Failed to load analytics</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchAnalytics}
          className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">📊</span>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
        <p className="text-gray-500">No quarantine data available for this project yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📊 Quarantine Analytics</h3>
          <p className="text-sm text-gray-500">Performance metrics and insights for automated quarantine system</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Time Range:</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Automation Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">🤖 Automation Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold mb-1 ${metrics.automationStatus.enabled ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.automationStatus.enabled ? '✅ Enabled' : '❌ Disabled'}
            </div>
            <div className="text-sm text-gray-500">Automation Status</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">{metrics.automationStatus.schedule}</div>
            <div className="text-sm text-gray-500">Schedule</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {metrics.automationStatus.lastEvaluation ? 
                new Date(metrics.automationStatus.lastEvaluation).toLocaleDateString() : 
                'Never'
              }
            </div>
            <div className="text-sm text-gray-500">Last Evaluation</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600 mb-1">{metrics.automationStatus.evaluationsRun}</div>
            <div className="text-sm text-gray-500">Evaluations Run</div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">🎯 Effectiveness</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">False Positive Rate</span>
              <span className={`text-sm font-medium ${getEffectivenessColor(metrics.falsePositiveRate)}`}>
                {(metrics.falsePositiveRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Automation Rate</span>
              <span className="text-sm font-medium text-green-600">
                {metrics.totalQuarantined > 0 ? 
                  ((metrics.autoQuarantined / metrics.totalQuarantined) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Avg Quarantine Time</span>
              <span className="text-sm font-medium text-blue-600">
                {metrics.avgQuarantineDays.toFixed(1)} days
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">⏱️ Time Savings</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">CI Time Saved</span>
              <span className="text-sm font-medium text-green-600">
                {formatDuration(metrics.quarantineSavings.ciTimeMinutes)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Developer Hours</span>
              <span className="text-sm font-medium text-blue-600">
                {metrics.quarantineSavings.developerHours.toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Builds Protected</span>
              <span className="text-sm font-medium text-purple-600">
                {metrics.quarantineSavings.buildsProtected}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">📈 Activity</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Quarantined</span>
              <span className="text-sm font-medium text-red-600">{metrics.totalQuarantined}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Auto Unquarantined</span>
              <span className="text-sm font-medium text-green-600">{metrics.autoUnquarantined}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Manual Actions</span>
              <span className="text-sm font-medium text-yellow-600">{metrics.manualQuarantined}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trends Chart */}
      {metrics.trendsData && metrics.trendsData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">📊 Quarantine Trends</h4>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📈</div>
            <p className="text-gray-500">Trend visualization would be implemented here</p>
            <p className="text-sm text-gray-400 mt-2">
              Showing quarantine/unquarantine activity over {timeRange}
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-indigo-900 mb-4">💡 Recommendations</h4>
        <div className="space-y-3">
          {metrics.falsePositiveRate > 0.2 && (
            <div className="flex items-start space-x-3">
              <span className="text-orange-500 mt-1">⚠️</span>
              <div>
                <p className="text-sm font-medium text-indigo-900">High False Positive Rate</p>
                <p className="text-sm text-indigo-700">
                  Consider adjusting quarantine thresholds to reduce false positives ({(metrics.falsePositiveRate * 100).toFixed(1)}% current rate).
                </p>
              </div>
            </div>
          )}
          
          {!metrics.automationStatus.enabled && (
            <div className="flex items-start space-x-3">
              <span className="text-blue-500 mt-1">🔧</span>
              <div>
                <p className="text-sm font-medium text-indigo-900">Enable Automation</p>
                <p className="text-sm text-indigo-700">
                  Automated quarantine is disabled. Enable it to automatically manage flaky tests.
                </p>
              </div>
            </div>
          )}
          
          {metrics.avgQuarantineDays > 14 && (
            <div className="flex items-start space-x-3">
              <span className="text-yellow-500 mt-1">📅</span>
              <div>
                <p className="text-sm font-medium text-indigo-900">Long Quarantine Period</p>
                <p className="text-sm text-indigo-700">
                  Tests are staying quarantined for {metrics.avgQuarantineDays.toFixed(1)} days on average. Consider reviewing unquarantine criteria.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuarantineAnalytics;