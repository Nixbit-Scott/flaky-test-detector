import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Integration {
  id: string;
  name: string;
  type: 'slack' | 'teams';
  enabled: boolean;
  alertTypes: string[];
  config: {
    webhookUrl: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
  };
  createdAt: string;
  lastUsed?: string;
}

interface AlertType {
  id: string;
  name: string;
  description: string;
  severity: string;
  recommended: boolean;
}

interface IntegrationManagementProps {
  projectId: string;
}

const IntegrationManagement: React.FC<IntegrationManagementProps> = ({ projectId }) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [alertTypes, setAlertTypes] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchIntegrations();
    fetchAlertTypes();
  }, [projectId]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch(`/api/integrations/project/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.data.integrations);
      } else {
        setError('Failed to fetch integrations');
      }
    } catch (err) {
      setError('Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertTypes = async () => {
    try {
      const response = await fetch('/api/integrations/alert-types', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlertTypes(data.data.alertTypes);
      }
    } catch (err) {
      console.error('Failed to fetch alert types:', err);
    }
  };

  const deleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;

    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setIntegrations(integrations.filter(i => i.id !== integrationId));
      } else {
        setError('Failed to delete integration');
      }
    } catch (err) {
      setError('Failed to delete integration');
    }
  };

  const toggleIntegration = async (integration: Integration) => {
    try {
      const response = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !integration.enabled })
      });

      if (response.ok) {
        setIntegrations(integrations.map(i => 
          i.id === integration.id ? { ...i, enabled: !i.enabled } : i
        ));
      } else {
        setError('Failed to update integration');
      }
    } catch (err) {
      setError('Failed to update integration');
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'slack':
        return '💬';
      case 'teams':
        return '📞';
      default:
        return '🔗';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatLastUsed = (lastUsed?: string) => {
    if (!lastUsed) return 'Never';
    return new Date(lastUsed).toLocaleDateString();
  };

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
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Integration Management</h3>
          <p className="text-sm text-gray-500">
            Connect your project to Slack and Microsoft Teams for real-time alerts
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          + Add Integration
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Integrations List */}
      {integrations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations configured</h3>
          <p className="text-gray-500 mb-4">
            Connect your project to Slack or Microsoft Teams to receive real-time alerts about flaky tests.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Add Your First Integration
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`bg-white border rounded-lg p-6 ${
                integration.enabled ? 'border-green-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getIntegrationIcon(integration.type)}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">{integration.name}</h4>
                    <p className="text-sm text-gray-500 capitalize">
                      {integration.type} Integration
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      integration.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {integration.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => toggleIntegration(integration)}
                    className={`px-3 py-1 text-sm rounded-md ${
                      integration.enabled
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {integration.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>

              {/* Alert Types */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Alert Types:</h5>
                <div className="flex flex-wrap gap-2">
                  {integration.alertTypes.map((alertType) => {
                    const alert = alertTypes.find(a => a.id === alertType);
                    return (
                      <span
                        key={alertType}
                        className={`px-2 py-1 text-xs rounded-full bg-gray-100 ${
                          alert ? getSeverityColor(alert.severity) : 'text-gray-600'
                        }`}
                      >
                        {alert?.name || alertType}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Last used: {formatLastUsed(integration.lastUsed)}</span>
                <span>Created: {new Date(integration.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => setEditingIntegration(integration)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteIntegration(integration.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Integration Modal */}
      {(showCreateForm || editingIntegration) && (
        <IntegrationForm
          projectId={projectId}
          integration={editingIntegration}
          alertTypes={alertTypes}
          onClose={() => {
            setShowCreateForm(false);
            setEditingIntegration(null);
          }}
          onSave={() => {
            setShowCreateForm(false);
            setEditingIntegration(null);
            fetchIntegrations();
          }}
        />
      )}
    </div>
  );
};

// Integration Form Component
interface IntegrationFormProps {
  projectId: string;
  integration?: Integration | null;
  alertTypes: AlertType[];
  onClose: () => void;
  onSave: () => void;
}

const IntegrationForm: React.FC<IntegrationFormProps> = ({
  projectId,
  integration,
  alertTypes,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: integration?.name || '',
    type: integration?.type || 'slack' as 'slack' | 'teams',
    webhookUrl: integration?.config.webhookUrl || '',
    channel: integration?.config.channel || '',
    username: integration?.config.username || '',
    iconEmoji: integration?.config.iconEmoji || '',
    alertTypes: integration?.alertTypes || [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState('');
  const { token } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const config = {
        webhookUrl: formData.webhookUrl,
        enabled: true,
        ...(formData.type === 'slack' && {
          channel: formData.channel,
          username: formData.username,
          iconEmoji: formData.iconEmoji,
        }),
      };

      const method = integration ? 'PUT' : 'POST';
      const url = integration 
        ? `/api/integrations/${integration.id}`
        : `/api/integrations/project/${projectId}`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          config,
          alertTypes: formData.alertTypes,
        }),
      });

      if (response.ok) {
        onSave();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save integration');
      }
    } catch (err) {
      setError('Failed to save integration');
    } finally {
      setLoading(false);
    }
  };

  const testIntegration = async () => {
    setLoading(true);
    setTestResult('');

    try {
      const config = {
        webhookUrl: formData.webhookUrl,
        enabled: true,
        ...(formData.type === 'slack' && {
          channel: formData.channel,
          username: formData.username,
          iconEmoji: formData.iconEmoji,
        }),
      };

      const response = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: formData.type,
          config,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setTestResult(data.data.message);
      } else {
        setError(data.error || 'Test failed');
      }
    } catch (err) {
      setError('Test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {integration ? 'Edit Integration' : 'Add Integration'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {testResult && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {testResult}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Integration Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Development Team Slack"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Integration Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'slack' | 'teams' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="slack">Slack</option>
              <option value="teams">Microsoft Teams</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook URL
            </label>
            <input
              type="url"
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="https://hooks.slack.com/services/..."
              required
            />
          </div>

          {formData.type === 'slack' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel (optional)
                </label>
                <input
                  type="text"
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="#general"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Flaky Test Bot"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icon Emoji (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.iconEmoji}
                    onChange={(e) => setFormData({ ...formData, iconEmoji: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder=":warning:"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alert Types
            </label>
            <div className="space-y-2">
              {alertTypes.map((alertType) => (
                <label key={alertType.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.alertTypes.includes(alertType.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          alertTypes: [...formData.alertTypes, alertType.id],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          alertTypes: formData.alertTypes.filter(id => id !== alertType.id),
                        });
                      }
                    }}
                    className="mr-2"
                  />
                  <div>
                    <span className="text-sm font-medium">{alertType.name}</span>
                    {alertType.recommended && (
                      <span className="ml-2 text-xs text-green-600">(recommended)</span>
                    )}
                    <p className="text-xs text-gray-500">{alertType.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={testIntegration}
              disabled={loading || !formData.webhookUrl}
              className="px-4 py-2 text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50 disabled:opacity-50"
            >
              Test Integration
            </button>
            <div className="space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || formData.alertTypes.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : integration ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IntegrationManagement;