import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Mail, User, CheckCircle, XCircle, Clock, UserPlus } from 'lucide-react';

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    domain?: string;
  };
}

export const InvitationAcceptance: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (token) {
      fetchInvitationDetails();
    }
  }, [token]);

  const fetchInvitationDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/invitations/${token}`);
      
      if (!response.ok) {
        throw new Error('Invalid or expired invitation');
      }

      const data = await response.json();
      setInvitation(data);

      // Check if invitation is expired
      if (new Date(data.expiresAt) < new Date()) {
        setError('This invitation has expired');
      } else if (data.status !== 'pending') {
        setError('This invitation has already been processed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (needsAccount: boolean = false) => {
    if (!invitation || !token) return;

    setAccepting(true);
    setError(null);

    try {
      const requestData: any = { token };

      if (needsAccount) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        requestData.name = formData.name;
        requestData.password = formData.password;
      }

      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const result = await response.json();

      // Store user info and redirect to login or dashboard
      if (needsAccount) {
        // New account created, redirect to login
        navigate('/login', { 
          state: { 
            message: 'Account created successfully! Please log in.',
            email: invitation.email 
          }
        });
      } else {
        // Existing user, redirect to dashboard
        navigate('/dashboard', { 
          state: { 
            message: `Welcome to ${invitation.organization.name}!` 
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Invalid Invitation
            </h1>
            <p className="text-gray-600 mb-6">
              {error || 'This invitation is not valid or has expired.'}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invitation.expiresAt) < new Date();
  const isProcessed = invitation.status !== 'pending';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              You're Invited!
            </h1>
            <p className="text-gray-600">
              Join {invitation.organization.name} on Nixbit
            </p>
          </div>

          {/* Invitation Details */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">
                  {invitation.organization.name}
                </div>
                {invitation.organization.domain && (
                  <div className="text-sm text-gray-500">
                    {invitation.organization.domain}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">
                  {invitation.email}
                </div>
                <div className="text-sm text-gray-500">
                  Role: {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-900">
                  Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-500">
                  Sent: {new Date(invitation.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!isExpired && !isProcessed && (
            <div className="space-y-4">
              {!showCreateAccount && (
                <div className="space-y-3">
                  <button
                    onClick={() => handleAcceptInvitation(false)}
                    disabled={accepting}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
                  >
                    {accepting && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    Accept Invitation (Existing Account)
                  </button>

                  <button
                    onClick={() => setShowCreateAccount(true)}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 font-medium"
                  >
                    Create Account & Accept
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Choose "Existing Account" if you already have an account with this email.
                    Choose "Create Account" if this is your first time.
                  </p>
                </div>
              )}

              {showCreateAccount && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Create Your Account
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Enter your full name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="Choose a secure password"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm Password
                        </label>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          required
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="Confirm your password"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowCreateAccount(false)}
                      className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleAcceptInvitation(true)}
                      disabled={accepting || !formData.name || !formData.password || !formData.confirmPassword}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {accepting && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      )}
                      Create & Join
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Having trouble? Contact your organization administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};