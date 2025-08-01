import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc';
  organizationId: string;
  isActive: boolean;
  domainRestriction?: string[];
  groupMappings?: GroupMapping[];
  createdAt: string;
  updatedAt: string;
  configSummary?: {
    entryPoint?: string;
    issuer: string;
    callbackUrl?: string;
    callbackURL?: string;
    clientID?: string;
    scope?: string[];
  };
}

interface GroupMapping {
  ssoGroup: string;
  organizationRole: 'owner' | 'admin' | 'member';
  teamMappings?: Array<{
    teamId: string;
    role: 'admin' | 'member';
  }>;
}

interface SAMLConfig {
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  cert: string;
  identifierFormat?: string;
  signatureAlgorithm?: 'sha1' | 'sha256';
  forceAuthn?: boolean;
  attributeMapping?: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    groups?: string;
  };
}

interface OIDCConfig {
  issuer: string;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string[];
  responseType?: string;
  responseMode?: string;
  attributeMapping?: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    groups?: string;
  };
}

interface SSOConfigurationProps {
  organizationId: string;
}

export const SSOConfiguration: React.FC<SSOConfigurationProps> = ({ organizationId }) => {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SSOProvider | null>(null);

  useEffect(() => {
    loadProviders();
  }, [organizationId]);

  const loadProviders = async () => {
    try {
      const response = await fetch(`/api/sso/providers/${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Failed to load SSO providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this SSO provider?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sso/providers/${organizationId}/${providerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setProviders(providers.filter(p => p.id !== providerId));
      }
    } catch (error) {
      console.error('Failed to delete SSO provider:', error);
    }
  };

  const testConnection = async (providerId: string) => {
    try {
      const response = await fetch(`/api/sso/providers/${organizationId}/${providerId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('SSO connection test successful!');
      } else {
        alert(`SSO connection test failed: ${data.details || data.error}`);
      }
    } catch (error) {
      alert('Failed to test SSO connection');
      console.error('SSO test error:', error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading SSO configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">SSO Configuration</h2>
          <p className="text-gray-600">Manage Single Sign-On providers for your organization</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          Add SSO Provider
        </Button>
      </div>

      {providers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-500 mb-4">No SSO providers configured</div>
            <Button onClick={() => setShowCreateForm(true)}>
              Create Your First SSO Provider
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{provider.name}</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        provider.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {provider.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {provider.type.toUpperCase()}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {provider.configSummary?.issuer}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => testConnection(provider.id)}
                    >
                      Test
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setEditingProvider(provider)}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => deleteProvider(provider.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {provider.type === 'saml' ? (
                    <>
                      <div>
                        <strong>Entry Point:</strong><br />
                        <span className="text-gray-600">{provider.configSummary?.entryPoint}</span>
                      </div>
                      <div>
                        <strong>Callback URL:</strong><br />
                        <span className="text-gray-600">{provider.configSummary?.callbackUrl}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>Client ID:</strong><br />
                        <span className="text-gray-600">{provider.configSummary?.clientID}</span>
                      </div>
                      <div>
                        <strong>Scopes:</strong><br />
                        <span className="text-gray-600">{provider.configSummary?.scope?.join(', ')}</span>
                      </div>
                    </>
                  )}
                  {provider.domainRestriction && provider.domainRestriction.length > 0 && (
                    <div className="col-span-2">
                      <strong>Domain Restrictions:</strong><br />
                      <span className="text-gray-600">{provider.domainRestriction.join(', ')}</span>
                    </div>
                  )}
                </div>

                {provider.groupMappings && provider.groupMappings.length > 0 && (
                  <div className="mt-4">
                    <strong className="text-sm">Group Mappings:</strong>
                    <div className="mt-2 space-y-1">
                      {provider.groupMappings.map((mapping, index) => (
                        <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                          <span className="font-medium">{mapping.ssoGroup}</span> → {mapping.organizationRole}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(showCreateForm || editingProvider) && (
        <SSOProviderForm
          organizationId={organizationId}
          provider={editingProvider}
          onClose={() => {
            setShowCreateForm(false);
            setEditingProvider(null);
          }}
          onSuccess={() => {
            setShowCreateForm(false);
            setEditingProvider(null);
            loadProviders();
          }}
        />
      )}
    </div>
  );
};

const SSOProviderForm: React.FC<{
  organizationId: string;
  provider?: SSOProvider | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ organizationId, provider, onClose, onSuccess }) => {
  const [providerType, setProviderType] = useState<'saml' | 'oidc'>(provider?.type || 'saml');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: provider?.name || '',
    domainRestriction: provider?.domainRestriction?.join(', ') || '',
    // SAML fields
    saml: {
      entryPoint: '',
      issuer: '',
      callbackUrl: `${window.location.origin}/api/auth/sso/callback/${organizationId}/PROVIDER_ID`,
      cert: '',
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      signatureAlgorithm: 'sha256' as 'sha1' | 'sha256',
      forceAuthn: false,
      attributeMapping: {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
        groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
      },
    },
    // OIDC fields
    oidc: {
      issuer: '',
      clientID: '',
      clientSecret: '',
      callbackURL: `${window.location.origin}/api/auth/sso/callback/${organizationId}/PROVIDER_ID`,
      scope: ['openid', 'email', 'profile'],
      responseType: 'code',
      responseMode: 'query',
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
        groups: 'groups',
      },
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const config = providerType === 'saml' ? formData.saml : formData.oidc;
      
      const payload = {
        organizationId,
        name: formData.name,
        type: providerType,
        config,
        domainRestriction: formData.domainRestriction 
          ? formData.domainRestriction.split(',').map(d => d.trim()).filter(Boolean)
          : undefined,
      };

      const url = provider 
        ? `/api/sso/providers/${organizationId}/${provider.id}`
        : '/api/sso/providers';
      
      const method = provider ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to save SSO provider');
      }
    } catch (error) {
      setError('Failed to save SSO provider');
      console.error('SSO save error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>
            {provider ? 'Edit SSO Provider' : 'Create SSO Provider'}
          </CardTitle>
          <CardDescription>
            Configure SAML 2.0 or OpenID Connect authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Provider Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Company SSO"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Provider Type</label>
              <Tabs value={providerType} onValueChange={(value) => setProviderType(value as 'saml' | 'oidc')}>
                <TabsList>
                  <TabsTrigger value="saml">SAML 2.0</TabsTrigger>
                  <TabsTrigger value="oidc">OpenID Connect</TabsTrigger>
                </TabsList>

                <TabsContent value="saml" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Entry Point URL *</label>
                      <input
                        type="url"
                        value={formData.saml.entryPoint}
                        onChange={(e) => setFormData({
                          ...formData,
                          saml: { ...formData.saml, entryPoint: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Issuer *</label>
                      <input
                        type="text"
                        value={formData.saml.issuer}
                        onChange={(e) => setFormData({
                          ...formData,
                          saml: { ...formData.saml, issuer: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">X.509 Certificate *</label>
                    <textarea
                      value={formData.saml.cert}
                      onChange={(e) => setFormData({
                        ...formData,
                        saml: { ...formData.saml, cert: e.target.value }
                      })}
                      className="w-full px-3 py-2 border rounded-md h-32"
                      placeholder="-----BEGIN CERTIFICATE-----..."
                      required
                    />
                  </div>
                </TabsContent>

                <TabsContent value="oidc" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Issuer URL *</label>
                      <input
                        type="url"
                        value={formData.oidc.issuer}
                        onChange={(e) => setFormData({
                          ...formData,
                          oidc: { ...formData.oidc, issuer: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Client ID *</label>
                      <input
                        type="text"
                        value={formData.oidc.clientID}
                        onChange={(e) => setFormData({
                          ...formData,
                          oidc: { ...formData.oidc, clientID: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Client Secret *</label>
                    <input
                      type="password"
                      value={formData.oidc.clientSecret}
                      onChange={(e) => setFormData({
                        ...formData,
                        oidc: { ...formData.oidc, clientSecret: e.target.value }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Domain Restrictions (optional)</label>
              <input
                type="text"
                value={formData.domainRestriction}
                onChange={(e) => setFormData({ ...formData, domainRestriction: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="company.com, subsidiary.com"
              />
              <div className="text-xs text-gray-500">
                Comma-separated list of domains that can use this SSO provider
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (provider ? 'Update' : 'Create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SSOConfiguration;