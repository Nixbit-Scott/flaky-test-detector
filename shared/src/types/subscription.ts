export type SubscriptionPlan = 'starter' | 'team' | 'enterprise';

export interface PlanLimits {
  maxProjects: number;
  maxMembers: number;
  maxTeams: number;
  maxRepositories: number;
  dataRetentionDays: number;
  features: PlanFeature[];
}

export type PlanFeature = 
  // Detection Features
  | 'ai_detection_basic'
  | 'ai_detection_advanced'
  | 'pattern_recognition'
  | 'statistical_analysis'
  | 'confidence_scoring'
  
  // Automation Features
  | 'retry_logic_basic'
  | 'retry_logic_intelligent'
  | 'auto_quarantine'
  | 'custom_retry_policies'
  | 'quarantine_management'
  
  // Analytics Features
  | 'basic_analytics'
  | 'realtime_analytics'
  | 'historical_trends'
  | 'time_savings_calculator'
  | 'advanced_reporting'
  | 'custom_dashboards'
  
  // Integration Features
  | 'basic_integrations'
  | 'advanced_integrations'
  | 'slack_teams_notifications'
  | 'webhook_support'
  | 'sso_saml'
  | 'api_access'
  
  // Support Features
  | 'email_support'
  | 'priority_support'
  | 'dedicated_support'
  | 'custom_training'
  | 'sla_guarantees'
  
  // Team Management
  | 'basic_team_management'
  | 'advanced_team_management'
  | 'role_based_access'
  | 'audit_logs'
  | 'user_permissions';

export interface SubscriptionPlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: number; // in cents per month
  description: string;
  isPopular: boolean;
  limits: PlanLimits;
  features: {
    detection: PlanFeature[];
    automation: PlanFeature[];
    analytics: PlanFeature[];
    integrations: PlanFeature[];
    support: PlanFeature[];
  };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanDetails> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 2900, // $29/month
    description: 'Perfect for small teams getting started',
    isPopular: false,
    limits: {
      maxProjects: 5,
      maxMembers: 5,
      maxTeams: 2,
      maxRepositories: 1,
      dataRetentionDays: 90,
      features: [
        'ai_detection_basic',
        'retry_logic_basic',
        'basic_analytics',
        'basic_integrations',
        'email_support',
        'basic_team_management',
        'time_savings_calculator'
      ]
    },
    features: {
      detection: ['ai_detection_basic'],
      automation: ['retry_logic_basic'],
      analytics: ['basic_analytics', 'time_savings_calculator'],
      integrations: ['basic_integrations'],
      support: ['email_support', 'basic_team_management']
    }
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 9900, // $99/month
    description: 'Best for growing development teams',
    isPopular: true,
    limits: {
      maxProjects: 25,
      maxMembers: 25,
      maxTeams: 10,
      maxRepositories: 999,
      dataRetentionDays: 365,
      features: [
        'ai_detection_basic',
        'ai_detection_advanced',
        'pattern_recognition',
        'statistical_analysis',
        'retry_logic_basic',
        'retry_logic_intelligent',
        'auto_quarantine',
        'custom_retry_policies',
        'basic_analytics',
        'realtime_analytics',
        'historical_trends',
        'time_savings_calculator',
        'advanced_reporting',
        'basic_integrations',
        'advanced_integrations',
        'slack_teams_notifications',
        'webhook_support',
        'api_access',
        'email_support',
        'priority_support',
        'basic_team_management',
        'advanced_team_management',
        'role_based_access'
      ]
    },
    features: {
      detection: ['ai_detection_basic', 'ai_detection_advanced', 'pattern_recognition', 'statistical_analysis'],
      automation: ['retry_logic_basic', 'retry_logic_intelligent', 'auto_quarantine', 'custom_retry_policies'],
      analytics: ['basic_analytics', 'realtime_analytics', 'historical_trends', 'time_savings_calculator', 'advanced_reporting'],
      integrations: ['basic_integrations', 'advanced_integrations', 'slack_teams_notifications', 'webhook_support', 'api_access'],
      support: ['email_support', 'priority_support', 'basic_team_management', 'advanced_team_management', 'role_based_access']
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 29900, // $299/month
    description: 'For large organizations with custom needs',
    isPopular: false,
    limits: {
      maxProjects: 999,
      maxMembers: 999,
      maxTeams: 50,
      maxRepositories: 999,
      dataRetentionDays: 1095, // 3 years
      features: [
        'ai_detection_basic',
        'ai_detection_advanced',
        'pattern_recognition',
        'statistical_analysis',
        'confidence_scoring',
        'retry_logic_basic',
        'retry_logic_intelligent',
        'auto_quarantine',
        'custom_retry_policies',
        'quarantine_management',
        'basic_analytics',
        'realtime_analytics',
        'historical_trends',
        'time_savings_calculator',
        'advanced_reporting',
        'custom_dashboards',
        'basic_integrations',
        'advanced_integrations',
        'slack_teams_notifications',
        'webhook_support',
        'sso_saml',
        'api_access',
        'email_support',
        'priority_support',
        'dedicated_support',
        'custom_training',
        'sla_guarantees',
        'basic_team_management',
        'advanced_team_management',
        'role_based_access',
        'audit_logs',
        'user_permissions'
      ]
    },
    features: {
      detection: ['ai_detection_basic', 'ai_detection_advanced', 'pattern_recognition', 'statistical_analysis', 'confidence_scoring'],
      automation: ['retry_logic_basic', 'retry_logic_intelligent', 'auto_quarantine', 'custom_retry_policies', 'quarantine_management'],
      analytics: ['basic_analytics', 'realtime_analytics', 'historical_trends', 'time_savings_calculator', 'advanced_reporting', 'custom_dashboards'],
      integrations: ['basic_integrations', 'advanced_integrations', 'slack_teams_notifications', 'webhook_support', 'sso_saml', 'api_access'],
      support: ['email_support', 'priority_support', 'dedicated_support', 'custom_training', 'sla_guarantees', 'basic_team_management', 'advanced_team_management', 'role_based_access', 'audit_logs', 'user_permissions']
    }
  }
};

