import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface RetryConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  flakyThreshold: number;
}

interface RetryStats {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  retrySuccessRate: number;
  mostRetriedTests: Array<{
    testName: string;
    testSuite?: string;
    retryCount: number;
  }>;
}

interface RetryConfigurationProps {
  projectId: string;
  onConfigUpdate?: (updatedProject: any) => void;
}

const RetryConfiguration: React.FC<RetryConfigurationProps> = ({ projectId, onConfigUpdate }) => {
  const [config, setConfig] = useState<RetryConfig>({
    enabled: true,
    maxRetries: 3,
    retryDelay: 30,
    flakyThreshold: 0.3,
  });
  const [stats, setStats] = useState<RetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tempConfig, setTempConfig] = useState(config);
  
  const { token } = useAuth();

  const fetchConfigAndStats = async () => {
    try {
      setLoading(true);
      const [configResponse, statsResponse] = await Promise.all([
        fetch(`/api/retry-logic/${projectId}/config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/retry-logic/${projectId}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const configData = await configResponse.json();
      const statsData = await statsResponse.json();

      if (!configResponse.ok) {
        throw new Error(configData.error || 'Failed to fetch retry configuration');
      }

      setConfig(configData.config);
      setTempConfig(configData.config);
      
      if (statsResponse.ok) {
        setStats(statsData.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError('');
      
      const response = await fetch(`/api/retry-logic/${projectId}/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: tempConfig.enabled,
          maxRetries: tempConfig.maxRetries,
          retryDelay: tempConfig.retryDelay,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      setConfig(tempConfig);
      setSuccessMessage('Configuration saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Fetch updated project data and notify parent
      if (onConfigUpdate) {
        try {
          const projectResponse = await fetch(`/api/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            onConfigUpdate(projectData.project);
          }
        } catch (err) {
          console.error('Failed to fetch updated project data:', err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    setTempConfig(config);
    setError('');
  };

  useEffect(() => {
    fetchConfigAndStats();
  }, [projectId, token]);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(tempConfig);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Retry Logic Configuration</h3>
        <button
          onClick={fetchConfigAndStats}
          className="text-indigo-600 hover:text-indigo-800 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-4">Retry Settings</h4>
        
        <div className="space-y-6">
          {/* Enable/Disable Retries */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Enable Automatic Retries</label>
              <p className="text-sm text-gray-500">Automatically retry failed tests identified as flaky</p>
            </div>
            <button
              type="button"
              onClick={() => setTempConfig({ ...tempConfig, enabled: !tempConfig.enabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                tempConfig.enabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  tempConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {tempConfig.enabled && (
            <>
              {/* Max Retries */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Retries per Test
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={tempConfig.maxRetries}
                    onChange={(e) => setTempConfig({ ...tempConfig, maxRetries: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-12 text-center py-1 px-2 border border-gray-300 rounded text-sm">
                    {tempConfig.maxRetries}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  How many times to retry a failed test before giving up
                </p>
              </div>

              {/* Retry Delay */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Retry Delay (seconds)
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="15"
                    value={tempConfig.retryDelay}
                    onChange={(e) => setTempConfig({ ...tempConfig, retryDelay: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-16 text-center py-1 px-2 border border-gray-300 rounded text-sm">
                    {tempConfig.retryDelay}s
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Base delay between retry attempts (actual delay may vary by strategy)
                </p>
              </div>

              {/* Flaky Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flaky Test Threshold
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={tempConfig.flakyThreshold}
                    onChange={(e) => setTempConfig({ ...tempConfig, flakyThreshold: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-16 text-center py-1 px-2 border border-gray-300 rounded text-sm">
                    {(tempConfig.flakyThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Minimum failure rate to consider a test flaky
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={resetConfig}
            disabled={!hasChanges}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            onClick={saveConfig}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Retry Statistics */}
      {stats && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 mb-4">Retry Statistics (Last 30 Days)</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalRetries}</div>
              <div className="text-sm text-gray-500">Total Retries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.successfulRetries}</div>
              <div className="text-sm text-gray-500">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failedRetries}</div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{(stats.retrySuccessRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
          </div>

          {/* Most Retried Tests */}
          {stats.mostRetriedTests.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Most Retried Tests</h5>
              <div className="space-y-2">
                {stats.mostRetriedTests.slice(0, 5).map((test, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium text-gray-900">{test.testName}</span>
                      {test.testSuite && (
                        <span className="text-sm text-gray-500 ml-2">in {test.testSuite}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-600">{test.retryCount} retries</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Configuration Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Current Configuration</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Status: <span className={tempConfig.enabled ? 'text-green-600' : 'text-red-600'}>
            {tempConfig.enabled ? 'Enabled' : 'Disabled'}
          </span></div>
          {tempConfig.enabled && (
            <>
              <div>Max retries: {tempConfig.maxRetries}</div>
              <div>Retry delay: {tempConfig.retryDelay} seconds</div>
              <div>Flaky threshold: {(tempConfig.flakyThreshold * 100).toFixed(0)}%</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RetryConfiguration;