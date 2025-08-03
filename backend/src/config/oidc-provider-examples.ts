/**
 * Example OIDC Provider Configurations
 * 
 * This file contains example configurations for popular OIDC providers.
 * These examples show the correct configuration format for each provider
 * and include security best practices.
 */

export interface OIDCProviderExample {
  name: string;
  issuer: string;
  clientID: string; // Placeholder - replace with actual client ID
  clientSecret: string; // Placeholder - replace with actual client secret
  callbackURL: string; // Update with your domain
  scope: string[];
  responseType: string;
  responseMode?: string;
  attributeMapping?: {
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    groups?: string;
  };
  security?: {
    validateIssuer: boolean;
    validateAudience: boolean;
    validateTokenExpiry: boolean;
    clockTolerance: number;
    requireNonce: boolean;
    requirePKCE: boolean;
  };
  additionalParams?: Record<string, string>;
}

/**
 * Google OAuth 2.0 / OpenID Connect Configuration
 */
export const GoogleOIDCExample: OIDCProviderExample = {
  name: 'Google SSO',
  issuer: 'https://accounts.google.com',
  clientID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
  callbackURL: 'https://your-domain.com/api/sso/callback/oidc/YOUR_ORG_ID/YOUR_PROVIDER_ID',
  scope: ['openid', 'profile', 'email'],
  responseType: 'code',
  responseMode: 'query',
  attributeMapping: {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    displayName: 'name',
    groups: 'groups' // Note: Google doesn't provide groups by default
  },
  security: {
    validateIssuer: true,
    validateAudience: true,
    validateTokenExpiry: true,
    clockTolerance: 300, // 5 minutes
    requireNonce: true,
    requirePKCE: true,
  },
  additionalParams: {
    prompt: 'select_account',
    access_type: 'online',
    include_granted_scopes: 'true'
  }
};

/**
 * Microsoft Azure AD / Entra ID Configuration
 */
export const AzureADOIDCExample: OIDCProviderExample = {
  name: 'Azure AD SSO',
  issuer: 'https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0',
  clientID: 'YOUR_AZURE_CLIENT_ID',
  clientSecret: 'YOUR_AZURE_CLIENT_SECRET',
  callbackURL: 'https://your-domain.com/api/sso/callback/oidc/YOUR_ORG_ID/YOUR_PROVIDER_ID',
  scope: ['openid', 'profile', 'email', 'User.Read', 'GroupMember.Read.All'],
  responseType: 'code',
  responseMode: 'query',
  attributeMapping: {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    displayName: 'name',
    groups: 'groups'
  },
  security: {
    validateIssuer: true,
    validateAudience: true,
    validateTokenExpiry: true,
    clockTolerance: 300,
    requireNonce: true,
    requirePKCE: true,
  },
  additionalParams: {
    prompt: 'select_account',
    domain_hint: 'your-domain.com' // Optional: hint for the user's domain
  }
};

/**
 * Auth0 Configuration
 */
export const Auth0OIDCExample: OIDCProviderExample = {
  name: 'Auth0 SSO',
  issuer: 'https://YOUR_AUTH0_DOMAIN.auth0.com/',
  clientID: 'YOUR_AUTH0_CLIENT_ID',
  clientSecret: 'YOUR_AUTH0_CLIENT_SECRET',
  callbackURL: 'https://your-domain.com/api/sso/callback/oidc/YOUR_ORG_ID/YOUR_PROVIDER_ID',
  scope: ['openid', 'profile', 'email', 'read:user_metadata'],
  responseType: 'code',
  responseMode: 'query',
  attributeMapping: {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    displayName: 'name',
    groups: 'https://your-domain.com/groups' // Custom claim namespace
  },
  security: {
    validateIssuer: true,
    validateAudience: true,
    validateTokenExpiry: true,
    clockTolerance: 300,
    requireNonce: true,
    requirePKCE: true,
  },
  additionalParams: {
    audience: 'YOUR_AUTH0_API_IDENTIFIER', // If using Auth0 API
    connection: 'Username-Password-Authentication' // Optional: specify connection
  }
};

/**
 * Okta Configuration
 */
export const OktaOIDCExample: OIDCProviderExample = {
  name: 'Okta SSO',
  issuer: 'https://YOUR_OKTA_DOMAIN.okta.com/oauth2/default',
  clientID: 'YOUR_OKTA_CLIENT_ID',
  clientSecret: 'YOUR_OKTA_CLIENT_SECRET',
  callbackURL: 'https://your-domain.com/api/sso/callback/oidc/YOUR_ORG_ID/YOUR_PROVIDER_ID',
  scope: ['openid', 'profile', 'email', 'groups'],
  responseType: 'code',
  responseMode: 'query',
  attributeMapping: {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    displayName: 'name',
    groups: 'groups'
  },
  security: {
    validateIssuer: true,
    validateAudience: true,
    validateTokenExpiry: true,
    clockTolerance: 300,
    requireNonce: true,
    requirePKCE: true,
  },
  additionalParams: {
    prompt: 'select_account'
  }
};

/**
 * AWS Cognito Configuration
 */