export interface OrganizationUsage {
  plan: SubscriptionPlan;
  limits: PlanLimits;
  usage: {
    members: number;
    teams: number;
    projects: number;
    repositories: number;
  };
  percentages: {
    members: number;
    teams: number;
    projects: number;
    repositories: number;
  };
  subscriptionStatus: 'active' | 'cancelled' | 'past_due' | 'trialing';
  isActive: boolean;
  upgradeAvailable: boolean;
  nextPlan?: SubscriptionPlan;
}

export interface FeatureAccessResult {
  hasAccess: boolean;
  feature: PlanFeature;
  currentPlan: SubscriptionPlan;
  requiredPlan?: SubscriptionPlan;
  upgradeRequired: boolean;
}

// Helper functions
export function getPlanDetails(plan: SubscriptionPlan): SubscriptionPlanDetails {
  return SUBSCRIPTION_PLANS[plan];
}

export function hasFeatureAccess(plan: SubscriptionPlan, feature: PlanFeature): boolean {
  const planDetails = getPlanDetails(plan);
  return planDetails.limits.features.includes(feature);
}

export function getFeatureAccessResult(plan: SubscriptionPlan, feature: PlanFeature): FeatureAccessResult {
  const hasAccess = hasFeatureAccess(plan, feature);
  
  if (hasAccess) {
    return {
      hasAccess: true,
      feature,
      currentPlan: plan,
      upgradeRequired: false
    };
  }

  // Find the minimum required plan for this feature
  let requiredPlan: SubscriptionPlan | undefined;
  for (const [planId, planDetails] of Object.entries(SUBSCRIPTION_PLANS)) {
    if (planDetails.limits.features.includes(feature)) {
      requiredPlan = planId as SubscriptionPlan;
      break;
    }
  }

  return {
    hasAccess: false,
    feature,
    currentPlan: plan,
    requiredPlan,
    upgradeRequired: true
  };
}

export function getNextPlan(currentPlan: SubscriptionPlan): SubscriptionPlan | null {
  switch (currentPlan) {
    case 'starter':
      return 'team';
    case 'team':
      return 'enterprise';
    case 'enterprise':
      return null;
    default:
      return null;
  }
}

export function canUpgrade(currentPlan: SubscriptionPlan): boolean {
  return getNextPlan(currentPlan) !== null;
}