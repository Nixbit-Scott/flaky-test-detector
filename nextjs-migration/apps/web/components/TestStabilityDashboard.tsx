import React, { useState, useEffect } from 'react';

interface StabilityScore {
  testId: string;
  testName: string;
  testSuite?: string;
  currentScore: number;
  trend: 'improving' | 'degrading' | 'stable' | 'volatile';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastCalculated: string;
}

interface TrendDataPoint {
  date: string;
  score: number;
  successRate: number;
  runCount: number;
}

interface TrendAnalysis {
  period: 'daily' | 'weekly' | 'monthly';
  dataPoints: TrendDataPoint[];
  trendDirection: 'improving' | 'degrading' | 'stable';
  changeRate: number;
  volatility: number;
  seasonality: {
    hasPattern: boolean;
    peakDays?: string[];
    peakHours?: number[];
  };
}

interface StabilityReport {
  projectId: string;
  generatedAt: string;
  overallStability: number;
  totalTests: number;
  stableTests: number;
  unstableTests: number;
  criticalTests: number;
  topUnstableTests: StabilityScore[];
  stabilityDistribution: Record<string, number>;
  trends: {
    daily: TrendAnalysis;
    weekly: TrendAnalysis;
    monthly: TrendAnalysis;
  };
  insights: string[];
  recommendations: string[];
}

interface Props {
  projectId: string;
}

