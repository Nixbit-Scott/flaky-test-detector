import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, CheckCircle, Clock, UserCheck, UserX, 
  Calendar, Building, Mail, Edit3, Trash2, 
  Plus, Search, Filter, Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

interface BetaTester {
  id: string;
  email: string;
  name?: string;
  company?: string;
  teamSize?: string;
  status: 'pending' | 'approved' | 'provisioned' | 'rejected';
  signupDate: string;
  provisionedDate?: string;
  accessExpires?: string;
  notes?: string;
}

interface BetaStats {
  total: number;
  pending: number;
  approved: number;
  provisioned: number;
  rejected: number;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  provisioned: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  provisioned: UserCheck,
  rejected: UserX,
};

export const BetaAdminPanel: React.FC = () => {
  const { token } = useAuth();
  const [testers, setTesters] = useState<BetaTester[]>([]);
  const [stats, setStats] = useState<BetaStats>({
    total: 0,
    pending: 0,
    approved: 0,
    provisioned: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTester, setSelectedTester] = useState<BetaTester | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);

  useEffect(() => {
    fetchBetaTesters();
    fetchBetaAnalytics();
  }, []);

  const fetchBetaTesters = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/beta-admin/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch beta testers');
      }

      const data = await response.json();
      if (data.success) {
        setTesters(data.data);
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching beta testers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBetaAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/beta-admin/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching beta analytics:', err);
    }
  };

  const updateTesterStatus = async (email: string, status: string, notes?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/beta-admin/update-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, status, notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();
      if (data.success) {
        await fetchBetaTesters();
        await fetchBetaAnalytics();
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const provisionAccess = async (email: string, accessDays: number = 30, notes?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/beta-admin/provision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, accessDays, notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to provision access');
      }

      const data = await response.json();
      if (data.success) {
        await fetchBetaTesters();
        await fetchBetaAnalytics();
        setShowProvisionModal(false);
        setSelectedTester(null);
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredTesters = testers.filter(tester => {
    const matchesSearch = !searchTerm || 
      tester.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tester.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tester.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || tester.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Beta Tester Management</h2>
          <p className="text-gray-600">Manage beta access and user provisioning</p>
        </div>
        <button className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Tester
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-gray-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-blue-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.approved}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <UserCheck className="h-8 w-8 text-green-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Provisioned</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.provisioned}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <UserX className="h-8 w-8 text-red-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.rejected}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="provisioned">Provisioned</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <button className="btn-outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Testers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signup Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTesters.map((tester) => {
                const StatusIcon = statusIcons[tester.status];
                return (
                  <tr key={tester.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {(tester.name || tester.email)[0].toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {tester.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">{tester.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tester.company || '-'}</div>
                      <div className="text-sm text-gray-500">{tester.teamSize || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[tester.status]}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {tester.status.charAt(0).toUpperCase() + tester.status.slice(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tester.signupDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {tester.status === 'pending' && (
                        <button
                          onClick={() => updateTesterStatus(tester.email, 'approved')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Approve
                        </button>
                      )}
                      {(tester.status === 'approved' || tester.status === 'pending') && (
                        <button
                          onClick={() => {
                            setSelectedTester(tester);
                            setShowProvisionModal(true);
                          }}
                          className="text-green-600 hover:text-green-900"
                        >
                          Provision
                        </button>
                      )}
                      <button
                        onClick={() => updateTesterStatus(tester.email, 'rejected')}
                        className="text-red-600 hover:text-red-900"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTesters.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No beta testers</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'No testers match your current filters.' 
                : 'Get started by adding your first beta tester.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Provision Access Modal */}
      {showProvisionModal && selectedTester && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Provision Access for {selectedTester.email}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Access Duration (days)
                </label>
                <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="30">30 days (1 month)</option>
                  <option value="60">60 days (2 months)</option>
                  <option value="90">90 days (3 months)</option>
                  <option value="365">365 days (1 year)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Add any notes about this user..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowProvisionModal(false);
                  setSelectedTester(null);
                }}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => provisionAccess(selectedTester.email, 30)}
                className="btn-primary"
              >
                Provision Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
    </div>
  );
};

export default BetaAdminPanel;