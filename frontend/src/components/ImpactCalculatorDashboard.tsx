import React, { useState, useEffect } from 'react';

interface ImpactMetrics {
  totalTimeWasted: number;
  developerHoursLost: number;
  ciCdTimeWasted: number;
  estimatedCostImpact: number;
  developerCostImpact: number;
  infrastructureCostImpact: number;
  deploymentsDelayed: number;
  mergeRequestsBlocked: number;
  velocityReduction: number;
  customerImpactingBugs: number;
  productionDeploymentRisk: number;
  technicalDebtIncrease: number;
}

interface FlakyTestImpact {
  testId: string;
  testName: string;
  failureCount: number;
  avgInvestigationTime: number;
  avgFixTime: number;
  blockedMergeRequests: number;
  delayedDeployments: number;
  falseAlerts: number;
  lastFailureDate: string;
  impact: ImpactMetrics;
}

interface TeamConfiguration {
  averageDeveloperSalary: number;
  infrastructureCostPerMinute: number;
  teamSize: number;
  deploymentFrequency: number;
  costPerDeploymentDelay: number;
}

interface ImpactData {
  totalImpact: ImpactMetrics;
  topFlakyTests: FlakyTestImpact[];
  trendsOverTime: Array<{ date: string; impact: ImpactMetrics }>;
  recommendations: string[];
  teamConfiguration: TeamConfiguration;
  calculatedAt: string;
}

interface Props {
  projectId: string;
}

export const ImpactCalculatorDashboard: React.FC<Props> = ({ projectId }) => {
  const [impactData, setImpactData] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'tests' | 'config'>('overview');
  const [calculating, setCalculating] = useState(false);
  const [teamConfig, setTeamConfig] = useState<Partial<TeamConfiguration>>({});

  useEffect(() => {
    fetchImpactData();
  }, [projectId]);

  const fetchImpactData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/impact/project/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch impact data');
      }

      const result = await response.json();
      setImpactData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const recalculateImpact = async () => {
    try {
      setCalculating(true);
      const response = await fetch(`/api/impact/project/${projectId}/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamConfig)
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate impact');
      }

      const result = await response.json();
      setImpactData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCalculating(false);
    }
  };

  const updateTeamConfiguration = async () => {
    try {
      const response = await fetch(`/api/impact/project/${projectId}/team-config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamConfig)
      });

      if (!response.ok) {
        throw new Error('Failed to update team configuration');
      }

      await recalculateImpact();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading impact analysis...</div>
      </div>
    );
  }

  if (error || !impactData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
        <div>Error: {error || 'No impact data available'}</div>
        <button 
          onClick={fetchImpactData}
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

  const { totalImpact, topFlakyTests, recommendations } = impactData;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>Real-time Impact Calculator</h2>
        <button
          onClick={recalculateImpact}
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
          {calculating ? 'Calculating...' : 'Recalculate Impact'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #dee2e6' }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'trends', label: 'Trends' },
          { key: 'tests', label: 'Top Tests' },
          { key: 'config', label: 'Configuration' }
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
              <h3 style={{ margin: '0 0 10px 0', color: '#dc3545', fontSize: '28px' }}>{formatCurrency(totalImpact.estimatedCostImpact)}</h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Total Cost Impact</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Monthly estimate based on current flaky test patterns
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#fd7e14', fontSize: '28px' }}>{formatTime(totalImpact.totalTimeWasted)}</h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Time Wasted</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                {Math.round(totalImpact.developerHoursLost)} developer hours lost
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#6f42c1', fontSize: '28px' }}>{totalImpact.deploymentsDelayed}</h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Deployments Delayed</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                {totalImpact.mergeRequestsBlocked} merge requests blocked
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#20c997', fontSize: '28px' }}>{Math.round(totalImpact.velocityReduction)}%</h3>
              <p style={{ margin: 0, color: '#6c757d' }}>Velocity Reduction</p>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Team productivity impact
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '30px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Cost Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <div style={{ color: '#6c757d', fontSize: '14px' }}>Developer Costs</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{formatCurrency(totalImpact.developerCostImpact)}</div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '14px' }}>Infrastructure Costs</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{formatCurrency(totalImpact.infrastructureCostImpact)}</div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '14px' }}>CI/CD Time Wasted</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{formatTime(totalImpact.ciCdTimeWasted)}</div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '14px' }}>Technical Debt</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{Math.round(totalImpact.technicalDebtIncrease)}h</div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', border: '1px solid #ffeaa7' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>💡 Recommendations</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {recommendations.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '8px', color: '#856404' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Top Tests Tab */}
      {activeTab === 'tests' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Most Impactful Flaky Tests</h3>
          {topFlakyTests.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e9ecef' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Test Name</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e9ecef' }}>Cost Impact</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e9ecef' }}>Time Wasted</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e9ecef' }}>Failures</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e9ecef' }}>Blocked MRs</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e9ecef' }}>Delayed Deploys</th>
                  </tr>
                </thead>
                <tbody>
                  {topFlakyTests.map((test, index) => (
                    <tr key={test.testId} style={{ borderBottom: index < topFlakyTests.length - 1 ? '1px solid #e9ecef' : 'none' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>{test.testName}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#dc3545' }}>
                        {formatCurrency(test.impact.estimatedCostImpact)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{formatTime(test.impact.totalTimeWasted)}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{test.failureCount}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{test.blockedMergeRequests}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{test.delayedDeployments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              <div>No flaky tests detected in this time period</div>
            </div>
          )}
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Team Configuration</h3>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  Average Developer Salary (Annual)
                </label>
                <input
                  type="number"
                  value={teamConfig.averageDeveloperSalary || impactData.teamConfiguration.averageDeveloperSalary}
                  onChange={(e) => setTeamConfig({ ...teamConfig, averageDeveloperSalary: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  Infrastructure Cost per CI Minute
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={teamConfig.infrastructureCostPerMinute || impactData.teamConfiguration.infrastructureCostPerMinute}
                  onChange={(e) => setTeamConfig({ ...teamConfig, infrastructureCostPerMinute: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  Team Size
                </label>
                <input
                  type="number"
                  value={teamConfig.teamSize || impactData.teamConfiguration.teamSize}
                  onChange={(e) => setTeamConfig({ ...teamConfig, teamSize: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  Deployment Frequency (per week)
                </label>
                <input
                  type="number"
                  value={teamConfig.deploymentFrequency || impactData.teamConfiguration.deploymentFrequency}
                  onChange={(e) => setTeamConfig({ ...teamConfig, deploymentFrequency: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  Cost per Deployment Delay
                </label>
                <input
                  type="number"
                  value={teamConfig.costPerDeploymentDelay || impactData.teamConfiguration.costPerDeploymentDelay}
                  onChange={(e) => setTeamConfig({ ...teamConfig, costPerDeploymentDelay: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <button
              onClick={updateTeamConfiguration}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Update Configuration & Recalculate
            </button>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Impact Trends Over Time</h3>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', textAlign: 'center' }}>
            <div style={{ color: '#6c757d', fontSize: '16px' }}>
              📈 Trend visualization coming soon
            </div>
            <div style={{ color: '#6c757d', fontSize: '14px', marginTop: '10px' }}>
              This will show cost impact trends, velocity changes, and test stability over time
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
        Last calculated: {new Date(impactData.calculatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default ImpactCalculatorDashboard;