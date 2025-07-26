import React, { useState } from 'react';
import WebhookConfig from './WebhookConfig';
import TestResults from './TestResults';
import FlakyTestDashboard from './FlakyTestDashboard';
import EnhancedFlakyTestDashboard from './EnhancedFlakyTestDashboard';
import RetryConfiguration from './RetryConfiguration';
import QuarantineManagement from './QuarantineManagement';
import IntegrationManagement from './IntegrationManagement';
import ApiDocumentation from './ApiDocumentation';

interface Project {
  id: string;
  name: string;
  repository: string;
  branch: string;
  createdAt: string;
  retryEnabled: boolean;
  maxRetries: number;
  flakyThreshold: number;
  _count: {
    testRuns: number;
    flakyTests: number;
  };
}

interface ProjectDashboardProps {
  project: Project;
  onBack: () => void;
  onProjectUpdate?: (updatedProject: Project) => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, onBack, onProjectUpdate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'flaky-tests' | 'ai-flaky-tests' | 'quarantine' | 'retry-config' | 'integrations' | 'webhooks' | 'api-docs' | 'settings'>('overview');
  const [currentProject, setCurrentProject] = useState<Project>(project);

  const handleProjectUpdate = (updatedProject: Project) => {
    setCurrentProject(updatedProject);
    if (onProjectUpdate) {
      onProjectUpdate(updatedProject);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'results':
        return <TestResults projectId={project.id} />;
      case 'flaky-tests':
        return <FlakyTestDashboard projectId={project.id} />;
      case 'ai-flaky-tests':
        return <EnhancedFlakyTestDashboard projectId={project.id} />;
      case 'quarantine':
        return <QuarantineManagement projectId={project.id} />;
      case 'retry-config':
        return <RetryConfiguration projectId={project.id} onConfigUpdate={handleProjectUpdate} />;
      case 'integrations':
        return <IntegrationManagement projectId={project.id} />;
      case 'webhooks':
        return <WebhookConfig projectId={project.id} />;
      case 'api-docs':
        return <ApiDocumentation projectId={project.id} />;
      case 'settings':
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Settings</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                  <input
                    type="text"
                    value={currentProject.name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Repository</label>
                  <input
                    type="text"
                    value={currentProject.repository}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Branch</label>
                  <input
                    type="text"
                    value={currentProject.branch}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flaky Threshold</label>
                  <input
                    type="text"
                    value={`${(currentProject.flakyThreshold * 100).toFixed(0)}%`}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Project settings editing will be available in a future update.
                </p>
              </div>
            </div>
          </div>
        );
      default: // overview
        return (
          <div className="space-y-6">
            {/* Project Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Test Runs</p>
                    <p className="text-2xl font-semibold text-gray-900">{currentProject._count.testRuns}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Flaky Tests</p>
                    <p className="text-2xl font-semibold text-gray-900">{currentProject._count.flakyTests}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Auto Retry</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {currentProject.retryEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Threshold</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {(currentProject.flakyThreshold * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Features Highlight */}
            {currentProject._count.flakyTests > 0 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">🧠 AI-Powered Root Cause Analysis</h3>
                      <p className="text-indigo-100 mb-4">
                        Get intelligent insights and recommendations to fix your flaky tests faster. 
                        Our AI analyzes error patterns, timing issues, and environmental factors.
                      </p>
                      <div className="flex space-x-4 text-sm text-indigo-100">
                        <span>• Categorize failures automatically</span>
                        <span>• Get actionable recommendations</span>
                        <span>• Estimate fix effort</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <button
                        onClick={() => setActiveTab('ai-flaky-tests')}
                        className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                      >
                        Try AI Analysis →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">🔒 Intelligent Test Quarantine</h3>
                      <p className="text-orange-100 mb-4">
                        Automatically isolate flaky tests from your CI/CD pipeline while maintaining build stability.
                        Smart quarantine rules with auto-unquarantine based on stability improvements.
                      </p>
                      <div className="flex space-x-4 text-sm text-orange-100">
                        <span>• Auto-quarantine flaky tests</span>
                        <span>• Smart unquarantine rules</span>
                        <span>• Impact tracking & analytics</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <button
                        onClick={() => setActiveTab('quarantine')}
                        className="bg-white text-orange-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                      >
                        Manage Quarantine →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Setup */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">1. Set up CI/CD Integration</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Configure webhooks to receive test results from your CI/CD pipeline.
                  </p>
                  <button
                    onClick={() => setActiveTab('webhooks')}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    Configure Webhooks →
                  </button>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">2. View Test Results</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Monitor your test runs and identify flaky tests automatically.
                  </p>
                  <button
                    onClick={() => setActiveTab('results')}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    View Results →
                  </button>
                </div>

                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <h4 className="font-medium text-gray-900 mb-2">3. Slack/Teams Alerts</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Get real-time alerts in Slack or Microsoft Teams when flaky tests are detected.
                  </p>
                  <button
                    onClick={() => setActiveTab('integrations')}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                  >
                    Setup Integrations →
                  </button>
                </div>

                <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
                  <h4 className="font-medium text-gray-900 mb-2">4. AI Analysis</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Get AI-powered insights and recommendations for your flaky tests.
                  </p>
                  <button
                    onClick={() => setActiveTab('ai-flaky-tests')}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    Try AI Analysis →
                  </button>
                </div>

                <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <h4 className="font-medium text-gray-900 mb-2">5. Quarantine Management</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Configure intelligent quarantine rules to isolate flaky tests automatically.
                  </p>
                  <button
                    onClick={() => setActiveTab('quarantine')}
                    className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                  >
                    Setup Quarantine →
                  </button>
                </div>
              </div>
            </div>

            {/* Project Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Repository:</span>
                  <p className="text-gray-600 break-all">{currentProject.repository}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Default Branch:</span>
                  <p className="text-gray-600">{currentProject.branch}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <p className="text-gray-600">{new Date(currentProject.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Max Retries:</span>
                  <p className="text-gray-600">{currentProject.maxRetries}</p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Projects
          </button>
          <h2 className="text-2xl font-bold text-gray-900">{currentProject.name}</h2>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="-mb-px flex space-x-2 px-6 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview', icon: '📊' },
            { key: 'results', label: 'Test Results', icon: '📋' },
            { key: 'flaky-tests', label: 'Flaky Tests', icon: '⚠️' },
            { key: 'ai-flaky-tests', label: 'AI Analysis', icon: '🧠' },
            { key: 'quarantine', label: 'Quarantine', icon: '🔒' },
            { key: 'retry-config', label: 'Retry Logic', icon: '🔄' },
            { key: 'integrations', label: 'Integrations', icon: '📱' },
            { key: 'webhooks', label: 'CI/CD Setup', icon: '🔗' },
            { key: 'api-docs', label: 'API Docs', icon: '📚' },
            { key: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

export default ProjectDashboard;