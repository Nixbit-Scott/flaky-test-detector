import React, { useState, useEffect } from 'react';

interface PredictiveAnalysis {
  id: string;
  testFilePath: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  predictedFailureTypes: string[];
  estimatedTimeToFlaky?: number;
  analysisDate: string;
  modelVersion: string;
}

interface ProjectSummary {
  totalFiles: number;
  highRiskFiles: number;
  averageRiskScore: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

interface ModelMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  auc: number;
  modelVersion: string;
  trainedAt: string;
}

interface FeatureImportance {
  feature: string;
  importance: number;
  description: string;
}

interface PredictiveAnalysisDashboardProps {
  projectId: string;
}

export const PredictiveAnalysisDashboard: React.FC<PredictiveAnalysisDashboardProps> = ({
  projectId
}) => {
  const [predictions, setPredictions] = useState<PredictiveAnalysis[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('predictions');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPredictions(),
        loadSummary(),
        loadModelMetrics()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPredictions = async () => {
    try {
      const response = await fetch(`/api/predictions/project/${projectId}?limit=100`);
      const data = await response.json();
      if (data.success) {
        setPredictions(data.data.predictions);
      }
    } catch (error) {
      console.error('Error loading predictions:', error);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await fetch(`/api/predictions/project/${projectId}/summary`);
      const data = await response.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const loadModelMetrics = async () => {
    try {
      const response = await fetch('/api/predictions/model/metrics');
      const data = await response.json();
      if (data.success) {
        setModelMetrics(data.data.model);
        setFeatureImportance(data.data.featureImportance);
      }
    } catch (error) {
      console.error('Error loading model metrics:', error);
    }
  };

  const trainModel = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/predictions/train-model', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        await loadModelMetrics();
        alert('Model training completed successfully!');
      }
    } catch (error) {
      console.error('Error training model:', error);
      alert('Error training model');
    } finally {
      setAnalyzing(false);
    }
  };

  const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getRiskBadgeStyle = (riskLevel: string) => ({
    backgroundColor: getRiskColor(riskLevel),
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold'
  });

  const filteredPredictions = predictions.filter(prediction => {
    const matchesSearch = prediction.testFilePath.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRiskLevel = selectedRiskLevel === 'all' || prediction.riskLevel === selectedRiskLevel;
    return matchesSearch && matchesRiskLevel;
  });

  const formatFailureTypes = (types: string[]): string => {
    return types.map(type => 
      type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    ).join(', ');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div>Loading predictive analysis...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🧠 Predictive Flaky Test Analysis
          </h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
            AI-powered prediction of test flakiness before issues occur
          </p>
        </div>
        <button 
          onClick={trainModel} 
          disabled={analyzing}
          style={{
            backgroundColor: analyzing ? '#9ca3af' : '#7c3aed',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: analyzing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {analyzing ? '🔄 Training Model...' : '⚡ Train Model'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>📄 Total Files Analyzed</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.totalFiles}</div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>⚠️ High Risk Files</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ea580c' }}>{summary.highRiskFiles}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {summary.totalFiles > 0 ? Math.round((summary.highRiskFiles / summary.totalFiles) * 100) : 0}% of total
            </div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>📈 Average Risk Score</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.averageRiskScore.toFixed(2)}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Out of 1.0</div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>🎯 Model Accuracy</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a' }}>
              {modelMetrics ? Math.round(modelMetrics.accuracy * 100) : 0}%
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Model {modelMetrics?.modelVersion || 'v1.0'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {['predictions', 'insights', 'features'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                borderBottom: activeTab === tab ? '2px solid #7c3aed' : '2px solid transparent',
                color: activeTab === tab ? '#7c3aed' : '#6b7280',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'predictions' ? '🔮 Risk Predictions' : 
               tab === 'insights' ? '📊 Model Insights' : 
               '🔬 Feature Analysis'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'predictions' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Search test files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            />
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Predictions Table */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>Test File Risk Analysis</h3>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                Predictive analysis results for test files in this project
              </p>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>File Path</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Risk Level</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Risk Score</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Confidence</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Predicted Issues</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>ETA to Flaky</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.map((prediction, index) => (
                    <tr key={prediction.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          📁 
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {prediction.testFilePath}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={getRiskBadgeStyle(prediction.riskLevel)}>
                          {prediction.riskLevel.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div 
                            style={{ 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%', 
                              backgroundColor: getRiskColor(prediction.riskLevel) 
                            }} 
                          />
                          <span style={{ color: getRiskColor(prediction.riskLevel), fontWeight: 'bold' }}>
                            {prediction.riskScore.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        {Math.round(prediction.confidence * 100)}%
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', maxWidth: '250px' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatFailureTypes(prediction.predictedFailureTypes)}
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        {prediction.estimatedTimeToFlaky ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ea580c' }}>
                            🕐 {prediction.estimatedTimeToFlaky} days
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredPredictions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                  No predictions found matching your criteria
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Model Performance */}
          {modelMetrics && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 Model Performance Metrics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                    {Math.round(modelMetrics.precision * 100)}%
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Precision</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                    {Math.round(modelMetrics.recall * 100)}%
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Recall</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
                    {Math.round(modelMetrics.f1Score * 100)}%
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>F1-Score</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                    {Math.round(modelMetrics.accuracy * 100)}%
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Accuracy</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                    {Math.round(modelMetrics.auc * 100)}%
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>AUC</div>
                </div>
              </div>
              <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
                Model Version: {modelMetrics.modelVersion} • 
                Trained: {new Date(modelMetrics.trainedAt).toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Risk Distribution */}
          {summary && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>Risk Distribution</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>
                    {summary.riskDistribution.low || 0}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Low Risk</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#d97706' }}>
                    {summary.riskDistribution.medium || 0}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Medium Risk</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ea580c' }}>
                    {summary.riskDistribution.high || 0}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>High Risk</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
                    {summary.riskDistribution.critical || 0}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Critical Risk</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'features' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🛡️ Feature Importance
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>
            Most important features used by the ML model for flaky test prediction
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {featureImportance.slice(0, 10).map((feature) => (
              <div key={feature.feature} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{feature.feature.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>{feature.description}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '128px', backgroundColor: '#e5e7eb', borderRadius: '4px', height: '8px' }}>
                    <div 
                      style={{ 
                        backgroundColor: '#8b5cf6', 
                        height: '8px', 
                        borderRadius: '4px',
                        width: `${(feature.importance * 100)}%`
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', width: '48px', textAlign: 'right' }}>
                    {Math.round(feature.importance * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};