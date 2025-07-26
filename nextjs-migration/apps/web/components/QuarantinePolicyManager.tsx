import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface QuarantinePolicy {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isActive: boolean;
  failureRateThreshold: number;
  confidenceThreshold: number;
  consecutiveFailures: number;
  minRunsRequired: number;
  stabilityPeriod: number;
  successRateRequired: number;
  minSuccessfulRuns: number;
  highImpactSuites: string[];
  priorityTests: string[];
  createdAt: string;
  updatedAt: string;
}

interface QuarantinePolicyConfig {
  failureRateThreshold: number;
  confidenceThreshold: number;
  consecutiveFailures: number;
  minRunsRequired: number;
  stabilityPeriod: number;
  successRateRequired: number;
  minSuccessfulRuns: number;
  highImpactSuites: string[];
  priorityTests: string[];
  enableRapidDegradation: boolean;
  enableCriticalPathProtection: boolean;
  enableTimeBasedRules: boolean;
  maxQuarantinePeriod?: number;
  maxQuarantinePercentage?: number;
}

interface PolicySimulation {
  wouldQuarantine: number;
  wouldUnquarantine: number;
  estimatedSavings: {
    ciMinutes: number;
    developerHours: number;
    buildsProtected: number;
  };
  potentialRisks: {
    falsePositives: number;
    overQuarantine: boolean;
    criticalTestsAffected: number;
  };
}

interface QuarantinePolicyManagerProps {
  projectId: string;
}

