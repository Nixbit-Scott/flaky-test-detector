import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const SimpleDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Nixbit
            </h1>
            <div className="flex items-center space-x-4">
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
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Project Dashboard
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900">Total Projects</h4>
                  <p className="text-2xl font-bold text-blue-600">0</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-yellow-900">Flaky Tests</h4>
                  <p className="text-2xl font-bold text-yellow-600">0</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-green-900">Success Rate</h4>
                  <p className="text-2xl font-bold text-green-600">100%</p>
                </div>
              </div>
              
              <div className="mt-8">
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md">
                  Add New Project
                </button>
              </div>
              
              <div className="mt-8">
                <p className="text-gray-600">
                  No projects yet. Create your first project to start detecting flaky tests.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SimpleDashboard;