import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc';
  organizationId: string;
}

interface SSODiscoveryResponse {
  hasSSOProvider: boolean;
  provider?: SSOProvider;
  message?: string;
}

interface SSOLoginFlowProps {
  onSSOLogin?: (provider: SSOProvider) => void;
  onRegularLogin?: () => void;
}

export const SSOLoginFlow: React.FC<SSOLoginFlowProps> = ({
  onSSOLogin,
  onRegularLogin
}) => {
  const [email, setEmail] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoProvider, setSSOProvider] = useState<SSOProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSSOOptions, setShowSSOOptions] = useState(false);

  const discoverSSO = async () => {
    if (!email && !organizationId) {
      setErrorMessage('Please enter an email address or organization ID');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/sso/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email || undefined,
          organizationId: organizationId || undefined,
        }),
      });

      const data: SSODiscoveryResponse = await response.json();

      if (data.hasSSOProvider && data.provider) {
        setSSOProvider(data.provider);
        setShowSSOOptions(true);
      } else {
        setErrorMessage(data.message || 'No SSO provider found');
        setShowSSOOptions(false);
      }
    } catch (error) {
      setErrorMessage('Failed to discover SSO provider');
      console.error('SSO discovery error:', error);
    } finally {
      setLoading(false);
    }
  };

  const initiateSSO = async () => {
    if (!ssoProvider) return;

    setLoading(true);
    
    try {
      // Redirect to SSO login endpoint
      const redirectUrl = encodeURIComponent(window.location.origin + '/dashboard');
      window.location.href = `/api/auth/sso/login/${ssoProvider.organizationId}/${ssoProvider.id}?redirectUrl=${redirectUrl}`;
      
      if (onSSOLogin) {
        onSSOLogin(ssoProvider);
      }
    } catch (error) {
      setErrorMessage('Failed to initiate SSO login');
      console.error('SSO login error:', error);
      setLoading(false);
    }
  };

  const handleRegularLogin = () => {
    if (onRegularLogin) {
      onRegularLogin();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Enterprise Login</CardTitle>
          <CardDescription>
            Sign in with your organization's Single Sign-On (SSO) or use regular login
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showSSOOptions ? (
            <>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-center text-sm text-gray-500">or</div>

              <div className="space-y-2">
                <label htmlFor="organizationId" className="text-sm font-medium">
                  Organization ID
                </label>
                <input
                  id="organizationId"
                  type="text"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  placeholder="Enter organization ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {errorMessage && (
                <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Button
                  onClick={discoverSSO}
                  disabled={loading || (!email && !organizationId)}
                  className="w-full"
                >
                  {loading ? 'Checking...' : 'Check for SSO'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleRegularLogin}
                  className="w-full"
                >
                  Use Regular Login
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="text-green-800 font-medium">SSO Available</div>
                </div>
                <div className="mt-2 text-green-700">
                  <div className="font-medium">{ssoProvider?.name}</div>
                  <div className="text-sm opacity-75">
                    {ssoProvider?.type.toUpperCase()} Authentication
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={initiateSSO}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Redirecting...' : `Sign in with ${ssoProvider?.name}`}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSSOOptions(false);
                    setSSOProvider(null);
                    setErrorMessage('');
                  }}
                  className="w-full"
                >
                  Back
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleRegularLogin}
                  className="w-full text-sm"
                >
                  Use Regular Login Instead
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600 space-y-2">
            <div className="font-medium">Enterprise Authentication</div>
            <ul className="space-y-1 text-xs">
              <li>• SAML 2.0 and OpenID Connect support</li>
              <li>• Automatic user provisioning</li>
              <li>• Team and role mapping</li>
              <li>• Secure single sign-on</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SSOLoginFlow;