const QuarantinePolicyManager: React.FC<QuarantinePolicyManagerProps> = ({ projectId }) => {
  const [policies, setPolicies] = useState<QuarantinePolicy[]>([]);
  const [recommendedPolicy, setRecommendedPolicy] = useState<QuarantinePolicyConfig | null>(null);
  const [simulation, setSimulation] = useState<PolicySimulation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<QuarantinePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    config: QuarantinePolicyConfig;
  }>({
    name: '',
    description: '',
    config: {
      failureRateThreshold: 0.5,
      confidenceThreshold: 0.7,
      consecutiveFailures: 3,
      minRunsRequired: 5,
      stabilityPeriod: 7,
      successRateRequired: 0.95,
      minSuccessfulRuns: 10,
      highImpactSuites: [],
      priorityTests: [],
      enableRapidDegradation: true,
      enableCriticalPathProtection: true,
      enableTimeBasedRules: false,
      maxQuarantinePeriod: 30,
      maxQuarantinePercentage: 25,
    },
  });

  const { token } = useAuth();

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [policiesResponse, recommendedResponse] = await Promise.all([
        fetch(`/api/quarantine/policies/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/quarantine/policies/recommended/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (policiesResponse.ok) {
        const policiesData = await policiesResponse.json();
        setPolicies(policiesData.data || []);
      }

      if (recommendedResponse.ok) {
        const recommendedData = await recommendedResponse.json();
        setRecommendedPolicy(recommendedData.data);
      }
      
    } catch (err) {
      console.error('Error fetching policies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const simulatePolicy = async (config: QuarantinePolicyConfig) => {
    try {
      const response = await fetch('/api/quarantine/policies/simulate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, config }),
      });

      if (response.ok) {
        const data = await response.json();
        setSimulation(data.data);
      }
    } catch (err) {
      console.error('Error simulating policy:', err);
    }
  };

  const handleCreatePolicy = async () => {
    try {
      const response = await fetch('/api/quarantine/policies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          name: formData.name,
          description: formData.description,
          config: formData.config,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create policy');
      }

      setIsCreating(false);
      resetForm();
      await fetchPolicies();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    }
  };

  const handleTogglePolicyStatus = async (policyId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/quarantine/policies/${policyId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update policy status');
      }

      await fetchPolicies();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy');
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;

    try {
      const response = await fetch(`/api/quarantine/policies/${policyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete policy');
      }

      await fetchPolicies();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  };

  const useRecommendedPolicy = () => {
    if (recommendedPolicy) {
      setFormData({
        name: 'AI Recommended Policy',
        description: 'Policy automatically recommended based on project analysis',
        config: recommendedPolicy,
      });
      setIsCreating(true);
      simulatePolicy(recommendedPolicy);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      config: {
        failureRateThreshold: 0.5,
        confidenceThreshold: 0.7,
        consecutiveFailures: 3,
        minRunsRequired: 5,
        stabilityPeriod: 7,
        successRateRequired: 0.95,
        minSuccessfulRuns: 10,
        highImpactSuites: [],
        priorityTests: [],
        enableRapidDegradation: true,
        enableCriticalPathProtection: true,
        enableTimeBasedRules: false,
        maxQuarantinePeriod: 30,
        maxQuarantinePercentage: 25,
      },
    });
    setSimulation(null);
  };

  useEffect(() => {
    fetchPolicies();
  }, [projectId, token]);

  useEffect(() => {
    if (isCreating && formData.config) {
      simulatePolicy(formData.config);
    }
  }, [formData.config, isCreating]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isCreating || editingPolicy) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {editingPolicy ? 'Edit Policy' : 'Create Quarantine Policy'}
            </h3>
            <p className="text-sm text-gray-500">
              Configure intelligent quarantine rules for your project
            </p>
          </div>
          <button
            onClick={() => {
              setIsCreating(false);
              setEditingPolicy(null);
              resetForm();
            }}
            className="text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Policy Configuration Form */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Policy Configuration</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Aggressive Quarantine"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                  placeholder="Describe when this policy should be used..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Failure Rate Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formData.config.failureRateThreshold}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, failureRateThreshold: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">0.0 to 1.0 (e.g., 0.5 = 50%)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formData.config.confidenceThreshold}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, confidenceThreshold: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum confidence to quarantine</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consecutive Failures
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.config.consecutiveFailures}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, consecutiveFailures: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Runs Required
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.config.minRunsRequired}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, minRunsRequired: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stability Period (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.config.stabilityPeriod}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, stabilityPeriod: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">Days stable before unquarantine</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Success Rate Required
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formData.config.successRateRequired}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, successRateRequired: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">Success rate to unquarantine</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  High Impact Test Suites
                </label>
                <input
                  type="text"
                  value={formData.config.highImpactSuites.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: {
                      ...formData.config,
                      highImpactSuites: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., e2e, integration, smoke"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list of suite names</p>
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleCreatePolicy}
                disabled={!formData.name.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {editingPolicy ? 'Update Policy' : 'Create Policy'}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingPolicy(null);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Policy Simulation */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Policy Impact Simulation</h4>
            
            {simulation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{simulation.wouldQuarantine}</div>
                    <div className="text-sm text-gray-600">Would Quarantine</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{simulation.wouldUnquarantine}</div>
                    <div className="text-sm text-gray-600">Would Unquarantine</div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Estimated Savings</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>CI Time:</span>
                      <span className="font-medium">{simulation.estimatedSavings.ciMinutes} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Developer Hours:</span>
                      <span className="font-medium">{simulation.estimatedSavings.developerHours.toFixed(1)} hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Builds Protected:</span>
                      <span className="font-medium">{simulation.estimatedSavings.buildsProtected}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Potential Risks</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>False Positives:</span>
                      <span className={`font-medium ${simulation.potentialRisks.falsePositives > 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {simulation.potentialRisks.falsePositives}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Over Quarantine:</span>
                      <span className={`font-medium ${simulation.potentialRisks.overQuarantine ? 'text-red-600' : 'text-green-600'}`}>
                        {simulation.potentialRisks.overQuarantine ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Critical Tests Affected:</span>
                      <span className={`font-medium ${simulation.potentialRisks.criticalTestsAffected > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {simulation.potentialRisks.criticalTestsAffected}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-500">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                  <p>Simulating policy impact...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Quarantine Policies</h3>
          <p className="text-sm text-gray-500">
            Manage intelligent quarantine rules and automation settings
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchPolicies}
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            Refresh
          </button>
          {recommendedPolicy && (
            <button
              onClick={useRecommendedPolicy}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Use AI Recommendation
            </button>
          )}
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Create Policy
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* Policies list */}
      {policies.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Policies Configured</h3>
          <p className="text-gray-500 mb-6">Create your first quarantine policy to enable intelligent test management.</p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create First Policy
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Configured Policies</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {policies.map((policy) => (
              <div key={policy.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">{policy.name}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        policy.isActive ? 'text-green-800 bg-green-100' : 'text-gray-800 bg-gray-100'
                      }`}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {policy.description && (
                      <p className="text-sm text-gray-600 mt-1">{policy.description}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Failure rate: ≥{(policy.failureRateThreshold * 100).toFixed(0)}%</span>
                      <span>Confidence: ≥{(policy.confidenceThreshold * 100).toFixed(0)}%</span>
                      <span>Consecutive: {policy.consecutiveFailures}</span>
                      <span>Stability: {policy.stabilityPeriod} days</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTogglePolicyStatus(policy.id, !policy.isActive)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        policy.isActive
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {policy.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeletePolicy(policy.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium"
                    >
                      Delete
                    </button>
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

export default QuarantinePolicyManager;