export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers?: string[];
  targetOrganizations?: string[];
  environment?: 'development' | 'beta' | 'production';
  conditions?: {
    minVersion?: string;
    userProperty?: string;
    userValue?: string;
  };
}

export interface FeatureFlagConfig {
  flags: FeatureFlag[];
  userId?: string;
  organizationId?: string;
  environment: 'development' | 'beta' | 'production';
  version?: string;
  userProperties?: Record<string, any>;
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private config: FeatureFlagConfig;

  constructor(config: FeatureFlagConfig) {
    this.config = config;
    this.initializeFlags(config.flags);
  }

  private initializeFlags(flags: FeatureFlag[]) {
    flags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });
  }

  isEnabled(flagKey: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      console.warn(`Feature flag '${flagKey}' not found`);
      return false;
    }

    // Check if flag is globally enabled
    if (!flag.enabled) {
      return false;
    }

    // Check environment restrictions
    if (flag.environment && flag.environment !== this.config.environment) {
      return false;
    }

    // Check target users
    if (flag.targetUsers && flag.targetUsers.length > 0) {
      if (!this.config.userId || !flag.targetUsers.includes(this.config.userId)) {
        return false;
      }
    }

    // Check target organizations
    if (flag.targetOrganizations && flag.targetOrganizations.length > 0) {
      if (!this.config.organizationId || !flag.targetOrganizations.includes(this.config.organizationId)) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions) {
      if (!this.checkConditions(flag.conditions)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(this.config.userId || 'anonymous', flagKey);
      const userBucket = hash % 100;
      return userBucket < flag.rolloutPercentage;
    }

    return true;
  }

  private checkConditions(conditions: FeatureFlag['conditions']): boolean {
    if (conditions?.minVersion && this.config.version) {
      if (this.compareVersions(this.config.version, conditions.minVersion) < 0) {
        return false;
      }
    }

    if (conditions?.userProperty && conditions?.userValue) {
      const userValue = this.config.userProperties?.[conditions.userProperty];
      if (userValue !== conditions.userValue) {
        return false;
      }
    }

    return true;
  }

  private hashUserId(userId: string, flagKey: string): number {
    const str = `${userId}:${flagKey}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    const maxLength = Math.max(v1parts.length, v2parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }

    return 0;
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getFlag(flagKey: string): FeatureFlag | undefined {
    return this.flags.get(flagKey);
  }

  updateFlag(flagKey: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(flagKey);
    if (flag) {
      this.flags.set(flagKey, { ...flag, ...updates });
    }
  }

  // Beta-specific flags
  static getBetaFlags(): FeatureFlag[] {
    return [
      {
        key: 'enhanced_analytics',
        name: 'Enhanced Analytics',
        description: 'Advanced analytics dashboard with user behavior tracking',
        enabled: true,
        rolloutPercentage: 100,
        environment: 'beta'
      },
      {
        key: 'feedback_collection',
        name: 'In-App Feedback Collection',
        description: 'Contextual feedback forms throughout the application',
        enabled: true,
        rolloutPercentage: 100,
        environment: 'beta'
      },
      {
        key: 'performance_monitoring',
        name: 'Real-time Performance Monitoring',
        description: 'Enhanced performance metrics and monitoring',
        enabled: true,
        rolloutPercentage: 100,
        environment: 'beta'
      },
      {
        key: 'bug_reporting',
        name: 'Integrated Bug Reporting',
        description: 'Built-in bug reporting with automatic environment capture',
        enabled: true,
        rolloutPercentage: 100,
        environment: 'beta'
      },
      {
        key: 'ai_insights_v2',
        name: 'AI Insights V2',
        description: 'Next generation AI-powered test insights',
        enabled: true,
        rolloutPercentage: 50, // Gradual rollout
        environment: 'beta'
      },
      {
        key: 'team_collaboration',
        name: 'Enhanced Team Collaboration',
        description: 'Advanced team collaboration features',
        enabled: true,
        rolloutPercentage: 75,
        environment: 'beta'
      },
      {
        key: 'custom_dashboards',
        name: 'Custom Dashboards',
        description: 'User-customizable dashboard layouts',
        enabled: true,
        rolloutPercentage: 25, // Limited rollout
        environment: 'beta'
      }
    ];
  }
}