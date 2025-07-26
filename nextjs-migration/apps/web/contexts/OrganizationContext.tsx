'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Organization, OrganizationMember } from '@shared/types/user';
import { API_BASE_URL } from '../config/api';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  currentMembership: OrganizationMember | null;
  loading: boolean;
  error: string | null;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (data: any) => Promise<Organization>;
  updateOrganization: (id: string, data: any) => Promise<Organization>;
  deleteOrganization: (id: string) => Promise<void>;
  inviteUser: (organizationId: string, data: any) => Promise<void>;
  removeMember: (organizationId: string, userId: string) => Promise<void>;
  updateMemberRole: (organizationId: string, userId: string, role: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

interface OrganizationProviderProps {
  children: React.ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentMembership, setCurrentMembership] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const refreshOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const orgs = await response.json();
      setOrganizations(orgs);

      // Set current organization to first one if none selected
      if (!currentOrganization && orgs.length > 0) {
        setCurrentOrganization(orgs[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (data: any): Promise<Organization> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create organization');
      }

      const newOrg = await response.json();
      await refreshOrganizations();
      return newOrg;
    } catch (err) {
      throw err;
    }
  };

  const updateOrganization = async (id: string, data: any): Promise<Organization> => {
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update organization');
      }

      const updatedOrg = await response.json();
      await refreshOrganizations();
      return updatedOrg;
    } catch (err) {
      throw err;
    }
  };

  const deleteOrganization = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete organization');
      }

      await refreshOrganizations();
      
      if (currentOrganization?.id === id) {
        setCurrentOrganization(null);
      }
    } catch (err) {
      throw err;
    }
  };

  const inviteUser = async (organizationId: string, data: any): Promise<void> => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/invitations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to invite user');
      }

      await refreshOrganizations();
    } catch (err) {
      throw err;
    }
  };

  const removeMember = async (organizationId: string, userId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }

      await refreshOrganizations();
    } catch (err) {
      throw err;
    }
  };

  const updateMemberRole = async (organizationId: string, userId: string, role: string): Promise<void> => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${userId}/role`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }

      await refreshOrganizations();
    } catch (err) {
      throw err;
    }
  };

  // Update current membership when organization changes
  useEffect(() => {
    if (currentOrganization) {
      const userId = localStorage.getItem('userId'); // Assuming user ID is stored
      const membership = currentOrganization.members.find(m => m.userId === userId);
      setCurrentMembership(membership || null);
    } else {
      setCurrentMembership(null);
    }
  }, [currentOrganization]);

  // Load organizations on mount
  useEffect(() => {
    refreshOrganizations();
  }, []);

  const value = {
    organizations,
    currentOrganization,
    currentMembership,
    loading,
    error,
    setCurrentOrganization,
    refreshOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    inviteUser,
    removeMember,
    updateMemberRole,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};