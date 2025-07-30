import React from 'react';

export interface AIRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: string;
  codeExample?: string;
  documentation?: string;
}

export interface AIRecommendationSet {
  immediate: AIRecommendation[];
  shortTerm: AIRecommendation[];
  longTerm: AIRecommendation[];
}

export interface AIAnalysis {
  id: string;
  primaryCategory: string;
  secondaryCategories: string[];
  confidence: number;
  errorPattern?: string;
  stackTraceSignature?: string;
  timingIssues: string[];
  environmentFactors: string[];
  recommendations: AIRecommendationSet;
  estimatedFixEffort: 'low' | 'medium' | 'high';
  similarIssuesCount: number;
  modelVersion: string;
  processingTime: number;
  dataQuality: number;
  createdAt: string;
  updatedAt: string;
}

interface AIAnalysisCardProps {
  analysis: AIAnalysis;
  testName: string;
  onTriggerNewAnalysis?: () => void;
  isLoading?: boolean;
}

const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({ 
  analysis, 
  testName, 
  onTriggerNewAnalysis,
  isLoading = false 
}) => {
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

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded w-32"></div>
            <div className="h-5 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getCategoryIcon(analysis.primaryCategory)}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {analysis.enhanced ? '🧠 Enhanced AI Analysis' : 'AI Root Cause Analysis'}
              </h3>
              <p className="text-sm text-gray-500">for {testName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(analysis.confidence)}`}>
              {(analysis.confidence * 100).toFixed(0)}% confidence
            </span>
            {analysis.enhanced && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                ML Enhanced
              </span>
            )}
            {analysis.historicalPattern?.recentTrend && analysis.historicalPattern.recentTrend !== 'stable' && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                analysis.historicalPattern.recentTrend === 'worsening' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                {analysis.historicalPattern.recentTrend === 'worsening' ? '📈 Worsening' : '📉 Improving'}
              </span>
            )}
            {onTriggerNewAnalysis && (
              <button
                onClick={onTriggerNewAnalysis}
                className="text-indigo-600 hover:text-indigo-800 text-sm"
              >
                Refresh Analysis
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Analysis */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Primary Category</h4>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(analysis.primaryCategory)}`}>
              {getCategoryIcon(analysis.primaryCategory)} {analysis.primaryCategory.replace('-', ' ')}
            </span>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Fix Effort</h4>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEffortColor(analysis.estimatedFixEffort)}`}>
              {analysis.estimatedFixEffort} effort
            </span>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Similar Issues</h4>
            <span className="text-sm text-gray-900">
              {analysis.similarIssuesCount} similar {analysis.similarIssuesCount === 1 ? 'issue' : 'issues'} found
            </span>
          </div>
        </div>

        {/* Secondary Categories */}
        {analysis.secondaryCategories.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Secondary Categories</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.secondaryCategories.map((category, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getCategoryColor(category)}`}
                >
                  {getCategoryIcon(category)} {category.replace('-', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Analysis Section */}
        {analysis.enhanced && (analysis.historicalPattern || analysis.crossTestPatterns) && (
          <div className="mb-6 bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-800 mb-3">🧠 ML-Enhanced Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.historicalPattern && (
                <div>
                  <h5 className="text-xs font-medium text-purple-700 mb-2">Historical Pattern</h5>
                  <div className="space-y-1">
                    <div className="text-xs text-purple-600">
                      Failure frequency: {(analysis.historicalPattern.failureFrequency * 30).toFixed(1)} per month
                    </div>
                    <div className="text-xs text-purple-600">
                      Pattern: {analysis.historicalPattern.timingPattern}
                    </div>
                  </div>
                </div>
              )}
              {analysis.crossTestPatterns && analysis.crossTestPatterns.relatedFlakyTests.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-purple-700 mb-2">Related Tests</h5>
                  <div className="text-xs text-purple-600">
                    {analysis.crossTestPatterns.relatedFlakyTests.length} related flaky tests found
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Pattern */}
        {analysis.errorPattern && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Error Pattern</h4>
            <div className="bg-gray-50 rounded-md p-3">
              <code className="text-sm text-gray-800">{analysis.errorPattern}</code>
            </div>
          </div>
        )}

        {/* Timing Issues */}
        {analysis.timingIssues.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Timing Issues Detected</h4>
            <ul className="list-disc list-inside space-y-1">
              {analysis.timingIssues.map((issue, index) => (
                <li key={index} className="text-sm text-gray-600">{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Environment Factors */}
        {analysis.environmentFactors.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Environmental Factors</h4>
            <ul className="list-disc list-inside space-y-1">
              {analysis.environmentFactors.map((factor, index) => (
                <li key={index} className="text-sm text-gray-600">{factor}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="px-6 py-4 border-t border-gray-200">
        <h4 className="text-lg font-medium text-gray-900 mb-4">AI Recommendations</h4>
        
        {/* Immediate Actions */}
        {analysis.recommendations.immediate.length > 0 && (
          <div className="mb-6">
            <h5 className="text-sm font-medium text-red-700 mb-3 flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              Immediate Actions
            </h5>
            <div className="space-y-3">
              {analysis.recommendations.immediate.map((rec, index) => (
                <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h6 className="font-medium">{rec.title}</h6>
                    <div className="flex space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getEffortColor(rec.effort)}`}>
                        {rec.effort}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {rec.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm mb-2">{rec.description}</p>
                  {rec.codeExample && (
                    <div className="bg-gray-900 text-gray-100 rounded p-2 text-xs font-mono">
                      <code>{rec.codeExample}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Short-term Actions */}
        {analysis.recommendations.shortTerm.length > 0 && (
          <div className="mb-6">
            <h5 className="text-sm font-medium text-yellow-700 mb-3 flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
              Short-term Improvements
            </h5>
            <div className="space-y-3">
              {analysis.recommendations.shortTerm.map((rec, index) => (
                <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h6 className="font-medium">{rec.title}</h6>
                    <div className="flex space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getEffortColor(rec.effort)}`}>
                        {rec.effort}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {rec.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Long-term Actions */}
        {analysis.recommendations.longTerm.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-green-700 mb-3 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Long-term Strategy
            </h5>
            <div className="space-y-3">
              {analysis.recommendations.longTerm.map((rec, index) => (
                <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h6 className="font-medium">{rec.title}</h6>
                    <div className="flex space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getEffortColor(rec.effort)}`}>
                        {rec.effort}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {rec.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            Analyzed: {new Date(analysis.createdAt).toLocaleString()} • 
            Model: {analysis.modelVersion} • 
            Processing: {analysis.processingTime}ms
          </span>
          <span>
            Data Quality: {(analysis.dataQuality * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisCard;