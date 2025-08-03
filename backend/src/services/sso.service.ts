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
  nestedGroups?: string[];
  priority?: number;
  conditions?: {
    department?: string[];
    jobTitle?: string[];
    customAttribute?: {
      key: string;
      value: string | string[];
    };
  };
}

export interface SSOUserProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string[];
  provider: string;
  providerId: string;
  department?: string;
  jobTitle?: string;
  phoneNumber?: string;
  managerId?: string;
  customAttributes?: Record<string, any>;
  lastSSOSync?: Date;
}

export interface UserProvisioningResult {
  user: any;
  isNewUser: boolean;
  wasUpdated: boolean;
  organizationRole?: 'owner' | 'admin' | 'member';
  teamMemberships?: Array<{ teamId: string; role: 'admin' | 'member' }>;
  conflicts?: string[];
  syncedAttributes?: string[];
}

export interface DomainPolicy {
  domain: string;
  allowSubdomains?: boolean;
  autoProvision?: boolean;
  defaultRole?: 'owner' | 'admin' | 'member';
  requiredGroups?: string[];
  blockedGroups?: string[];
}

export interface SSOAuditEvent {
  userId?: string;
  email: string;
  provider: string;
  action: 'login' | 'provision' | 'update' | 'denied' | 'error';
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
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

