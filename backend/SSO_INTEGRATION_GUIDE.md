# SSO Integration Guide

## Overview

The Flaky Test Detector now supports enterprise Single Sign-On (SSO) authentication using both SAML 2.0 and OpenID Connect (OIDC) protocols. This allows organizations to integrate with their existing identity providers like Active Directory, Okta, Azure AD, Google Workspace, etc.

## Features

- **SAML 2.0 Support**: Compatible with most enterprise identity providers
- **OpenID Connect Support**: Modern OAuth 2.0-based authentication
- **User Provisioning**: Automatic user creation and role assignment
- **Group Mapping**: Map SSO groups to organization roles and teams
- **Domain Restrictions**: Limit SSO access to specific email domains
- **Multiple Providers**: Support for multiple SSO providers per organization

## Environment Variables

Add these environment variables to your `.env` file:

```bash
# Session configuration (required for SSO)
SESSION_SECRET=your-secure-session-secret-change-in-production

# Optional: Configure allowed origins for CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-production-domain.com
```

## Database Setup

The SSO integration adds a new `sso_providers` table to store SSO configuration:

```sql
-- Run: npx prisma db push
-- This will create the SSOProvider table and update your database schema
```

## API Endpoints

### SSO Discovery
- `POST /api/auth/sso/discover` - Discover SSO provider for email/organization

### SSO Authentication
- `GET /api/auth/sso/login/:organizationId/:providerId` - Initiate SSO login
- `POST /api/auth/sso/callback/:organizationId/:providerId` - Handle SSO callback
- `GET /api/auth/sso/callback/:organizationId/:providerId` - Handle SSO callback (SAML)

### SSO Management (Admin Only)
- `POST /api/sso/providers` - Create SSO provider
- `GET /api/sso/providers/:organizationId` - List organization SSO providers
- `GET /api/sso/providers/:organizationId/:providerId` - Get specific SSO provider
- `PUT /api/sso/providers/:organizationId/:providerId` - Update SSO provider
- `DELETE /api/sso/providers/:organizationId/:providerId` - Delete SSO provider
- `POST /api/sso/providers/:organizationId/:providerId/test` - Test SSO connection

### SAML Metadata
- `GET /api/auth/sso/metadata/:organizationId/:providerId` - Get SAML Service Provider metadata

## SAML Configuration

### Required Fields
```json
{
  "name": "Company SAML SSO",
  "type": "saml",
  "config": {
    "entryPoint": "https://idp.company.com/saml/sso",
    "issuer": "https://idp.company.com/saml/metadata",
    "callbackUrl": "https://your-app.com/api/auth/sso/callback/org_id/provider_id",
    "cert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "identifierFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    "signatureAlgorithm": "sha256",
    "forceAuthn": false,
    "attributeMapping": {
      "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
      "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
      "displayName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      "groups": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
    }
  },
  "domainRestriction": ["company.com", "subsidiary.com"],
  "groupMappings": [
    {
      "ssoGroup": "FlakeDetector-Admins",
      "organizationRole": "admin",
      "teamMappings": [
        {
          "teamId": "team_123",
          "role": "admin"
        }
      ]
    }
  ]
}
```

### Service Provider Metadata
Your SAML Identity Provider will need these values:

- **Entity ID/Issuer**: `https://your-app.com`
- **ACS URL**: `https://your-app.com/api/auth/sso/callback/{organizationId}/{providerId}`
- **Metadata URL**: `https://your-app.com/api/auth/sso/metadata/{organizationId}/{providerId}`

## OIDC Configuration

### Required Fields
```json
{
  "name": "Company OIDC",
  "type": "oidc",
  "config": {
    "issuer": "https://idp.company.com",
    "clientID": "your-client-id",
    "clientSecret": "your-client-secret",
    "callbackURL": "https://your-app.com/api/auth/sso/callback/org_id/provider_id",
    "scope": ["openid", "email", "profile", "groups"],
    "responseType": "code",
    "responseMode": "query",
    "attributeMapping": {
      "email": "email",
      "firstName": "given_name",
      "lastName": "family_name",
      "displayName": "name",
      "groups": "groups"
    }
  }
}
```

## Group Mappings

Map SSO groups to organization roles and teams:

```json
{
  "groupMappings": [
    {
      "ssoGroup": "FlakeDetector-Owners",
      "organizationRole": "owner"
    },
    {
      "ssoGroup": "FlakeDetector-Admins",
      "organizationRole": "admin",
      "teamMappings": [
        {
          "teamId": "team_backend",
          "role": "admin"
        }
      ]
    },
    {
      "ssoGroup": "FlakeDetector-Developers",
      "organizationRole": "member",
      "teamMappings": [
        {
          "teamId": "team_frontend",
          "role": "member"
        },
        {
          "teamId": "team_backend",
          "role": "member"
        }
      ]
    }
  ]
}
```