export const CognitoOIDCExample: OIDCProviderExample = {
  name: 'AWS Cognito SSO',
  issuer: 'https://cognito-idp.YOUR_REGION.amazonaws.com/YOUR_USER_POOL_ID',
  clientID: 'YOUR_COGNITO_CLIENT_ID',
  clientSecret: 'YOUR_COGNITO_CLIENT_SECRET',
  callbackURL: 'https://your-domain.com/api/sso/callback/oidc/YOUR_ORG_ID/YOUR_PROVIDER_ID',
  scope: ['openid', 'profile', 'email', 'aws.cognito.signin.user.admin'],
  responseType: 'code',
  responseMode: 'query',
  attributeMapping: {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    displayName: 'name',
    groups: 'cognito:groups'
  },
  security: {
    validateIssuer: true,
    validateAudience: true,
    validateTokenExpiry: true,
    clockTolerance: 300,
    requireNonce: true,
    requirePKCE: true,
  }
};

/**
 * Generic OIDC Provider Template
 */
export const GenericOIDCExample: OIDCProviderExample = {
  name: 'Generic OIDC Provider',
  issuer: 'https://your-oidc-provider.com',
  clientID: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  callbackURL: 'https://your-domain.com/api/sso/callback/oidc/YOUR_ORG_ID/YOUR_PROVIDER_ID',
  scope: ['openid', 'profile', 'email'],
  responseType: 'code',
  responseMode: 'query',
  attributeMapping: {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    displayName: 'name',
    groups: 'groups'
  },
  security: {
    validateIssuer: true,
    validateAudience: true,
    validateTokenExpiry: true,
    clockTolerance: 300,
    requireNonce: true,
    requirePKCE: true,
  }
};

/**
 * Configuration validation helper
 */
export function validateProviderExample(example: OIDCProviderExample): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!example.issuer || !example.issuer.startsWith('https://')) {
    errors.push('Issuer must be a valid HTTPS URL');
  }

  if (!example.clientID || example.clientID.includes('YOUR_')) {
    errors.push('Client ID must be configured with actual value');
  }

  if (!example.clientSecret || example.clientSecret.includes('YOUR_')) {
    errors.push('Client Secret must be configured with actual value');
  }

  if (!example.callbackURL || example.callbackURL.includes('YOUR_')) {
    errors.push('Callback URL must be configured with actual value');
  }

  if (!example.scope.includes('openid')) {
    errors.push('OpenID scope is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get provider example by name
 */
export function getProviderExample(providerName: string): OIDCProviderExample | null {
  const providers: Record<string, OIDCProviderExample> = {
    'google': GoogleOIDCExample,
    'azure': AzureADOIDCExample,
    'azuread': AzureADOIDCExample,
    'auth0': Auth0OIDCExample,
    'okta': OktaOIDCExample,
    'cognito': CognitoOIDCExample,
    'aws-cognito': CognitoOIDCExample,
    'generic': GenericOIDCExample
  };

  return providers[providerName.toLowerCase()] || null;
}

/**
 * List all available provider examples
 */
export function listProviderExamples(): Array<{ name: string; displayName: string; issuer: string }> {
  return [
    { name: 'google', displayName: 'Google OAuth 2.0', issuer: GoogleOIDCExample.issuer },
    { name: 'azure', displayName: 'Microsoft Azure AD', issuer: AzureADOIDCExample.issuer },
    { name: 'auth0', displayName: 'Auth0', issuer: Auth0OIDCExample.issuer },
    { name: 'okta', displayName: 'Okta', issuer: OktaOIDCExample.issuer },
    { name: 'cognito', displayName: 'AWS Cognito', issuer: CognitoOIDCExample.issuer },
    { name: 'generic', displayName: 'Generic OIDC Provider', issuer: GenericOIDCExample.issuer }
  ];
}

/**
 * Security recommendations for each provider
 */
export const SecurityRecommendations = {
  google: [
    'Enable 2FA for your Google Cloud Console account',
    'Use OAuth consent screen verification for production',
    'Restrict authorized domains and redirect URIs',
    'Monitor usage in Google Cloud Console'
  ],
  azure: [
    'Enable conditional access policies',
    'Use App Registration certificates instead of secrets when possible',
    'Configure token lifetime policies',
    'Enable sign-in logs and audit logs'
  ],
  auth0: [
    'Enable anomaly detection',
    'Configure brute force protection',
    'Use custom domains for production',
    'Enable multi-factor authentication rules'
  ],
  okta: [
    'Configure sign-on policies',
    'Enable network zones restriction',
    'Use API access management for fine-grained control',
    'Monitor system logs for suspicious activity'
  ],
  cognito: [
    'Enable advanced security features',
    'Configure user pool MFA settings',
    'Use resource servers for API authorization',
    'Enable CloudTrail logging for audit'
  ]
};

export default {
  GoogleOIDCExample,
  AzureADOIDCExample,
  Auth0OIDCExample,
  OktaOIDCExample,
  CognitoOIDCExample,
  GenericOIDCExample,
  validateProviderExample,
  getProviderExample,
  listProviderExamples,
  SecurityRecommendations
};