    return provider as any as SSOProvider;
  }

  static async getSSOProvider(id: string): Promise<SSOProvider | null> {
    const provider = await prisma.sSOProvider.findUnique({
      where: { id },
    });

    return provider as any as SSOProvider | null;
  }

  static async getSSOProviderByOrganization(organizationId: string): Promise<SSOProvider[]> {
    const providers = await prisma.sSOProvider.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return providers as any as SSOProvider[];
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

    return provider as any as SSOProvider | null;
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

    return provider as any as SSOProvider;
  }

  static async deleteSSOProvider(id: string): Promise<void> {
    await prisma.sSOProvider.delete({
      where: { id },
    });
  }

  static async processUserFromSSO(
    profile: SSOUserProfile,
    organizationId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserProvisioningResult> {
    const conflicts: string[] = [];
    const syncedAttributes: string[] = [];

    try {
      // Check domain-based access control
      const domainAccess = await this.checkDomainAccess(profile.email, organizationId);
      if (!domainAccess.allowed) {
        await this.logSSOAudit({
          email: profile.email,
          provider: profile.provider,
          action: 'denied',
          details: { reason: domainAccess.reason },
          ipAddress,
          userAgent,
          timestamp: new Date(),
        });
        throw new Error(domainAccess.reason);
      }

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: profile.email },
        include: {
          ssoProfiles: true,
        },
      });

      const isNewUser = !user;
      let wasUpdated = false;

      // Create or update user with conflict resolution
      if (!user) {
        user = await this.createUserFromSSO(profile, organizationId);
        syncedAttributes.push('email', 'name', 'profile_created');
      } else {
        const updateResult = await this.updateUserFromSSO(user, profile);
        wasUpdated = updateResult.wasUpdated;
        conflicts.push(...updateResult.conflicts);
        syncedAttributes.push(...updateResult.syncedAttributes);

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      // Update or create SSO profile
      await this.upsertSSOProfile(user.id, profile);

      // Get SSO provider for group mappings
      const ssoProvider = await prisma.sSOProvider.findFirst({
        where: {
          organizationId,
          isActive: true,
        },
      });

      // Process group mappings with enhanced logic
      const groupResult = await this.processGroupMappings(
        profile,
        ssoProvider,
        organizationId
      );

      // Ensure user is member of organization with proper role
      await this.ensureOrganizationMembership(
        user.id,
        organizationId,
        groupResult.organizationRole
      );

      // Handle team memberships
      await this.syncTeamMemberships(user.id, groupResult.teamMemberships);

      // Log successful provisioning
      await this.logSSOAudit({
        userId: user.id,
        email: profile.email,
        provider: profile.provider,
        action: isNewUser ? 'provision' : 'update',
        details: {
          isNewUser,
          wasUpdated,
          syncedAttributes,
          organizationRole: groupResult.organizationRole,
          teamMemberships: groupResult.teamMemberships.length,
        },
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });

      return {
        user,
        isNewUser,
        wasUpdated,
        organizationRole: groupResult.organizationRole,
        teamMemberships: groupResult.teamMemberships,
        conflicts,
        syncedAttributes,
      };

    } catch (error) {
      // Log error
      await this.logSSOAudit({
        email: profile.email,
        provider: profile.provider,
        action: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  private static async checkDomainAccess(
    email: string,
    organizationId: string
  ): Promise<{ allowed: boolean; reason?: string; policy?: DomainPolicy }> {
    const domain = email.split('@')[1];
    
    // Get organization's domain policies
    const ssoProvider = await prisma.sSOProvider.findFirst({
      where: {
        organizationId,
        isActive: true,
      },
    });

    if (!ssoProvider?.domainRestriction?.length) {
      return { allowed: true };
    }

    // Check if domain is explicitly allowed
    const allowedDomains = ssoProvider.domainRestriction;
    const isAllowed = allowedDomains.some(allowedDomain => {
      if (allowedDomain === domain) return true;
      // Check subdomain support if configured
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.substring(2);
        return domain.endsWith(baseDomain);
      }
      return false;
    });

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Domain ${domain} is not authorized for this organization`,
      };
    }

    return { allowed: true };
  }

  private static async createUserFromSSO(
    profile: SSOUserProfile,
    organizationId: string
  ): Promise<any> {
    const userData = {
      email: profile.email,
      name: profile.displayName || 
        `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 
        profile.email,
      lastLoginAt: new Date(),
      password: 'sso-user', // Dummy password for SSO users
    };

    return prisma.user.create({
      data: userData,
      include: {
        ssoProfiles: true,
      },
    });
  }

  private static async updateUserFromSSO(
    user: any,
    profile: SSOUserProfile
  ): Promise<{ wasUpdated: boolean; conflicts: string[]; syncedAttributes: string[] }> {
    const conflicts: string[] = [];
    const syncedAttributes: string[] = [];
    const updates: any = {};

    // Check for name conflicts and sync
    const newName = profile.displayName || 
      `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    
    if (newName && newName !== profile.email) {
      if (user.name && user.name !== newName) {
        conflicts.push(`Name conflict: existing "${user.name}" vs SSO "${newName}"`);
      }
      updates.name = newName;
      syncedAttributes.push('name');
    }

    const wasUpdated = Object.keys(updates).length > 0;

    if (wasUpdated) {
      await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
    }

    return { wasUpdated, conflicts, syncedAttributes };
  }

  private static async upsertSSOProfile(userId: string, profile: SSOUserProfile): Promise<void> {
    const ssoProfileData = {
      userId,
      provider: profile.provider,
      providerId: profile.providerId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName,
      department: profile.department,
      jobTitle: profile.jobTitle,
      phoneNumber: profile.phoneNumber,
      managerId: profile.managerId,
      customAttributes: profile.customAttributes || {},
      groups: profile.groups || [],
      lastSyncAt: new Date(),
    };

    await prisma.sSOProfile.upsert({
      where: {
        userId_provider: {
          userId,
          provider: profile.provider,
        },
      },
      update: ssoProfileData,
      create: ssoProfileData,
    });
  }

  private static async processGroupMappings(
    profile: SSOUserProfile,
    ssoProvider: any,
    organizationId: string
  ): Promise<{
    organizationRole: 'owner' | 'admin' | 'member';
    teamMemberships: Array<{ teamId: string; role: 'admin' | 'member' }>;
  }> {
    let organizationRole: 'owner' | 'admin' | 'member' = 'member';
    let teamMemberships: Array<{ teamId: string; role: 'admin' | 'member' }> = [];

    if (!ssoProvider?.groupMappings || !profile.groups) {
      return { organizationRole, teamMemberships };
    }

    const groupMappings = ssoProvider.groupMappings as any as GroupMapping[];
    
    // Sort by priority (higher priority first)
    const sortedMappings = groupMappings.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const group of profile.groups) {
      for (const mapping of sortedMappings) {
        if (this.matchesGroupMapping(group, mapping, profile)) {
          // Set highest organization role
          if (this.getRolePriority(mapping.organizationRole) > this.getRolePriority(organizationRole)) {
            organizationRole = mapping.organizationRole;
          }

          // Collect team memberships
          if (mapping.teamMappings) {
            teamMemberships.push(...mapping.teamMappings);
          }
        }
      }
    }

    // Remove duplicate team memberships and keep highest role
    const uniqueTeamMemberships = this.consolidateTeamMemberships(teamMemberships);

    return { organizationRole, teamMemberships: uniqueTeamMemberships };
  }

  private static matchesGroupMapping(
    userGroup: string,
    mapping: GroupMapping,
    profile: SSOUserProfile
  ): boolean {
    // Check direct group match
    if (mapping.ssoGroup === userGroup) {
      return this.matchesConditions(mapping, profile);
    }

    // Check nested groups
    if (mapping.nestedGroups?.includes(userGroup)) {
      return this.matchesConditions(mapping, profile);
    }

    return false;
  }

  private static matchesConditions(mapping: GroupMapping, profile: SSOUserProfile): boolean {
    if (!mapping.conditions) return true;

    // Check department condition
    if (mapping.conditions.department && profile.department) {
      if (!mapping.conditions.department.includes(profile.department)) {
        return false;
      }
    }

    // Check job title condition
    if (mapping.conditions.jobTitle && profile.jobTitle) {
      if (!mapping.conditions.jobTitle.includes(profile.jobTitle)) {
        return false;
      }
    }

    // Check custom attribute condition
    if (mapping.conditions.customAttribute && profile.customAttributes) {
      const { key, value } = mapping.conditions.customAttribute;
      const userValue = profile.customAttributes[key];
      
      if (!userValue) return false;
      
      if (Array.isArray(value)) {
        if (!value.includes(userValue)) return false;
      } else {
        if (userValue !== value) return false;
      }
    }

    return true;
  }

  private static consolidateTeamMemberships(
    memberships: Array<{ teamId: string; role: 'admin' | 'member' }>
  ): Array<{ teamId: string; role: 'admin' | 'member' }> {
    const consolidated = new Map<string, 'admin' | 'member'>();

    for (const membership of memberships) {
      const currentRole = consolidated.get(membership.teamId);
      if (!currentRole || membership.role === 'admin') {
        consolidated.set(membership.teamId, membership.role);
      }
    }

    return Array.from(consolidated.entries()).map(([teamId, role]) => ({ teamId, role }));
  }

  private static async ensureOrganizationMembership(
    userId: string,
    organizationId: string,
    role: 'owner' | 'admin' | 'member'
  ): Promise<void> {
    const existingMembership = await prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!existingMembership) {
      await prisma.organizationMember.create({
        data: {
          userId,
          organizationId,
          role,
        },
      });
    } else if (existingMembership.role !== role) {
      await prisma.organizationMember.update({
        where: { id: existingMembership.id },
        data: { role },
      });
    }
  }

  private static async syncTeamMemberships(
    userId: string,
    teamMemberships: Array<{ teamId: string; role: 'admin' | 'member' }>
  ): Promise<void> {
    for (const teamMembership of teamMemberships) {
      const existingTeamMembership = await prisma.teamMember.findFirst({
        where: {
          userId,
          teamId: teamMembership.teamId,
        },
      });

      if (!existingTeamMembership) {
        await prisma.teamMember.create({
          data: {
            userId,
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
  }

  private static async logSSOAudit(event: SSOAuditEvent): Promise<void> {
    try {
      await prisma.sSOAuditLog.create({
        data: {
          userId: event.userId,
          email: event.email,
          provider: event.provider,
          action: event.action,
          details: event.details || {},
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          timestamp: event.timestamp,
        },
      });
    } catch (error) {
      console.error('Failed to log SSO audit event:', error);
    }
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

  // User synchronization and bulk operations
  static async syncAllUsersFromSSO(organizationId: string): Promise<{
    processed: number;
    updated: number;
    errors: Array<{ email: string; error: string }>;
  }> {
    const results = {
      processed: 0,
      updated: 0,
      errors: [] as Array<{ email: string; error: string }>,
    };

    try {
      // Get all SSO profiles for organization
      const ssoProfiles = await prisma.sSOProfile.findMany({
        where: {
          user: {
            organizations: {
              some: { organizationId },
            },
          },
        },
        include: {
          user: true,
        },
      });

      for (const ssoProfile of ssoProfiles) {
        try {
          results.processed++;
          
          // Create profile from stored SSO data
          const profile: SSOUserProfile = {
            email: ssoProfile.email,
            firstName: ssoProfile.firstName || undefined,
            lastName: ssoProfile.lastName || undefined,
            displayName: ssoProfile.displayName || undefined,
            groups: ssoProfile.groups as string[],
            provider: ssoProfile.provider,
            providerId: ssoProfile.providerId,
            department: ssoProfile.department || undefined,
            jobTitle: ssoProfile.jobTitle || undefined,
            phoneNumber: ssoProfile.phoneNumber || undefined,
            managerId: ssoProfile.managerId || undefined,
            customAttributes: ssoProfile.customAttributes as Record<string, any>,
            lastSSOSync: new Date(),
          };

          const result = await this.processUserFromSSO(profile, organizationId);
          if (result.wasUpdated) {
            results.updated++;
          }
        } catch (error) {
          results.errors.push({
            email: ssoProfile.email,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to sync users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getUserProvisioningHistory(
    organizationId: string,
    days: number = 30
  ): Promise<{
    totalLogins: number;
    newUsers: number;
    updatedUsers: number;
    deniedAccess: number;
    errorEvents: number;
    dailyStats: Array<{
      date: string;
      logins: number;
      provisions: number;
      errors: number;
    }>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const auditLogs = await prisma.sSOAuditLog.findMany({
      where: {
        timestamp: { gte: since },
        user: {
          organizations: {
            some: { organizationId },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    const stats = {
      totalLogins: 0,
      newUsers: 0,
      updatedUsers: 0,
      deniedAccess: 0,
      errorEvents: 0,
      dailyStats: [] as Array<{ date: string; logins: number; provisions: number; errors: number }>,
    };

    // Aggregate statistics
    const dailyMap = new Map<string, { logins: number; provisions: number; errors: number }>();

    for (const log of auditLogs) {
      const dateKey = log.timestamp.toISOString().split('T')[0];
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { logins: 0, provisions: 0, errors: 0 });
      }
      
      const dailyStat = dailyMap.get(dateKey)!;

      switch (log.action) {
        case 'login':
          stats.totalLogins++;
          dailyStat.logins++;
          break;
        case 'provision':
          stats.newUsers++;
          dailyStat.provisions++;
          break;
        case 'update':
          stats.updatedUsers++;
          break;
        case 'denied':
          stats.deniedAccess++;
          break;
        case 'error':
          stats.errorEvents++;
          dailyStat.errors++;
          break;
      }
    }

    // Convert daily map to array
    stats.dailyStats = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  }

  static async getDomainInsights(organizationId: string): Promise<{
    authorizedDomains: string[];
    usersByDomain: Array<{ domain: string; userCount: number; lastLogin?: Date }>;
    topProviders: Array<{ provider: string; userCount: number }>;
  }> {
    const [ssoProvider, users] = await Promise.all([
      prisma.sSOProvider.findFirst({
        where: { organizationId, isActive: true },
      }),
      prisma.user.findMany({
        where: {
          organizations: {
            some: { organizationId },
          },
          ssoProfiles: {
            some: {},
          },
        },
        include: {
          ssoProfiles: true,
        },
      }),
    ]);

    const authorizedDomains = ssoProvider?.domainRestriction || [];
    
    // Group users by domain
    const domainMap = new Map<string, { userCount: number; lastLogin?: Date }>();
    const providerMap = new Map<string, number>();

    for (const user of users) {
      const domain = user.email.split('@')[1];
      
      if (!domainMap.has(domain)) {
        domainMap.set(domain, { userCount: 0 });
      }
      
      const domainData = domainMap.get(domain)!;
      domainData.userCount++;
      
      if (user.lastLoginAt) {
        if (!domainData.lastLogin || user.lastLoginAt > domainData.lastLogin) {
          domainData.lastLogin = user.lastLoginAt;
        }
      }

      // Count providers
      for (const profile of user.ssoProfiles) {
        const count = providerMap.get(profile.provider) || 0;
        providerMap.set(profile.provider, count + 1);
      }
    }

    const usersByDomain = Array.from(domainMap.entries())
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.userCount - a.userCount);

    const topProviders = Array.from(providerMap.entries())
      .map(([provider, userCount]) => ({ provider, userCount }))
      .sort((a, b) => b.userCount - a.userCount);

    return {
      authorizedDomains,
      usersByDomain,
      topProviders,
    };
  }

  static async removeUserFromSSO(
    userId: string,
    organizationId: string,
    options: {
      removeFromOrganization?: boolean;
      removeFromTeams?: boolean;
      preserveAuditLogs?: boolean;
    } = {}
  ): Promise<void> {
    const { removeFromOrganization = false, removeFromTeams = false, preserveAuditLogs = true } = options;

    try {
      if (removeFromOrganization) {
        await prisma.organizationMember.deleteMany({
          where: { userId, organizationId },
        });
      }

      if (removeFromTeams) {
        // Get teams in this organization and remove user from them
        const teams = await prisma.team.findMany({
          where: { organizationId },
          select: { id: true },
        });

        await prisma.teamMember.deleteMany({
          where: {
            userId,
            teamId: { in: teams.map(t => t.id) },
          },
        });
      }

      // Remove SSO profiles
      await prisma.sSOProfile.deleteMany({
        where: { userId },
      });

      // Optionally remove audit logs
      if (!preserveAuditLogs) {
        await prisma.sSOAuditLog.deleteMany({
          where: { userId },
        });
      }

    } catch (error) {
      throw new Error(`Failed to remove user from SSO: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}