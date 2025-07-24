import React, { useState } from 'react';
import { X, Mail, UserPlus, Shield, User, Users } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';

interface InviteUserModalProps {
  organizationId: string;
  onClose: () => void;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  organizationId,
  onClose,
}) => {
  const { inviteUser, currentOrganization } = useOrganization();
  const [formData, setFormData] = useState({
    email: '',
    role: 'member' as 'admin' | 'member',
    teamId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const roles = [
    {
      id: 'member',
      name: 'Member',
      description: 'Can view projects and test results',
      icon: User,
    },
    {
      id: 'admin',
      name: 'Admin',
      description: 'Can manage projects, teams, and invite members',
      icon: Shield,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const inviteData = {
        email: formData.email,
        role: formData.role,
        ...(formData.teamId && { teamId: formData.teamId }),
      };
      
      await inviteUser(organizationId, inviteData);
      setSuccess(true);
      
      // Reset form
      setFormData({
        email: '',
        role: 'member',
        teamId: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
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

  const remainingSlots = currentOrganization 
    ? currentOrganization.maxMembers - currentOrganization.members.length
    : 0;

  if (success) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Invitation Sent!
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              An invitation has been sent to {formData.email}. They will receive an email with instructions to join your organization.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setSuccess(false)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Invite Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <UserPlus className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Invite Team Member
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Available Slots Warning */}
            {remainingSlots <= 3 && (
              <div className={`p-4 rounded-lg ${remainingSlots === 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-sm ${remainingSlots === 0 ? 'text-red-800' : 'text-yellow-800'}`}>
                  {remainingSlots === 0 
                    ? 'You have reached your member limit. Upgrade your plan to invite more members.'
                    : `You have ${remainingSlots} member slot${remainingSlots === 1 ? '' : 's'} remaining.`
                  }
                </p>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={remainingSlots === 0}
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="colleague@company.com"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Role *
              </label>
              <div className="space-y-3">
                {roles.map(role => {
                  const IconComponent = role.icon;
                  return (
                    <div
                      key={role.id}
                      className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                        formData.role === role.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, role: role.id as any }))}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          formData.role === role.id ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <IconComponent className={`w-4 h-4 ${
                            formData.role === role.id ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h4 className="text-sm font-medium text-gray-900">{role.name}</h4>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="role"
                        value={role.id}
                        checked={formData.role === role.id}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team Selection (Optional) */}
            {currentOrganization?.teams && currentOrganization.teams.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Team (Optional)
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    name="teamId"
                    value={formData.teamId}
                    onChange={handleInputChange}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">No specific team</option>
                    {currentOrganization.teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  User will be added to the selected team in addition to the organization
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.email || remainingSlots === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              Send Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};