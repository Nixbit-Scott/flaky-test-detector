import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface GitLabProject {
  id: number;
  name: string;
  nameWithNamespace: string;
  pathWithNamespace: string;
  webUrl: string;
  httpUrlToRepo: string;
  defaultBranch: string;
  visibility: 'private' | 'internal' | 'public';
  namespace: {
    id: number;
    name: string;
    path: string;
    kind: string;
  };
}

interface GitLabSetupProps {
  projectId?: string;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  mode?: 'connect' | 'setup-webhook' | 'create-project';
}

const GitLabSetup: React.FC<GitLabSetupProps> = ({ 
  projectId, 
  onSuccess, 
  onCancel,
  mode = 'connect'
}) => {
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<GitLabProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [configValid, setConfigValid] = useState<boolean | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [enableSslVerification, setEnableSslVerification] = useState(true);
  
  const { token } = useAuth();

  // Initialize webhook URL
  useEffect(() => {
    const baseUrl = window.location.origin;
    setWebhookUrl(`${baseUrl}/.netlify/functions/webhook-gitlab`);
  }, []);

  // Validate GitLab configuration on component mount
  useEffect(() => {
    validateGitLabConfig();
  }, []);

  const validateGitLabConfig = async () => {
    try {
      const response = await fetch('/api/gitlab/config/validate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setConfigValid(data.valid);
      
      if (!data.valid) {
        setError(`GitLab configuration error: ${data.errors.join(', ')}`);
      } else {
        // Load projects if configuration is valid
        loadGitLabProjects();
      }
    } catch (err) {
      setConfigValid(false);
      setError('Failed to validate GitLab configuration');
    }
  };

  const loadGitLabProjects = async (search?: string) => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        membership: 'true',
        perPage: '20',
      });
      
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/gitlab/projects?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load GitLab projects');
      }

      setGitlabProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setGitlabProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadGitLabProjects(searchTerm);
  };

  const connectProject = async () => {
    if (!selectedProject || !projectId) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/gitlab/projects/${projectId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gitlabProjectId: selectedProject.id,
          gitlabProjectPath: selectedProject.pathWithNamespace,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect project');
      }

      onSuccess?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect project');
    } finally {
      setLoading(false);
    }
  };

  const setupWebhook = async () => {
    if (!selectedProject) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/gitlab/projects/${selectedProject.id}/setup-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          webhookUrl,
          enableSslVerification,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup webhook');
      }

      onSuccess?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'connect') {
      await connectProject();
    } else if (mode === 'setup-webhook') {
      await setupWebhook();
    }
  };

  if (configValid === false) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263c-.135-.423-.73-.423-.867 0L1.388 9.452.046 13.587c-.121.375.014.789.331 1.023L12 23.054l11.623-8.443c.318-.235.452-.648.332-1.024"/>
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">GitLab Configuration Required</h3>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <svg className="w-5 h-5 text-orange-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm text-orange-800 font-medium">Configuration Error</p>
              <p className="text-sm text-orange-700 mt-1">{error}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-sm text-gray-600">
          <p>To use GitLab integration, you need to configure the following environment variables:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><code className="bg-gray-100 px-1 rounded">GITLAB_ACCESS_TOKEN</code> - GitLab personal access token</li>
            <li><code className="bg-gray-100 px-1 rounded">GITLAB_BASE_URL</code> - GitLab API base URL (optional, defaults to gitlab.com)</li>
          </ul>
          <p>Please contact your administrator to configure GitLab integration.</p>
        </div>

        {onCancel && (
          <div className="flex justify-end mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263c-.135-.423-.73-.423-.867 0L1.388 9.452.046 13.587c-.121.375.014.789.331 1.023L12 23.054l11.623-8.443c.318-.235.452-.648.332-1.024"/>
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'connect' ? 'Connect GitLab Project' : 
             mode === 'setup-webhook' ? 'Setup GitLab Webhook' : 
             'GitLab Integration'}
          </h3>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search GitLab Projects
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Project Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select GitLab Project
          </label>
          <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-md">
            {gitlabProjects.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {loading ? 'Loading projects...' : 'No projects found. Try searching for a specific project.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {gitlabProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedProject?.id === project.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                    }`}
                    onClick={() => setSelectedProject(project)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{project.nameWithNamespace}</h4>
                        <p className="text-xs text-gray-500">{project.pathWithNamespace}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            project.visibility === 'private' ? 'bg-red-100 text-red-800' :
                            project.visibility === 'internal' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {project.visibility}
                          </span>
                          <span className="text-xs text-gray-400">Default: {project.defaultBranch}</span>
                        </div>
                      </div>
                      <a
                        href={project.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Webhook Configuration (if in webhook setup mode) */}
        {mode === 'setup-webhook' && selectedProject && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900">Webhook Configuration</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This URL will receive pipeline and job events from GitLab
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enableSslVerification"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={enableSslVerification}
                onChange={(e) => setEnableSslVerification(e.target.checked)}
              />
              <label htmlFor="enableSslVerification" className="ml-2 block text-sm text-gray-900">
                Enable SSL verification (recommended)
              </label>
            </div>
          </div>
        )}

        {/* Selected Project Info */}
        {selectedProject && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Project</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Name:</strong> {selectedProject.nameWithNamespace}</p>
              <p><strong>Path:</strong> {selectedProject.pathWithNamespace}</p>
              <p><strong>Repository:</strong> {selectedProject.httpUrlToRepo}</p>
              <p><strong>Default Branch:</strong> {selectedProject.defaultBranch}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!selectedProject || loading}
            className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 
             mode === 'connect' ? 'Connect Project' :
             mode === 'setup-webhook' ? 'Setup Webhook' :
             'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GitLabSetup;