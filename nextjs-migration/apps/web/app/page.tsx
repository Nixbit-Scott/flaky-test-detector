'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthFlow from '@/components/AuthFlow';
import Dashboard from '@/components/Dashboard';

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return <AuthFlow />;
}
