import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AnalyticsSummary {
  totalTests: number;
  flakyTests: number;
  categoryCounts: Record<string, number>;
  averageConfidence: number;
  topRecommendations: {
    category: string;
    count: number;
    examples: string[];
  }[];
  effortDistribution: Record<'low' | 'medium' | 'high', number>;
  analysisProgress: {
    analyzed: number;
    pending: number;
    percentage: number;
  };
}

interface AIAnalyticsDashboardProps {
  projectId: string;
}

const AIAnalyticsDashboard: React.FC<AIAnalyticsDashboardProps> = ({ projectId }) => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/flaky-tests/${projectId}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [projectId, token]);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'environment': '🌍',
      'timing': '⏱️',
      'data-dependency': '🗄️',
      'external-service': '🌐',
      'concurrency': '🔄',
      'resource-exhaustion': '💾',
      'configuration': '⚙️',
      'unknown': '❓',
    };
    return icons[category] || '❓';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'environment': 'bg-green-100 text-green-800',
      'timing': 'bg-blue-100 text-blue-800',
      'data-dependency': 'bg-purple-100 text-purple-800',
      'external-service': 'bg-orange-100 text-orange-800',
      'concurrency': 'bg-red-100 text-red-800',
      'resource-exhaustion': 'bg-yellow-100 text-yellow-800',
      'configuration': 'bg-gray-100 text-gray-800',
      'unknown': 'bg-gray-100 text-gray-600',
    };
    return colors[category] || 'bg-gray-100 text-gray-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <div className="font-medium">Error loading AI analytics:</div>
        <div className="text-sm mt-1">{error}</div>
        <button
          onClick={fetchAnalytics}
          className="text-red-800 underline hover:text-red-900 text-sm mt-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🤖</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Analytics Available</h3>
        <p className="text-gray-500">Run flaky test analysis to generate AI insights.</p>
      </div>
    );
  }

  const totalAnalyzed = analytics.analysisProgress.analyzed;
  const totalPending = analytics.analysisProgress.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI-Powered Analytics</h3>
          <p className="text-sm text-gray-500">
            Intelligent insights and recommendations for your flaky tests
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="text-indigo-600 hover:text-indigo-800 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <span className="text-indigo-600 text-sm">🧠</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">AI Analyzed</p>
              <p className="text-2xl font-semibold text-gray-900">{totalAnalyzed}</p>
              <p className="text-xs text-gray-400">
                {analytics.analysisProgress.percentage}% complete
              </p>
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
              <p className="text-2xl font-semibold text-gray-900">{analytics.averageConfidence}%</p>
              <p className="text-xs text-gray-400">AI analysis confidence</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 text-sm">⚡</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Quick Fixes</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.effortDistribution.low || 0}</p>
              <p className="text-xs text-gray-400">Low effort solutions</p>
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
              <p className="text-sm font-medium text-gray-500">Complex Issues</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.effortDistribution.high || 0}</p>
              <p className="text-xs text-gray-400">High effort required</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">AI Analysis Progress</h4>
        <div className="mb-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tests Analyzed</span>
            <span>{totalAnalyzed} of {analytics.totalTests}</span>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${analytics.analysisProgress.percentage}%` }}
          ></div>
        </div>
        {totalPending > 0 && (
          <p className="text-sm text-gray-500">
            {totalPending} tests pending AI analysis
          </p>
        )}
      </div>

      {/* Category Distribution & Fix Effort */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failure Categories */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Failure Categories</h4>
          {Object.keys(analytics.categoryCounts).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(analytics.categoryCounts)
                .sort(([,a], [,b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getCategoryIcon(category)}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(category)}`}>
                        {category.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full" 
                          style={{ width: `${(count / analytics.totalTests) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No categorized failures yet</p>
          )}
        </div>

        {/* Fix Effort Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Fix Effort Distribution</h4>
          <div className="space-y-4">
            {(['low', 'medium', 'high'] as const).map((effort) => {
              const count = analytics.effortDistribution[effort] || 0;
              const percentage = analytics.totalTests > 0 ? (count / analytics.totalTests) * 100 : 0;
              const colors = {
                low: 'bg-green-100 text-green-800',
                medium: 'bg-yellow-100 text-yellow-800',
                high: 'bg-red-100 text-red-800',
              };
              const barColors = {
                low: 'bg-green-500',
                medium: 'bg-yellow-500',
                high: 'bg-red-500',
              };
              
              return (
                <div key={effort} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[effort]}`}>
                      {effort} effort
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${barColors[effort]}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Recommendations */}
      {analytics.topRecommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Most Common Recommendations</h4>
          <div className="space-y-4">
            {analytics.topRecommendations.slice(0, 5).map((rec, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900 capitalize">
                    {rec.category.replace('-', ' ')} Issues
                  </h5>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {rec.count} {rec.count === 1 ? 'test' : 'tests'}
                  </span>
                </div>
                <div className="space-y-1">
                  {rec.examples.map((example, exampleIndex) => (
                    <div key={exampleIndex} className="text-sm text-gray-600">
                      • {example}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalyticsDashboard;