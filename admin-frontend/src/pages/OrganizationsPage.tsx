import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  NoSymbolIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

import { adminService } from '../services/adminService';
import LoadingSpinner from '../components/LoadingSpinner';

interface Organization {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
  projectCount: number;
  healthScore: number;
  monthlyRevenue: number;
  status: 'active' | 'inactive' | 'suspended';
  lastActivity: Date;
}

interface OrganizationDetailsModalProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

const OrganizationDetailsModal: React.FC<OrganizationDetailsModalProps> = ({
  organizationId,
  isOpen,
  onClose,
}) => {
  const { data: details, isLoading } = useQuery(
    ['organization-details', organizationId],
    () => adminService.getOrganizationDetails(organizationId),
    { enabled: isOpen }
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Organization Details
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : details ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Organization Name</label>
                    <p className="mt-1 text-lg text-gray-900">{details.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Plan</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      details.plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                      details.plan === 'team' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {details.plan.charAt(0).toUpperCase() + details.plan.slice(1)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Billing Email</label>
                    <p className="mt-1 text-gray-900">{details.billingEmail}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Status</label>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                      details.isActive && details.subscriptionStatus === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {details.isActive && details.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Members */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Members ({details.members?.length || 0})</h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {details.members?.map((member: any) => (
                      <div key={member.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <p className="font-medium text-gray-900">{member.user.name}</p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {member.role}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {member.user.lastLoginAt ? `Last login: ${new Date(member.user.lastLoginAt).toLocaleDateString()}` : 'Never logged in'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Teams & Projects */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Teams & Projects</h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {details.teams?.map((team: any) => (
                      <div key={team.id} className="mb-4">
                        <h5 className="font-medium text-gray-900">{team.name}</h5>
                        <div className="ml-4 mt-2 space-y-1">
                          {team.projects?.map((project: any) => (
                            <div key={project.id} className="flex justify-between items-center text-sm">
                              <span className="text-gray-700">{project.name}</span>
                              <div className="flex space-x-2">
                                <span className="text-xs text-gray-500">
                                  {project.flakyTests?.length || 0} flaky tests
                                </span>
                                <span className="text-xs text-gray-500">
                                  {project.testRuns?.length || 0} recent runs
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Organization details not found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrganizationsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [page, setPage] = useState(1);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(
    ['organizations', page, search, statusFilter],
    () => adminService.getOrganizations({
      page,
      limit: 20,
      search: search.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter as 'active' | 'inactive' | 'suspended'
    }),
    { keepPreviousData: true }
  );

  const suspendMutation = useMutation(
    ({ id, reason }: { id: string; reason?: string }) => adminService.suspendOrganization(id, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['organizations']);
        setShowSuspendConfirm(null);
        setSuspendReason('');
      }
    }
  );

  const reactivateMutation = useMutation(
    (id: string) => adminService.reactivateOrganization(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['organizations']);
      }
    }
  );

  const handleSuspend = (orgId: string) => {
    suspendMutation.mutate({ id: orgId, reason: suspendReason });
  };

  const handleReactivate = (orgId: string) => {
    reactivateMutation.mutate(orgId);
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 80) return CheckCircleIcon;
    if (score >= 60) return ExclamationTriangleIcon;
    return XCircleIcon;
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
        </div>
        <div className="card p-8 text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading Organizations</h3>
          <p className="text-gray-600">Failed to load organization data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="mt-2 text-gray-600">
            Manage customer organizations, view usage statistics, and control access.
          </p>
        </div>
        {data && (
          <div className="text-sm text-gray-500">
            {data.pagination.total} organization{data.pagination.total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search organizations by name, email, or domain..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan & Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Health
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.map((org: Organization) => {
                    const HealthIcon = getHealthScoreIcon(org.healthScore);
                    return (
                      <tr key={org.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <BuildingOfficeIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{org.name}</div>
                              <div className="text-sm text-gray-500">
                                Last activity: {new Date(org.lastActivity).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              org.plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                              org.plan === 'team' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">${org.monthlyRevenue}/month</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{org.memberCount} members</div>
                          <div className="text-sm text-gray-500">{org.projectCount} projects</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <HealthIcon className={`h-4 w-4 ${getHealthScoreColor(org.healthScore)} mr-2`} />
                            <span className={`text-sm font-medium ${getHealthScoreColor(org.healthScore)}`}>
                              {org.healthScore}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            org.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {org.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setSelectedOrgId(org.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {org.status === 'active' ? (
                            <button
                              onClick={() => setShowSuspendConfirm(org.id)}
                              className="text-red-600 hover:text-red-900"
                              disabled={suspendMutation.isLoading}
                            >
                              <NoSymbolIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(org.id)}
                              className="text-green-600 hover:text-green-900"
                              disabled={reactivateMutation.isLoading}
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                    disabled={page === data.pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{((page - 1) * 20) + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(page * 20, data.pagination.total)}
                      </span>{' '}
                      of <span className="font-medium">{data.pagination.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronLeftIcon className="h-5 w-5" />
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        {page} of {data.pagination.pages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                        disabled={page === data.pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronRightIcon className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {search.trim() ? 'Try adjusting your search criteria.' : 'No organizations have been created yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Suspend Confirmation Modal */}
      {showSuspendConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Suspend Organization
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        This will suspend the organization's access to the platform. You can reactivate it later.
                      </p>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">
                          Reason (optional)
                        </label>
                        <textarea
                          value={suspendReason}
                          onChange={(e) => setSuspendReason(e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                          rows={3}
                          placeholder="Enter reason for suspension..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => handleSuspend(showSuspendConfirm)}
                  disabled={suspendMutation.isLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {suspendMutation.isLoading ? 'Suspending...' : 'Suspend'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuspendConfirm(null);
                    setSuspendReason('');
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Organization Details Modal */}
      <OrganizationDetailsModal
        organizationId={selectedOrgId || ''}
        isOpen={!!selectedOrgId}
        onClose={() => setSelectedOrgId(null)}
      />
    </div>
  );
};

export default OrganizationsPage;