import React from 'react';
import { useQuery } from 'react-query';
import {
  BuildingOfficeIcon,
  UsersIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ServerIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

import { adminService } from '../services/adminService';
import LoadingSpinner from '../components/LoadingSpinner';
import StatsCard from '../components/StatsCard';
import ActivityFeed from '../components/ActivityFeed';
import PlatformMetrics from '../components/PlatformMetrics';
import { useAdminDashboardWebSocket } from '../hooks/useWebSocket';
import WebSocketStatus from '../components/WebSocketStatus';

const DashboardPage: React.FC = () => {
  // WebSocket connection for real-time updates
  const { isConnected, isConnecting, error: wsError, connect } = useAdminDashboardWebSocket();

  const { data: stats, isLoading: statsLoading } = useQuery(
    'admin-overview',
    () => adminService.getOverviewStats(),
    { 
      refetchInterval: isConnected ? false : 30000, // Only use polling if WebSocket is disconnected
      staleTime: isConnected ? 300000 : 30000 // 5 minutes when connected, 30 seconds when not
    }
  );

  const { data: metrics, isLoading: metricsLoading } = useQuery(
    'admin-metrics',
    () => adminService.getPlatformMetrics(),
    { 
      refetchInterval: isConnected ? false : 60000, // Only use polling if WebSocket is disconnected
      staleTime: isConnected ? 300000 : 60000 // 5 minutes when connected, 1 minute when not
    }
  );

  const { data: activity, isLoading: activityLoading } = useQuery(
    'admin-activity',
    () => adminService.getRealtimeActivity(),
    { 
      refetchInterval: isConnected ? false : 15000, // Only use polling if WebSocket is disconnected
      staleTime: isConnected ? 60000 : 15000 // 1 minute when connected, 15 seconds when not
    }
  );

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: stats?.totalOrganizations?.toLocaleString() || '0',
      icon: BuildingOfficeIcon,
      color: 'blue',
      change: stats?.totalOrganizations ? '+12%' : 'No data',
      changeType: stats?.totalOrganizations ? 'increase' as const : 'neutral' as const,
    },
    {
      title: 'Active Users',
      value: stats?.activeUsers?.toLocaleString() || '0',
      icon: UsersIcon,
      color: 'green',
      change: stats?.activeUsers ? '+8%' : 'No data',
      changeType: stats?.activeUsers ? 'increase' as const : 'neutral' as const,
    },
    {
      title: 'Test Runs Today',
      value: stats?.testRunsToday?.toLocaleString() || '0',
      icon: PlayIcon,
      color: 'purple',
      change: stats?.testRunsToday ? '+23%' : 'No data',
      changeType: stats?.testRunsToday ? 'increase' as const : 'neutral' as const,
    },
    {
      title: 'Active Flaky Tests',
      value: stats?.activeFlakyTests?.toLocaleString() || '0',
      icon: ExclamationTriangleIcon,
      color: 'yellow',
      change: stats?.activeFlakyTests ? '-5%' : 'No data',
      changeType: stats?.activeFlakyTests ? 'decrease' as const : 'neutral' as const,
    },
    {
      title: 'Monthly Recurring Revenue',
      value: `$${stats?.monthlyRecurringRevenue?.toLocaleString() || '0'}`,
      icon: CurrencyDollarIcon,
      color: 'green',
      change: stats?.monthlyRecurringRevenue ? '+15%' : 'No data',
      changeType: stats?.monthlyRecurringRevenue ? 'increase' as const : 'neutral' as const,
    },
    {
      title: 'System Uptime',
      value: `${stats?.systemUptime?.toFixed(1) || '0'}%`,
      icon: ServerIcon,
      color: 'green',
      change: stats?.systemUptime && stats.systemUptime > 99.5 ? 'Excellent' : 'Good',
      changeType: 'neutral' as const,
    },
    {
      title: 'Avg Response Time',
      value: `${stats?.averageResponseTime?.toFixed(0) || '0'}ms`,
      icon: ClockIcon,
      color: stats?.averageResponseTime && stats.averageResponseTime < 200 ? 'green' : 'yellow',
      change: stats?.averageResponseTime && stats.averageResponseTime < 200 ? 'Optimal' : 'Fair',
      changeType: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome to the Nixbit admin dashboard. Monitor platform health and manage your SaaS application.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <WebSocketStatus
            isConnected={isConnected}
            isConnecting={isConnecting}
            error={wsError}
            onReconnect={connect}
          />
          {isConnected && (
            <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
              Real-time Data
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Platform Metrics and Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Platform Metrics - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Metrics</h3>
            {metricsLoading ? (
              <div className="flex items-center justify-center h-48">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <PlatformMetrics data={metrics} />
            )}
          </div>
        </div>

        {/* Real-time Activity */}
        <div>
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Activity</h3>
            {activityLoading ? (
              <div className="flex items-center justify-center h-48">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <ActivityFeed data={activity?.activity || []} />
            )}
          </div>
        </div>
      </div>

      {/* Organization Health Overview */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization Health Overview</h3>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Health Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats?.organizations && stats.organizations.length > 0 ? (
                stats.organizations.map((org: any) => (
                  <tr key={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {org.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="badge-gray">{org.plan}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              org.healthScore > 90 ? 'bg-green-600' : 
                              org.healthScore > 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} 
                            style={{ width: `${org.healthScore}%` }}
                          ></div>
                        </div>
                        <span>{org.healthScore}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge-${
                        org.status === 'active' ? 'success' : 
                        org.status === 'warning' ? 'warning' : 'error'
                      }`}>
                        {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                    <div className="flex flex-col items-center">
                      <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-2" />
                      <p className="font-medium">No organizations yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Organizations will appear here as users sign up and create accounts
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;