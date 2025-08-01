import { Organization } from '@prisma/client';
import { prisma } from './database.service';

export interface SAMLConfig {
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  cert: string;
  identifierFormat?: string;
  signatureAlgorithm?: string;
  forceAuthn?: boolean;
  attributeMapping?: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    groups?: string;
  };
}

export interface OIDCConfig {
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

export interface SSOProvider {
  id: string;
  organizationId: string;
  name: string;
  type: 'saml' | 'oidc';
  isActive: boolean;
  config: SAMLConfig | OIDCConfig;
  domainRestriction?: string[];
  groupMappings?: GroupMapping[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMapping {
  ssoGroup: string;
  organizationRole: 'owner' | 'admin' | 'member';
  teamMappings?: {
    teamId: string;
    role: 'admin' | 'member';
  }[];
}

export interface SSOUserProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string[];
  provider: string;
  providerId: string;
}

export class SSOService {
  static async createSSOProvider(data: {
    organizationId: string;
    name: string;
    type: 'saml' | 'oidc';
    config: SAMLConfig | OIDCConfig;
    domainRestriction?: string[];
    groupMappings?: GroupMapping[];
  }): Promise<SSOProvider> {
    const provider = await prisma.sSOProvider.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        type: data.type,
        config: data.config as any,
        domainRestriction: data.domainRestriction,
        groupMappings: data.groupMappings as any,
        isActive: true,
      },
    });

    return provider as SSOProvider;
  }

  static async getSSOProvider(id: string): Promise<SSOProvider | null> {
    const provider = await prisma.sSOProvider.findUnique({
      where: { id },
    });

    return provider as SSOProvider | null;
  }

  static async getSSOProviderByOrganization(organizationId: string): Promise<SSOProvider[]> {
    const providers = await prisma.sSOProvider.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return providers as SSOProvider[];
  }

  static async getSSOProviderByDomain(email: string): Promise<SSOProvider | null> {
    const domain = email.split('@')[1];
    
    const provider = await prisma.sSOProvider.findFirst({
      where: {
        isActive: true,
        OR: [
          { domainRestriction: { has: domain } },
          { domainRestriction: null },
        ],
      },
    });

    return provider as SSOProvider | null;
  }

  static async updateSSOProvider(
    id: string,
    data: Partial<{
      name: string;
      config: SAMLConfig | OIDCConfig;
      domainRestriction: string[];
      groupMappings: GroupMapping[];
      isActive: boolean;
    }>
  ): Promise<SSOProvider> {
    const provider = await prisma.sSOProvider.update({
      where: { id },
      data: {
        ...data,
        config: data.config as any,
        groupMappings: data.groupMappings as any,
        updatedAt: new Date(),
      },
    });

    return provider as SSOProvider;
  }

  static async deleteSSOProvider(id: string): Promise<void> {
    await prisma.sSOProvider.delete({
      where: { id },
    });
  }

  static async processUserFromSSO(
    profile: SSOUserProfile,
    organizationId: string
  ): Promise<{
    user: any;
    isNewUser: boolean;
    organizationRole?: 'owner' | 'admin' | 'member';
    teamMemberships?: Array<{ teamId: string; role: 'admin' | 'member' }>;
  }> {
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    const isNewUser = !user;

    // Create user if doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email,
          isActive: true,
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    // Get SSO provider for group mappings
    const ssoProvider = await prisma.sSOProvider.findFirst({
      where: {
        organizationId,
        isActive: true,
      },
    });

    let organizationRole: 'owner' | 'admin' | 'member' | undefined;
    let teamMemberships: Array<{ teamId: string; role: 'admin' | 'member' }> = [];

    if (ssoProvider?.groupMappings && profile.groups) {
      const groupMappings = ssoProvider.groupMappings as GroupMapping[];
      
      // Find the highest role based on group mappings
      for (const group of profile.groups) {
        const mapping = groupMappings.find(m => m.ssoGroup === group);
        if (mapping) {
          // Set highest organization role
          if (!organizationRole || this.getRolePriority(mapping.organizationRole) > this.getRolePriority(organizationRole)) {
            organizationRole = mapping.organizationRole;
          }

          // Collect team memberships
          if (mapping.teamMappings) {
            teamMemberships.push(...mapping.teamMappings);
          }
        }
      }
    }

    // Default role if no mapping found
    if (!organizationRole) {
      organizationRole = 'member';
    }

    // Ensure user is member of organization
    const existingMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organizationId,
      },
    });

    if (!existingMembership) {
      await prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId,
          role: organizationRole,
        },
      });
    } else if (existingMembership.role !== organizationRole) {
      // Update role if it changed
      await prisma.organizationMember.update({
        where: { id: existingMembership.id },
        data: { role: organizationRole },
      });
    }

    // Handle team memberships
    for (const teamMembership of teamMemberships) {
      const existingTeamMembership = await prisma.teamMember.findFirst({
        where: {
          userId: user.id,
          teamId: teamMembership.teamId,
        },
      });

      if (!existingTeamMembership) {
        await prisma.teamMember.create({
          data: {
            userId: user.id,
            teamId: teamMembership.teamId,
            role: teamMembership.role,
          },
        });
      } else if (existingTeamMembership.role !== teamMembership.role) {
        await prisma.teamMember.update({
          where: { id: existingTeamMembership.id },
          data: { role: teamMembership.role },
        });
      }
    }

    return {
      user,
      isNewUser,
      organizationRole,
      teamMemberships,
    };
  }

  private static getRolePriority(role: 'owner' | 'admin' | 'member'): number {
    switch (role) {
      case 'owner': return 3;
      case 'admin': return 2;
      case 'member': return 1;
      default: return 0;
    }
  }

  static async validateSSOConfig(type: 'saml' | 'oidc', config: SAMLConfig | OIDCConfig): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (type === 'saml') {
      const samlConfig = config as SAMLConfig;
      if (!samlConfig.entryPoint) errors.push('SAML Entry Point is required');
      if (!samlConfig.issuer) errors.push('SAML Issuer is required');
      if (!samlConfig.cert) errors.push('SAML Certificate is required');
      if (!samlConfig.callbackUrl) errors.push('SAML Callback URL is required');
    } else if (type === 'oidc') {
      const oidcConfig = config as OIDCConfig;
      if (!oidcConfig.issuer) errors.push('OIDC Issuer is required');
      if (!oidcConfig.clientID) errors.push('OIDC Client ID is required');
      if (!oidcConfig.clientSecret) errors.push('OIDC Client Secret is required');
      if (!oidcConfig.callbackURL) errors.push('OIDC Callback URL is required');
      if (!oidcConfig.scope || oidcConfig.scope.length === 0) {
        errors.push('OIDC Scope is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static async testSSOConnection(providerId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const provider = await this.getSSOProvider(providerId);
      if (!provider) {
        return { success: false, error: 'SSO Provider not found' };
      }

      // Basic validation of the configuration
      const validation = await this.validateSSOConfig(provider.type, provider.config);
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      // For SAML, we could make a test request to the metadata endpoint
      // For OIDC, we could validate the discovery endpoint
      // This is a basic implementation - more comprehensive testing could be added

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}