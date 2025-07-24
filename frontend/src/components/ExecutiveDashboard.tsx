import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  projectCount: number;
  totalFlakyTests: number;
  totalTestRuns: number;
  lastActivity: string;
}

interface ExecutiveSummary {
  organizationId: string;
  organizationName: string;
  reportPeriod: {
    startDate: string;
    endDate: string;
    periodType: 'weekly' | 'monthly' | 'quarterly';
  };
  keyMetrics: {
    totalProjects: number;
    totalFlakyTests: number;
    flakyTestTrend: number;
    totalTimeWasted: number;
    estimatedCostImpact: number;
    deploymentsDelayed: number;
    avgResolutionTime: number;
    testStabilityScore: number;
  };
  riskAssessment: {
    criticalIssues: number;
    highRiskProjects: number;
    improvementOpportunities: number;
    riskTrend: 'increasing' | 'stable' | 'decreasing';
  };
  businessImpact: {
    developerProductivity: {
      timeWastedPerDeveloper: number;
      productivityLoss: number;
    };
    deploymentFrequency: {
      current: number;
      potential: number;
      improvement: number;
    };
    qualityMetrics: {
      testReliability: number;
      ciStability: number;
      customerImpact: number;
    };
  };
  insights: {
    topIssues: Array<{
      category: string;
      description: string;
      impact: string;
      recommendation: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    achievements: Array<{
      description: string;
      impact: string;
      value: number;
    }>;
    recommendations: Array<{
      action: string;
      expectedImpact: string;
      timeline: string;
      effort: 'low' | 'medium' | 'high';
    }>;
  };
}

interface ProjectPerformance {
  projectId: string;
  projectName: string;
  repository: string;
  metrics: {
    flakyTestCount: number;
    flakyTestTrend: number;
    stabilityScore: number;
    timeWasted: number;
    costImpact: number;
    deploymentsDelayed: number;
    avgResolutionTime: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: string;
}

interface ROIReport {
  organizationId: string;
  investment: {
    toolCost: number;
    implementationTime: number;
    maintenanceTime: number;
  };
  returns: {
    timeRecovered: number;
    costSavings: number;
    productivityGains: number;
    qualityImprovements: number;
  };
  roi: {
    percentage: number;
    paybackPeriod: number;
    netBenefit: number;
  };
}

const ExecutiveDashboard: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'roi' | 'insights'>('overview');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [projects, setProjects] = useState<ProjectPerformance[]>([]);
  const [roiReport, setROIReport] = useState<ROIReport | null>(null);
  const [insights, setInsights] = useState<any>(null);

