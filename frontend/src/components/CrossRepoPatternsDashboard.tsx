import React, { useState, useEffect } from 'react';

interface CrossRepoPattern {
  id: string;
  patternType: 'infrastructure' | 'dependency' | 'environmental' | 'temporal' | 'framework' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  affectedRepos: string[];
  affectedTests: Array<{
    projectId: string;
    projectName: string;
    testName: string;
    testSuite?: string;
    failureRate: number;
    lastFailure: string;
  }>;
  commonFactors: {
    timePatterns?: string[];
    errorPatterns?: string[];
    environmentFactors?: string[];
    dependencyPatterns?: string[];
    frameworkPatterns?: string[];
  };
  rootCause: {
    primaryCause: string;
    secondaryCauses: string[];
    evidenceStrength: number;
    suggestedFixes: string[];
  };
  impactMetrics: {
    totalFailures: number;
    affectedProjectsCount: number;
    estimatedCostImpact: number;
    timeToResolution: number;
  };
  detectedAt: string;
  lastUpdated: string;
}

interface PatternAnalysisResult {
  organizationId: string;
  analysisDate: string;
  detectedPatterns: CrossRepoPattern[];
  patternSummary: {
    totalPatterns: number;
    criticalPatterns: number;
    highImpactPatterns: number;
    mostCommonPatternType: string;
    totalAffectedRepos: number;
    totalEstimatedCost: number;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  trends: {
    newPatternsThisWeek: number;
    resolvedPatternsThisWeek: number;
    avgTimeToResolution: number;
  };
}

interface Props {
  organizationId: string;
}

export const CrossRepoPatternsDashboard: React.FC<Props> = ({ organizationId }) => {
  const [analysisResult, setAnalysisResult] = useState<PatternAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'critical' | 'recommendations'>('overview');
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<CrossRepoPattern | null>(null);
  const [criticalPatterns, setCriticalPatterns] = useState<CrossRepoPattern[]>([]);

  useEffect(() => {
    fetchAnalysisData();
  }, [organizationId]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cross-repo-patterns/organization/${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cross-repo pattern analysis');
      }

      const result = await response.json();
      setAnalysisResult(result.data);

      // Also fetch critical patterns
      await fetchCriticalPatterns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCriticalPatterns = async () => {
    try {
      const response = await fetch(`/api/cross-repo-patterns/organization/${organizationId}/critical`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setCriticalPatterns(result.data.criticalPatterns || []);
      }
    } catch (err) {
      console.error('Failed to fetch critical patterns:', err);
    }
  };

  const triggerAnalysis = async () => {
    try {
      setAnalyzing(true);
      const response = await fetch(`/api/cross-repo-patterns/organization/${organizationId}/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timeWindowDays: 30 })
      });

      if (!response.ok) {
        throw new Error('Failed to trigger analysis');
      }

      await fetchAnalysisData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAnalyzing(false);
    }
  };

  const resolvePattern = async (patternId: string, resolutionNotes: string) => {
    try {
      const response = await fetch(`/api/cross-repo-patterns/pattern/${patternId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolutionNotes })
      });

      if (!response.ok) {
        throw new Error('Failed to resolve pattern');
      }

      await fetchAnalysisData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const getPatternTypeIcon = (type: string): string => {
    switch (type) {
      case 'infrastructure': return '🏗️';
      case 'dependency': return '📦';
      case 'environmental': return '🌍';
      case 'temporal': return '⏰';
      case 'framework': return '🔧';
      default: return '❓';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading cross-repository pattern analysis...</div>
      </div>
    );
  }

  if (error || !analysisResult) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
        <div>Error: {error || 'No analysis data available'}</div>
        <button 
          onClick={fetchAnalysisData}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>Cross-Repository Pattern Detection</h2>
        <button
          onClick={triggerAnalysis}
          disabled={analyzing}
          style={{
            padding: '8px 16px',
            backgroundColor: analyzing ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: analyzing ? 'not-allowed' : 'pointer'
          }}
        >
          {analyzing ? 'Analyzing...' : 'Re-analyze Patterns'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #dee2e6' }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'patterns', label: `Patterns (${analysisResult.detectedPatterns.length})` },
          { key: 'critical', label: `Critical (${criticalPatterns.length})` },
          { key: 'recommendations', label: 'Recommendations' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 20px',
              marginRight: '10px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #007bff' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab.key ? '#007bff' : '#6c757d',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Key Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#007bff', fontSize: '28px' }}>
                {analysisResult.patternSummary.totalPatterns}
              </h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Total Patterns</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Across {analysisResult.patternSummary.totalAffectedRepos} repositories
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#dc3545', fontSize: '28px' }}>
                {analysisResult.patternSummary.criticalPatterns}
              </h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Critical Patterns</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Requiring immediate attention
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#fd7e14', fontSize: '28px' }}>
                {formatCurrency(analysisResult.patternSummary.totalEstimatedCost)}
              </h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Estimated Impact</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Monthly cost of cross-repo issues
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#6f42c1', fontSize: '20px', textTransform: 'capitalize' }}>
                {getPatternTypeIcon(analysisResult.patternSummary.mostCommonPatternType)} {analysisResult.patternSummary.mostCommonPatternType || 'None'}
              </h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Most Common Type</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Primary pattern category
              </div>
            </div>
          </div>

          {/* Pattern Type Distribution */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '30px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Pattern Distribution by Type</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
              {Object.entries(
                analysisResult.detectedPatterns.reduce((counts, pattern) => {
                  counts[pattern.patternType] = (counts[pattern.patternType] || 0) + 1;
                  return counts;
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <div key={type} style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>{getPatternTypeIcon(type)}</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{count}</div>
                  <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'capitalize' }}>{type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trends Summary */}
          {analysisResult.trends && (
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Recent Trends</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                    {analysisResult.trends.newPatternsThisWeek}
                  </div>
                  <div style={{ color: '#6c757d' }}>New patterns this week</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                    {analysisResult.trends.resolvedPatternsThisWeek}
                  </div>
                  <div style={{ color: '#6c757d' }}>Resolved this week</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffc107' }}>
                    {analysisResult.trends.avgTimeToResolution} days
                  </div>
                  <div style={{ color: '#6c757d' }}>Avg. resolution time</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>All Detected Patterns</h3>
          {analysisResult.detectedPatterns.length > 0 ? (
            <div style={{ display: 'grid', gap: '15px' }}>
              {analysisResult.detectedPatterns.map((pattern) => (
                <div 
                  key={pattern.id} 
                  style={{ 
                    backgroundColor: 'white', 
                    padding: '20px', 
                    borderRadius: '8px', 
                    border: `2px solid ${getSeverityColor(pattern.severity)}20`,
                    borderLeft: `4px solid ${getSeverityColor(pattern.severity)}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{getPatternTypeIcon(pattern.patternType)}</span>
                        {pattern.rootCause.primaryCause}
                      </h4>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>
                        {pattern.patternType} • Confidence: {Math.round(pattern.confidence * 100)}%
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: getSeverityColor(pattern.severity) + '20',
                      color: getSeverityColor(pattern.severity),
                      textTransform: 'uppercase'
                    }}>
                      {pattern.severity}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Affected Repositories</div>
                      <div style={{ fontSize: '18px', color: '#007bff' }}>{pattern.affectedRepos.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Total Failures</div>
                      <div style={{ fontSize: '18px', color: '#dc3545' }}>{pattern.impactMetrics.totalFailures}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Estimated Cost</div>
                      <div style={{ fontSize: '18px', color: '#fd7e14' }}>{formatCurrency(pattern.impactMetrics.estimatedCostImpact)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Time to Resolution</div>
                      <div style={{ fontSize: '18px', color: '#6c757d' }}>{pattern.impactMetrics.timeToResolution} days</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '5px' }}>Suggested Fixes:</div>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {pattern.rootCause.suggestedFixes.slice(0, 3).map((fix, index) => (
                        <li key={index} style={{ fontSize: '14px', color: '#495057', marginBottom: '3px' }}>{fix}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => setSelectedPattern(pattern)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      View Details
                    </button>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      Detected: {new Date(pattern.detectedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#28a745' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>No Cross-Repository Patterns Detected!</div>
              <div>Your repositories are operating independently without systemic issues.</div>
            </div>
          )}
        </div>
      )}

      {/* Critical Tab */}
      {activeTab === 'critical' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Critical Patterns Requiring Immediate Action</h3>
          {criticalPatterns.length > 0 ? (
            <div>
              <div style={{ backgroundColor: '#f8d7da', padding: '15px', borderRadius: '8px', border: '1px solid #f5c6cb', marginBottom: '20px' }}>
                <strong style={{ color: '#721c24' }}>🚨 Critical Alert:</strong>
                <span style={{ color: '#721c24', marginLeft: '10px' }}>
                  {criticalPatterns.length} cross-repository patterns are causing systemic issues across multiple projects.
                </span>
              </div>

              <div style={{ display: 'grid', gap: '15px' }}>
                {criticalPatterns.map((pattern) => (
                  <div 
                    key={pattern.id} 
                    style={{ 
                      backgroundColor: 'white', 
                      padding: '20px', 
                      borderRadius: '8px', 
                      border: '2px solid #dc354520',
                      borderLeft: '4px solid #dc3545'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px 0', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{getPatternTypeIcon(pattern.patternType)}</span>
                          {pattern.rootCause.primaryCause}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                          Evidence Strength: {Math.round(pattern.rootCause.evidenceStrength * 100)}%
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: '#dc354520',
                        color: '#dc3545',
                        textTransform: 'uppercase'
                      }}>
                        {pattern.severity}
                      </span>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '5px' }}>
                        Immediate Actions Required:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {pattern.rootCause.suggestedFixes.map((fix, index) => (
                          <li key={index} style={{ fontSize: '14px', color: '#495057', marginBottom: '3px' }}>{fix}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '14px', color: '#dc3545' }}>
                        <strong>Impact:</strong> {pattern.affectedRepos.length} repos, {formatCurrency(pattern.impactMetrics.estimatedCostImpact)} cost
                      </div>
                      <button
                        onClick={() => {
                          const resolution = prompt('Enter resolution notes:');
                          if (resolution) {
                            resolvePattern(pattern.id, resolution);
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#28a745' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>No Critical Cross-Repository Patterns!</div>
              <div>All systemic issues have been resolved or no critical patterns detected.</div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Strategic Recommendations</h3>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Immediate Actions */}
            <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', border: '1px solid #ffeaa7' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#856404', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🚨 Immediate Actions (This Week)
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {analysisResult.recommendations.immediate.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '8px', color: '#856404' }}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Short-term Actions */}
            <div style={{ backgroundColor: '#e7f3ff', padding: '20px', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#0066cc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                📋 Short-term Actions (This Month)
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {analysisResult.recommendations.shortTerm.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '8px', color: '#0066cc' }}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Long-term Strategy */}
            <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🎯 Long-term Strategy (Next Quarter)
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {analysisResult.recommendations.longTerm.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '8px', color: '#0284c7' }}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
        Last analyzed: {new Date(analysisResult.analysisDate).toLocaleString()}
      </div>

      {/* Pattern Details Modal */}
      {selectedPattern && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#333' }}>{selectedPattern.rootCause.primaryCause}</h3>
              <button
                onClick={() => setSelectedPattern(null)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>Affected Tests:</h4>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {selectedPattern.affectedTests.map((test, index) => (
                  <div key={index} style={{ padding: '8px', backgroundColor: '#f8f9fa', marginBottom: '5px', borderRadius: '4px' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{test.testName}</div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>
                      {test.projectName} • Failure Rate: {test.failureRate}% • Last Failure: {new Date(test.lastFailure).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>Root Cause Analysis:</h4>
              <div style={{ marginBottom: '10px' }}>
                <strong>Primary Cause:</strong> {selectedPattern.rootCause.primaryCause}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Secondary Causes:</strong>
                <ul>
                  {selectedPattern.rootCause.secondaryCauses.map((cause, index) => (
                    <li key={index}>{cause}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Evidence Strength:</strong> {Math.round(selectedPattern.rootCause.evidenceStrength * 100)}%
              </div>
            </div>

            <div>
              <h4>Suggested Actions:</h4>
              <ol>
                {selectedPattern.rootCause.suggestedFixes.map((fix, index) => (
                  <li key={index} style={{ marginBottom: '5px' }}>{fix}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossRepoPatternsDashboard;