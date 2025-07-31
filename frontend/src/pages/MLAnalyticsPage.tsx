import React from 'react';
import { useParams } from 'react-router-dom';
import MLAnalyticsDashboard from '../components/MLAnalyticsDashboard';

const MLAnalyticsPage: React.FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();

  if (!organizationId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600 mt-2">Organization ID is required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <MLAnalyticsDashboard organizationId={organizationId} />
    </div>
  );
};

export default MLAnalyticsPage;