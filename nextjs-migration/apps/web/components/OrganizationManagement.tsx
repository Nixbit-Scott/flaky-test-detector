import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  Settings, 
  Plus, 
  Crown, 
  Shield, 
  User,
  Mail,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus
} from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import { InviteUserModal } from './InviteUserModal';
import { OrganizationSettingsModal } from './OrganizationSettingsModal';

export const OrganizationManagement: React.FC = () => {
  const {
    organizations,
    currentOrganization,
    currentMembership,
    loading,
    error,
    setCurrentOrganization,
    removeMember,
    updateMemberRole
  } = useOrganization();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'team':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canManageMembers = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  const canManageSettings = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating your first organization.
        </p>
        <div className="mt-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Organization
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Management</h1>
          <p className="text-gray-600">Manage your organizations and team members</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </button>
      </div>

      {/* Organization Selector */}
      {organizations.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Organization
          </label>
          <select
            value={currentOrganization?.id || ''}
            onChange={(e) => {
              const org = organizations.find(o => o.id === e.target.value);
              setCurrentOrganization(org || null);
            }}
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current Organization Details */}
      {currentOrganization && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building2 className="w-6 h-6 text-gray-400" />
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {currentOrganization.name}
                  </h2>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeColor(currentOrganization.plan)}`}>
                      {currentOrganization.plan.charAt(0).toUpperCase() + currentOrganization.plan.slice(1)}
                    </span>
                    {currentOrganization.domain && (
                      <span className="text-sm text-gray-500">
                        {currentOrganization.domain}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {canManageMembers && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Member
                  </button>
                )}
                {canManageSettings && (
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Organization Stats */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {currentOrganization.members.length}
                </div>
                <div className="text-sm text-gray-500">
                  of {currentOrganization.maxMembers} members
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {currentOrganization.teams.length}
                </div>
                <div className="text-sm text-gray-500">teams</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {currentOrganization.maxProjects}
                </div>
                <div className="text-sm text-gray-500">project limit</div>
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members</h3>
            <div className="space-y-3">
              {currentOrganization.members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {member.user.name || member.user.email}
                        </span>
                        {getRoleIcon(member.role)}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {member.user.email}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                    
                    {canManageMembers && member.role !== 'owner' && (
                      <div className="relative">
                        <button
                          onClick={() => setSelectedMember(member)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateOrganizationModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showInviteModal && currentOrganization && (
        <InviteUserModal
          organizationId={currentOrganization.id}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showSettingsModal && currentOrganization && (
        <OrganizationSettingsModal
          organization={currentOrganization}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};

export default OrganizationManagement;