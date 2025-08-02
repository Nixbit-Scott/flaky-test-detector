import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

interface CreateProjectFormProps {
  onSuccess: (project: any) => void;
  onCancel: () => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    repository: '',
    branch: 'main',
    retryEnabled: true,
    maxRetries: 3,
    retryDelay: 30,
    flakyThreshold: 0.3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { token } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: checkbox.checked,
      });
    } else if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseFloat(value) || 0,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Creating project with data:', formData);
      console.log('API URL:', `${API_BASE_URL}/projects`);
      console.log('Token present:', !!token);
      
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to create project`);
      }

      console.log('Project created successfully:', data.project);
      onSuccess(data.project);
    } catch (err) {
      console.error('Project creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Project Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Project Details</h3>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Project Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="My Test Project"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="repository" className="block text-sm font-medium text-gray-700">
                Repository URL *
              </label>
              <input
                type="text"
                id="repository"
                name="repository"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="https://github.com/username/repo"
                value={formData.repository}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="branch" className="block text-sm font-medium text-gray-700">
                Default Branch
              </label>
              <input
                type="text"
                id="branch"
                name="branch"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="main"
                value={formData.branch}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Flaky Test Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Flaky Test Settings</h3>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="retryEnabled"
                name="retryEnabled"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={formData.retryEnabled}
                onChange={handleChange}
              />
              <label htmlFor="retryEnabled" className="ml-2 block text-sm text-gray-900">
                Enable automatic retries for flaky tests
              </label>
            </div>

            <div>
              <label htmlFor="maxRetries" className="block text-sm font-medium text-gray-700">
                Max Retries
              </label>
              <input
                type="number"
                id="maxRetries"
                name="maxRetries"
                min="1"
                max="10"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={formData.maxRetries}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="retryDelay" className="block text-sm font-medium text-gray-700">
                Retry Delay (seconds)
              </label>
              <input
                type="number"
                id="retryDelay"
                name="retryDelay"
                min="1"
                max="300"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={formData.retryDelay}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="flakyThreshold" className="block text-sm font-medium text-gray-700">
                Flaky Threshold (0.0 - 1.0)
              </label>
              <input
                type="number"
                id="flakyThreshold"
                name="flakyThreshold"
                min="0"
                max="1"
                step="0.1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={formData.flakyThreshold}
                onChange={handleChange}
              />
              <p className="mt-1 text-sm text-gray-500">
                Tests with failure rate above this threshold are considered flaky
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectForm;