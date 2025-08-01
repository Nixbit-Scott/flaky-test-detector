import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ServerIcon,
  ClockIcon,
  CpuChipIcon,
  CircleStackIcon,
  CloudIcon,
  WifiIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

import { adminService } from '../services/adminService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useSystemHealthWebSocket } from '../hooks/useWebSocket';
import WebSocketStatus from '../components/WebSocketStatus';

// Remove local interface and use the one from types
import { SystemHealth } from '../types';

interface ServiceUpdateModalProps {
  service: SystemHealth | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (serviceName: string, status: 'healthy' | 'degraded' | 'unhealthy', metadata?: any) => void;
  isLoading: boolean;
}

const ServiceUpdateModal: React.FC<ServiceUpdateModalProps> = ({
  service,
  isOpen,
  onClose,
  onUpdate,
  isLoading,
}) => {
  const [status, setStatus] = useState<'healthy' | 'degraded' | 'unhealthy'>('healthy');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (service) {
      setStatus(service.status);
      setNotes('');
    }
  }, [service]);

  if (!isOpen || !service) return null;

  const handleUpdate = () => {
    const metadata = notes ? { notes, updatedBy: 'admin' } : { updatedBy: 'admin' };
    onUpdate(service.serviceName, status, metadata);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Update Service Status
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Update the status for {service.serviceName}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="healthy">Healthy</option>
                  <option value="degraded">Degraded</option>
                  <option value="unhealthy">Unhealthy</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                  placeholder="Enter any notes about this status update..."
                />
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isLoading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {isLoading ? 'Updating...' : 'Update Status'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemHealthPage: React.FC = () => {
  const [selectedService, setSelectedService] = useState<SystemHealth | null>(null);
  
  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates
  const { isConnected, isConnecting, error: wsError, connect } = useSystemHealthWebSocket();

  const { data: healthData, isLoading, error } = useQuery(
    'system-health',
    () => adminService.getSystemHealth(),
    { 
      refetchInterval: isConnected ? false : 30000, // Only use polling if WebSocket is disconnected
      staleTime: isConnected ? 60000 : 30000 // Data is fresher when WebSocket is connected
    }
  );

  const updateHealthMutation = useMutation(
    ({ serviceName, status, metadata }: { serviceName: string; status: 'healthy' | 'degraded' | 'unhealthy'; metadata?: any }) =>
      adminService.updateSystemHealth(serviceName, status, metadata),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('system-health');
        setSelectedService(null);
      },
    }
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return CheckCircleIcon;
      case 'degraded':
        return ExclamationTriangleIcon;
      case 'unhealthy':
        return XCircleIcon;
      default:
        return ServerIcon;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName.toLowerCase()) {
      case 'database':
        return CircleStackIcon;
      case 'redis':
        return ServerIcon;
      case 'api':
        return CpuChipIcon;
      case 'webhooks':
        return CloudIcon;
      case 'network':
        return WifiIcon;
      default:
        return Cog6ToothIcon;
    }
  };

  const formatDuration = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleUpdateService = (serviceName: string, status: 'healthy' | 'degraded' | 'unhealthy', metadata?: any) => {
    updateHealthMutation.mutate({ serviceName, status, metadata });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        </div>
        <div className="card p-8 text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading System Health</h3>
          <p className="text-gray-600">Failed to load system health data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const healthyServices = healthData?.filter(s => s.status === 'healthy').length || 0;
  const degradedServices = healthData?.filter(s => s.status === 'degraded').length || 0;
  const unhealthyServices = healthData?.filter(s => s.status === 'unhealthy').length || 0;
  const totalServices = healthData?.length || 0;

  const overallHealthScore = totalServices > 0 
    ? Math.round(((healthyServices * 100) + (degradedServices * 50)) / totalServices) 
    : 100;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="mt-2 text-gray-600">
            Monitor system performance, service availability, and infrastructure metrics.
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
              Live Updates
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-end">
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {overallHealthScore}%
          </div>
          <div className="text-sm text-gray-500">Overall Health</div>
        </div>
      </div>

      {/* Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Healthy Services
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {healthyServices}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Degraded Services
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {degradedServices}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Unhealthy Services
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {unhealthyServices}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ServerIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Services
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {totalServices}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Services Status */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Service Status</h3>
          <p className="mt-1 text-sm text-gray-500">
            Current status of all monitored services
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : healthData && healthData.length > 0 ? (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Check
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {healthData.map((service: SystemHealth) => {
                  const StatusIcon = getStatusIcon(service.status);
                  const ServiceIcon = getServiceIcon(service.serviceName);
                  return (
                    <tr key={service.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <ServiceIcon className="h-6 w-6 text-gray-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {service.serviceName}
                            </div>
                            {service.lastError && (
                              <div className="text-xs text-red-600 truncate max-w-xs">
                                {service.lastError}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {service.responseTime ? (
                          <div className="flex items-center">
                            <ClockIcon className="mr-1 h-4 w-4 text-gray-400" />
                            {service.responseTime}ms
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {service.errorRate !== undefined ? (
                          <div className={`text-sm ${
                            service.errorRate > 5 ? 'text-red-600' :
                            service.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {service.errorRate.toFixed(1)}%
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(service.checkedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedService(service)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <ServerIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Services Monitored</h3>
            <p className="mt-1 text-sm text-gray-500">
              No system health data available. Services will appear here once monitoring is configured.
            </p>
          </div>
        )}
      </div>

      {/* Service Update Modal */}
      <ServiceUpdateModal
        service={selectedService}
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
        onUpdate={handleUpdateService}
        isLoading={updateHealthMutation.isLoading}
      />
    </div>
  );
};

export default SystemHealthPage;