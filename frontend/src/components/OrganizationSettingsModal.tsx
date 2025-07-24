import React, { useState } from 'react';
import { X, Building2, Mail, Globe, CreditCard, Users, AlertTriangle, Trash2 } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { Organization } from '@shared/types/user';

interface OrganizationSettingsModalProps {
  organization: Organization;
  onClose: () => void;
}

export const OrganizationSettingsModal: React.FC<OrganizationSettingsModalProps> = ({
  organization,
  onClose,
}) => {
  const { updateOrganization, deleteOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'danger'>('general');
  const [formData, setFormData] = useState({
    name: organization.name,
    domain: organization.domain || '',
    billingEmail: organization.billingEmail,
    plan: organization.plan,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$29',
      description: 'Perfect for small teams',
      maxMembers: 3,
      maxProjects: 5,
    },
    {
      id: 'team',
      name: 'Team',
      price: '$59',
      description: 'For growing development teams',
      maxMembers: 10,
      maxProjects: 15,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      description: 'For large organizations',
      maxMembers: 999,
      maxProjects: 999,
    },
  ];

  const tabs = [
    { id: 'general', name: 'General', icon: Building2 },
    { id: 'billing', name: 'Billing & Plans', icon: CreditCard },
    { id: 'danger', name: 'Danger Zone', icon: AlertTriangle },
  ];

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      await updateOrganization(organization.id, formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      await deleteOrganization(organization.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const currentPlan = plans.find(p => p.id === organization.plan);
  const selectedPlan = plans.find(p => p.id === formData.plan);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Organization Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 bg-gray-50">
            <nav className="p-4 space-y-2">
              {tabs.map(tab => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 text-left rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'general' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    General Information
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Organization Name
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Domain
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          name="domain"
                          value={formData.domain}
                          onChange={handleInputChange}
                          className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="company.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Billing Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="email"
                          name="billingEmail"
                          value={formData.billingEmail}
                          onChange={handleInputChange}
                          className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Usage Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Team Members</span>
                        <Users className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">
                        {organization.members.length}
                      </div>
                      <div className="text-xs text-gray-500">
                        of {organization.maxMembers} limit
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Teams</span>
                        <Building2 className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">
                        {organization.teams.length}
                      </div>
                      <div className="text-xs text-gray-500">
                        active teams
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Billing & Subscription
                  </h3>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h4 className="font-medium text-blue-900">Current Plan: {currentPlan?.name}</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      {currentPlan?.price}/month - {currentPlan?.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Change Plan</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {plans.map(plan => (
                        <div
                          key={plan.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            formData.plan === plan.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, plan: plan.id as any }))}
                        >
                          <div className="text-center">
                            <h5 className="font-semibold text-gray-900">{plan.name}</h5>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                              {plan.price}
                              <span className="text-sm font-normal text-gray-500">/month</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
                          </div>
                          
                          <div className="mt-4 text-sm text-gray-600">
                            <div>Up to {plan.maxMembers === 999 ? 'unlimited' : plan.maxMembers} members</div>
                            <div>Up to {plan.maxProjects === 999 ? 'unlimited' : plan.maxProjects} projects</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {formData.plan !== organization.plan && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-medium text-yellow-800">Plan Change Preview</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Switching from {currentPlan?.name} to {selectedPlan?.name} will:
                      </p>
                      <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                        <li>• Change member limit from {organization.maxMembers} to {selectedPlan?.maxMembers === 999 ? 'unlimited' : selectedPlan?.maxMembers}</li>
                        <li>• Change project limit from {organization.maxProjects} to {selectedPlan?.maxProjects === 999 ? 'unlimited' : selectedPlan?.maxProjects}</li>
                        <li>• New billing will start next cycle</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'danger' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Danger Zone
                  </h3>
                  
                  <div className="border border-red-200 rounded-lg p-6">
                    <div className="flex items-start space-x-4">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-red-900">
                          Delete Organization
                        </h4>
                        <p className="text-sm text-red-700 mt-2">
                          Permanently delete this organization and all of its data. This action cannot be undone.
                        </p>
                        <div className="mt-4">
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Organization
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-6 mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              {activeTab !== 'danger' && (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Confirm Deletion
                  </h3>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to delete "{organization.name}"? This will permanently delete:
                </p>
                <ul className="text-sm text-gray-500 mb-6 space-y-1">
                  <li>• All organization data and settings</li>
                  <li>• All teams and projects</li>
                  <li>• All test results and analytics</li>
                  <li>• All team member access</li>
                </ul>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};