  const { token } = useAuth();
  const { organizations: contextOrganizations } = useOrganization();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchDashboardData();
    }
  }, [selectedOrg, period]);

  // Refresh executive dashboard when organizations change in context
  useEffect(() => {
    if (contextOrganizations.length > 0) {
      fetchOrganizations();
    }
  }, [contextOrganizations]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/executive-dashboard/organizations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.data.organizations);
        if (data.data.organizations.length > 0) {
          setSelectedOrg(data.data.organizations[0].id);
        }
      } else {
        setError('Failed to fetch organizations');
      }
    } catch (err) {
      setError('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedOrg) return;

    try {
      setLoading(true);
      
      const [summaryRes, projectsRes, roiRes, insightsRes] = await Promise.all([
        fetch(`/api/executive-dashboard/${selectedOrg}/summary?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/executive-dashboard/${selectedOrg}/projects?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/executive-dashboard/${selectedOrg}/roi`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/executive-dashboard/${selectedOrg}/insights`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.data);
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData.data.projects);
      }

      if (roiRes.ok) {
        const roiData = await roiRes.json();
        setROIReport(roiData.data);
      }

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData.data);
      }

    } catch (err) {
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (reportType: string) => {
    try {
      const response = await fetch(`/api/executive-dashboard/${selectedOrg}/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reportType, period })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to export report');
      }
    } catch (err) {
      setError('Failed to export report');
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Organizations Found</h3>
        <p className="text-gray-500">You don't have access to any organizations or teams yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Executive Dashboard</h2>
          <p className="text-sm text-gray-500">
            Comprehensive insights and reporting for engineering leadership
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.projectCount} projects)
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'weekly' | 'monthly' | 'quarterly')}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <button
            onClick={() => exportReport('executive')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Executive Overview', icon: '📊' },
            { key: 'projects', label: 'Project Performance', icon: '📈' },
            { key: 'roi', label: 'ROI Analysis', icon: '💰' },
            { key: 'insights', label: 'AI Insights', icon: '🧠' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Tab Content */}
      {!loading && (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && summary && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Projects</p>
                      <p className="text-2xl font-semibold text-gray-900">{summary.keyMetrics.totalProjects}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Flaky Tests</p>
                      <p className="text-2xl font-semibold text-gray-900">{summary.keyMetrics.totalFlakyTests}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Monthly Cost Impact</p>
                      <p className="text-2xl font-semibold text-gray-900">{formatCurrency(summary.keyMetrics.estimatedCostImpact)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Stability Score</p>
                      <p className="text-2xl font-semibold text-gray-900">{summary.keyMetrics.testStabilityScore.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Impact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Developer Productivity</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Time Wasted per Developer</span>
                      <span className="text-sm font-medium">{summary.businessImpact.developerProductivity.timeWastedPerDeveloper.toFixed(1)} hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Productivity Loss</span>
                      <span className="text-sm font-medium text-red-600">{summary.businessImpact.developerProductivity.productivityLoss.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Test Reliability</span>
                      <span className="text-sm font-medium">{summary.businessImpact.qualityMetrics.testReliability}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">CI Stability</span>
                      <span className="text-sm font-medium">{summary.businessImpact.qualityMetrics.ciStability}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Customer Impact</span>
                      <span className="text-sm font-medium text-green-600">{summary.businessImpact.qualityMetrics.customerImpact} incidents prevented</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{summary.riskAssessment.criticalIssues}</div>
                    <div className="text-sm text-gray-500">Critical Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{summary.riskAssessment.highRiskProjects}</div>
                    <div className="text-sm text-gray-500">High Risk Projects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{summary.riskAssessment.improvementOpportunities}</div>
                    <div className="text-sm text-gray-500">Improvement Opportunities</div>
                  </div>
                </div>
              </div>

              {/* Top Issues */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues</h3>
                <div className="space-y-4">
                  {summary.insights.topIssues.map((issue, index) => (
                    <div key={index} className="border-l-4 border-red-500 pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{issue.category}</h4>
                          <p className="text-sm text-gray-600">{issue.description}</p>
                          <p className="text-sm text-gray-500 mt-1"><strong>Impact:</strong> {issue.impact}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-sm text-indigo-600 mt-2"><strong>Recommendation:</strong> {issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
                <div className="space-y-4">
                  {summary.insights.recommendations.map((rec, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{rec.action}</h4>
                          <p className="text-sm text-gray-600"><strong>Expected Impact:</strong> {rec.expectedImpact}</p>
                          <p className="text-sm text-gray-500"><strong>Timeline:</strong> {rec.timeline}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(rec.effort)}`}>
                          {rec.effort} effort
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Project Performance</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Flaky Tests
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stability Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cost Impact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Risk Level
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projects.map((project) => (
                        <tr key={project.projectId}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{project.projectName}</div>
                              <div className="text-sm text-gray-500">{project.repository}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.metrics.flakyTestCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.metrics.stabilityScore.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(project.metrics.costImpact)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${getRiskLevelColor(project.riskLevel)}`}>
                              {project.riskLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ROI Tab */}
          {activeTab === 'roi' && roiReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Tool Cost</span>
                      <span className="text-sm font-medium">{formatCurrency(roiReport.investment.toolCost)}/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Implementation</span>
                      <span className="text-sm font-medium">{roiReport.investment.implementationTime} hours</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Returns</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Cost Savings</span>
                      <span className="text-sm font-medium text-green-600">{formatCurrency(roiReport.returns.costSavings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Time Recovered</span>
                      <span className="text-sm font-medium text-green-600">{formatNumber(roiReport.returns.timeRecovered)} hours</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">ROI</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">ROI Percentage</span>
                      <span className="text-sm font-medium text-green-600">{roiReport.roi.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Payback Period</span>
                      <span className="text-sm font-medium">{roiReport.roi.paybackPeriod.toFixed(1)} months</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">ROI Analysis</h3>
                <div className="text-center">
                  <div className="text-6xl font-bold text-green-600 mb-2">{roiReport.roi.percentage.toFixed(0)}%</div>
                  <div className="text-lg text-gray-600">Return on Investment</div>
                  <div className="text-sm text-gray-500 mt-2">
                    Net Benefit: <span className="font-medium text-green-600">{formatCurrency(roiReport.roi.netBenefit)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && insights && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Findings</h3>
                <div className="space-y-4">
                  {insights.insights.keyFindings.map((finding: any, index: number) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium text-gray-900">{finding.title}</h4>
                      <p className="text-sm text-gray-600">{finding.description}</p>
                      <p className="text-sm text-blue-600 mt-1"><strong>Recommendation:</strong> {finding.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Items</h3>
                <div className="space-y-4">
                  {insights.insights.actionItems.map((item: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{item.action}</h4>
                          <p className="text-sm text-gray-600"><strong>Expected Impact:</strong> {item.expectedImpact}</p>
                          <p className="text-sm text-gray-500"><strong>Timeline:</strong> {item.timeline}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExecutiveDashboard;