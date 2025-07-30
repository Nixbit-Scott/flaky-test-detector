import React, { useState } from 'react';
import QuarantineDashboard from './QuarantineDashboard';
import QuarantinePolicyManager from './QuarantinePolicyManager';
import QuarantineAnalytics from './QuarantineAnalytics';

interface QuarantineManagementProps {
  projectId: string;
}

const QuarantineManagement: React.FC<QuarantineManagementProps> = ({ projectId }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'policies' | 'analytics'>('dashboard');

  const renderContent = () => {
    switch (activeView) {
      case 'policies':
        return <QuarantinePolicyManager projectId={projectId} />;
      case 'analytics':
        return <QuarantineAnalytics projectId={projectId} />;
      default:
        return <QuarantineDashboard projectId={projectId} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with sub-navigation */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Quarantine Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Intelligent test quarantine system for managing flaky tests
          </p>
        </div>
        
        <div className="px-6 py-3">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              🔒 Dashboard
            </button>
            <button
              onClick={() => setActiveView('policies')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeView === 'policies'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              📋 Policies
            </button>
            <button
              onClick={() => setActiveView('analytics')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeView === 'analytics'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              📊 Analytics
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default QuarantineManagement;