import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import ProjectList from './ProjectList';
import CreateProjectForm from './CreateProjectForm';
import ProjectDashboard from './ProjectDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import OrganizationManagement from './OrganizationManagement';
import CreateOrganizationModal from './CreateOrganizationModal';
import ApiDocumentation from './ApiDocumentation';
import Logo from './Logo';

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

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { currentOrganization, organizations } = useOrganization();
  const [currentView, setCurrentView] = useState<'projects' | 'create' | 'project' | 'executive' | 'organization' | 'api-docs'>('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  const handleCreateProject = () => {
    setCurrentView('create');
  };

  const handleProjectCreated = (_project: Project) => {
    setCurrentView('projects');
    setRefreshTrigger(prev => prev + 1);
    // Could also show a success message here
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setCurrentView('project');
  };

  const handleBackToProjects = () => {
    setCurrentView('projects');
    setSelectedProject(null);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'create':
        return (
          <CreateProjectForm
            onSuccess={handleProjectCreated}
            onCancel={handleBackToProjects}
          />
        );
      case 'project':
        return selectedProject ? (
          <ProjectDashboard
            project={selectedProject}
            onBack={handleBackToProjects}
          />
        ) : null;
      case 'executive':
        return <ExecutiveDashboard />;
      case 'organization':
        return currentOrganization ? (
          <OrganizationManagement />
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Organization</h3>
            <p className="text-gray-500 mb-4">You need to create or join an organization to access team features.</p>
            <button
              onClick={() => setShowCreateOrgModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Create Organization
            </button>
          </div>
        );
      case 'api-docs':
        return <ApiDocumentation projectId={selectedProject?.id} />;
      default:
        return (
          <ProjectList
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            refreshTrigger={refreshTrigger}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-8">
              <Logo size="lg" showPulse={true} />
              <span className="text-xs text-red-500">API-DOCS-BUILD-v2</span>
              <nav className="flex space-x-4">
                <button
                  onClick={() => setCurrentView('projects')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'projects' || currentView === 'create' || currentView === 'project'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Projects
                </button>
                <button
                  onClick={() => {
                    console.log('API Docs clicked!');
                    setCurrentView('api-docs');
                  }}
                  className={`px-3 py-2 rounded-md text-sm font-medium border-2 border-blue-500 ${
                    currentView === 'api-docs'
                      ? 'bg-blue-100 text-blue-700 border-blue-600'
                      : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  📚 API Documentation
                </button>
                <button
                  onClick={() => setCurrentView('organization')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'organization'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🏢 Organization
                </button>
                <button
                  onClick={() => setCurrentView('executive')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'executive'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📊 Executive Dashboard
                </button>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {currentOrganization && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Organization:</span> {currentOrganization.name}
                </div>
              )}
              <span className="text-gray-700">
                Welcome, {user?.name || user?.email}
              </span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {renderCurrentView()}
        </div>
      </main>
      
      {showCreateOrgModal && (
        <CreateOrganizationModal
          onClose={() => setShowCreateOrgModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;