export const TestStabilityDashboard: React.FC<Props> = ({ projectId }) => {
  const [stabilityReport, setStabilityReport] = useState<StabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tests' | 'trends' | 'critical'>('overview');
  const [calculating, setCalculating] = useState(false);
  const [testScores, setTestScores] = useState<StabilityScore[]>([]);
  const [criticalTests, setCriticalTests] = useState<StabilityScore[]>([]);

  useEffect(() => {
    fetchStabilityData();
  }, [projectId]);

  const fetchStabilityData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stability/project/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stability data');
      }

      const result = await response.json();
      setStabilityReport(result.data);

      // Also fetch test scores and critical tests
      await Promise.all([
        fetchTestScores(),
        fetchCriticalTests()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTestScores = async () => {
    try {
      const response = await fetch(`/api/stability/project/${projectId}/tests?sortBy=score&order=asc&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setTestScores(result.data.tests);
      }
    } catch (err) {
      console.error('Failed to fetch test scores:', err);
    }
  };

  const fetchCriticalTests = async () => {
    try {
      const response = await fetch(`/api/stability/project/${projectId}/critical`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setCriticalTests(result.data.criticalTests);
      }
    } catch (err) {
      console.error('Failed to fetch critical tests:', err);
    }
  };

  const recalculateStability = async () => {
    try {
      setCalculating(true);
      const response = await fetch(`/api/stability/project/${projectId}/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate stability');
      }

      await fetchStabilityData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCalculating(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#28a745'; // Green
    if (score >= 75) return '#ffc107'; // Yellow
    if (score >= 50) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
  };

  const getRiskLevelColor = (level: string): string => {
    switch (level) {
      case 'low': return '#28a745';
      case 'medium': return '#ffc107';
      case 'high': return '#fd7e14';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '📈';
      case 'degrading': return '📉';
      case 'volatile': return '📊';
      default: return '➡️';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading stability analysis...</div>
      </div>
    );
  }

  if (error || !stabilityReport) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
        <div>Error: {error || 'No stability data available'}</div>
        <button 
          onClick={fetchStabilityData}
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
        <h2 style={{ margin: 0, color: '#333' }}>Test Stability Analysis</h2>
        <button
          onClick={recalculateStability}
          disabled={calculating}
          style={{
            padding: '8px 16px',
            backgroundColor: calculating ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: calculating ? 'not-allowed' : 'pointer'
          }}
        >
          {calculating ? 'Calculating...' : 'Recalculate'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #dee2e6' }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'tests', label: 'Test Scores' },
          { key: 'trends', label: 'Trends' },
          { key: 'critical', label: `Critical (${criticalTests.length})` }
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
              <h3 style={{ margin: '0 0 10px 0', color: getScoreColor(stabilityReport.overallStability), fontSize: '32px' }}>
                {Math.round(stabilityReport.overallStability)}%
              </h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Overall Stability</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                {stabilityReport.totalTests} total tests analyzed
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#28a745', fontSize: '28px' }}>{stabilityReport.stableTests}</h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Stable Tests</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Score ≥ 80% • {Math.round((stabilityReport.stableTests / stabilityReport.totalTests) * 100)}% of total
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#ffc107', fontSize: '28px' }}>{stabilityReport.unstableTests}</h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Unstable Tests</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Score 60-79% • Need attention
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#dc3545', fontSize: '28px' }}>{stabilityReport.criticalTests}</h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Critical Tests</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Score &lt; 60% • Immediate action required
              </div>
            </div>
          </div>

          {/* Insights and Recommendations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div style={{ backgroundColor: '#e7f3ff', padding: '20px', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#0066cc' }}>💡 Key Insights</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {stabilityReport.insights.map((insight, index) => (
                  <li key={index} style={{ marginBottom: '8px', color: '#0066cc' }}>{insight}</li>
                ))}
              </ul>
            </div>

            <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', border: '1px solid #ffeaa7' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>🎯 Recommendations</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {stabilityReport.recommendations.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '8px', color: '#856404' }}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stability Distribution */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Stability Distribution</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px' }}>
              {Object.entries(stabilityReport.stabilityDistribution).map(([level, count]) => (
                <div key={level} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{count}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d', textTransform: 'capitalize' }}>{level}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test Scores Tab */}
      {activeTab === 'tests' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Test Stability Scores</h3>
          {testScores.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e9ecef' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Test Name</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>Score</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>Trend</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>Risk Level</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {testScores.map((test, index) => (
                    <tr key={test.testId} style={{ borderBottom: index < testScores.length - 1 ? '1px solid #e9ecef' : 'none' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
                        <div>{test.testName}</div>
                        {test.testSuite && (
                          <div style={{ fontSize: '11px', color: '#6c757d' }}>{test.testSuite}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: getScoreColor(test.currentScore),
                          fontSize: '16px'
                        }}>
                          {Math.round(test.currentScore)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '20px' }}>{getTrendIcon(test.trend)}</span>
                        <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'capitalize' }}>
                          {test.trend}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          backgroundColor: getRiskLevelColor(test.riskLevel) + '20',
                          color: getRiskLevelColor(test.riskLevel),
                          textTransform: 'uppercase'
                        }}>
                          {test.riskLevel}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold' }}>{Math.round(test.confidence * 100)}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              <div>No test scores available</div>
            </div>
          )}
        </div>
      )}

      {/* Critical Tests Tab */}
      {activeTab === 'critical' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Tests Requiring Immediate Attention</h3>
          {criticalTests.length > 0 ? (
            <div>
              <div style={{ backgroundColor: '#f8d7da', padding: '15px', borderRadius: '8px', border: '1px solid #f5c6cb', marginBottom: '20px' }}>
                <strong style={{ color: '#721c24' }}>⚠️ Critical Alert:</strong>
                <span style={{ color: '#721c24', marginLeft: '10px' }}>
                  {criticalTests.length} tests have stability scores below 60% and need immediate investigation.
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e9ecef' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Test Name</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>Score</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>Trend</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>Risk Level</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Last Calculated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalTests.map((test, index) => (
                      <tr key={test.testId} style={{ borderBottom: index < criticalTests.length - 1 ? '1px solid #e9ecef' : 'none' }}>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
                          <div style={{ fontWeight: 'bold' }}>{test.testName}</div>
                          {test.testSuite && (
                            <div style={{ fontSize: '11px', color: '#6c757d' }}>{test.testSuite}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: '#dc3545',
                            fontSize: '18px'
                          }}>
                            {Math.round(test.currentScore)}%
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '20px' }}>{getTrendIcon(test.trend)}</span>
                          <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'capitalize' }}>
                            {test.trend}
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: '#dc354520',
                            color: '#dc3545',
                            textTransform: 'uppercase'
                          }}>
                            {test.riskLevel}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#6c757d' }}>
                          {new Date(test.lastCalculated).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#28a745' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>No Critical Tests!</div>
              <div>All tests have stability scores above 60%. Great work!</div>
            </div>
          )}
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Stability Trends</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Daily Trend</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Direction:</span>
                <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {getTrendIcon(stabilityReport.trends.daily.trendDirection)} {stabilityReport.trends.daily.trendDirection}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Change Rate:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {stabilityReport.trends.daily.changeRate > 0 ? '+' : ''}{stabilityReport.trends.daily.changeRate.toFixed(2)}%/day
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Volatility:</span>
                <span style={{ fontWeight: 'bold' }}>{stabilityReport.trends.daily.volatility.toFixed(1)}</span>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Weekly Trend</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Direction:</span>
                <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {getTrendIcon(stabilityReport.trends.weekly.trendDirection)} {stabilityReport.trends.weekly.trendDirection}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Change Rate:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {stabilityReport.trends.weekly.changeRate > 0 ? '+' : ''}{stabilityReport.trends.weekly.changeRate.toFixed(2)}%/week
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Volatility:</span>
                <span style={{ fontWeight: 'bold' }}>{stabilityReport.trends.weekly.volatility.toFixed(1)}</span>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Monthly Trend</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Direction:</span>
                <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {getTrendIcon(stabilityReport.trends.monthly.trendDirection)} {stabilityReport.trends.monthly.trendDirection}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Change Rate:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {stabilityReport.trends.monthly.changeRate > 0 ? '+' : ''}{stabilityReport.trends.monthly.changeRate.toFixed(2)}%/month
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Volatility:</span>
                <span style={{ fontWeight: 'bold' }}>{stabilityReport.trends.monthly.volatility.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Seasonality Analysis */}
          {stabilityReport.trends.daily.seasonality.hasPattern && (
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>🔍 Seasonality Patterns Detected</h4>
              {stabilityReport.trends.daily.seasonality.peakDays && (
                <div style={{ marginBottom: '10px' }}>
                  <strong>Peak Failure Days:</strong> {stabilityReport.trends.daily.seasonality.peakDays.join(', ')}
                </div>
              )}
              {stabilityReport.trends.daily.seasonality.peakHours && (
                <div>
                  <strong>Peak Failure Hours:</strong> {stabilityReport.trends.daily.seasonality.peakHours.join(', ')}:00
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
        Last calculated: {new Date(stabilityReport.generatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default TestStabilityDashboard;