## Frontend Integration

### SSO Login Flow Component
```tsx
import { SSOLoginFlow } from './components/SSOLoginFlow';

// In your login page
<SSOLoginFlow
  onSSOLogin={(provider) => {
    console.log('SSO login initiated with:', provider);
  }}
  onRegularLogin={() => {
    // Show regular login form
  }}
/>
```

### SSO Configuration Component
```tsx
import { SSOConfiguration } from './components/SSOConfiguration';

// In organization settings
<SSOConfiguration organizationId={organization.id} />
```

## Testing SSO Integration

### 1. Using SSO Test Endpoint
```bash
curl -X POST \
  https://your-app.com/api/sso/providers/org_123/provider_456/test \
  -H "Authorization: Bearer your-jwt-token"
```

### 2. Manual Testing Flow
1. Create an SSO provider through the admin interface
2. Visit: `https://your-app.com/api/auth/sso/login/org_id/provider_id`
3. Complete authentication with your IdP
4. Verify user is created and properly assigned roles

## Common Identity Providers

### Azure AD (SAML)
- **Entry Point**: `https://login.microsoftonline.com/{tenant-id}/saml2`
- **Issuer**: `https://login.microsoftonline.com/{tenant-id}/`
- **Certificate**: Download from Azure AD Enterprise Applications

### Okta (SAML)
- **Entry Point**: `https://{your-okta-domain}/app/{app-name}/{app-id}/sso/saml`
- **Issuer**: `http://www.okta.com/{app-id}`
- **Certificate**: Download from Okta application settings

### Google Workspace (OIDC)
- **Issuer**: `https://accounts.google.com`
- **Scopes**: `["openid", "email", "profile"]`
- **Client ID/Secret**: From Google Cloud Console

### Auth0 (OIDC)
- **Issuer**: `https://{your-domain}.auth0.com/`
- **Scopes**: `["openid", "email", "profile"]`

## Security Considerations

1. **Certificate Validation**: Always validate SAML certificates
2. **Secure Storage**: Client secrets are stored encrypted in the database
3. **Domain Restrictions**: Use domain restrictions to limit access
4. **Session Security**: Sessions are secured with httpOnly cookies
5. **Token Expiration**: JWT tokens have 7-day expiration by default

## Troubleshooting

### Common Issues

1. **SAML Certificate Issues**
   - Ensure certificate is in correct PEM format
   - Verify certificate is not expired
   - Check that certificate matches the one from IdP

2. **OIDC Discovery Issues**
   - Verify issuer URL is accessible
   - Check that discovery document exists at `{issuer}/.well-known/openid_configuration`
   - Ensure client credentials are correct

3. **Attribute Mapping Issues**
   - Verify attribute names match what IdP sends
   - Check attribute mappings in SSO provider configuration
   - Review IdP documentation for correct attribute names

4. **Group Mapping Issues**
   - Ensure group names match exactly (case-sensitive)
   - Verify IdP is sending group information
   - Check that teams exist in the organization

### Debug Logging
Enable debug logging to troubleshoot SSO issues:

```bash
# Set log level to debug
LOG_LEVEL=debug npm start
```

## Production Deployment

### Scaling Considerations
- SSO strategies are registered dynamically per organization/provider
- Consider implementing strategy caching for high-volume deployments
- Monitor memory usage if supporting many concurrent SSO providers

### Security Checklist
- [ ] Use strong SESSION_SECRET in production
- [ ] Enable HTTPS for all SSO endpoints
- [ ] Regularly rotate client secrets
- [ ] Monitor for failed authentication attempts
- [ ] Implement rate limiting on SSO endpoints
- [ ] Validate all certificates before deployment

### Monitoring
- Track SSO login success/failure rates
- Monitor certificate expiration dates
- Set up alerts for SSO provider failures
- Log all SSO configuration changes

## Migration from Regular Auth

Users with existing accounts can still use regular authentication alongside SSO. When a user first logs in via SSO, they'll be matched by email address to existing accounts.

## Support

For SSO integration support:
1. Check the troubleshooting section above
2. Review application logs for detailed error messages
3. Test SSO provider configuration using the test endpoint
4. Verify IdP configuration matches the expected format

## API Reference

See the complete API documentation for detailed request/response schemas and error codes.