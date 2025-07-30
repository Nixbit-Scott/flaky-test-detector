export type SubscriptionPlan = 'starter' | 'team' | 'enterprise';
export interface PlanLimits {
    maxProjects: number;
    maxMembers: number;
    maxTeams: number;
    maxRepositories: number;
    dataRetentionDays: number;
    features: PlanFeature[];
}
export type PlanFeature = 'ai_detection_basic' | 'ai_detection_advanced' | 'pattern_recognition' | 'statistical_analysis' | 'confidence_scoring' | 'retry_logic_basic' | 'retry_logic_intelligent' | 'auto_quarantine' | 'custom_retry_policies' | 'quarantine_management' | 'basic_analytics' | 'realtime_analytics' | 'historical_trends' | 'time_savings_calculator' | 'advanced_reporting' | 'custom_dashboards' | 'basic_integrations' | 'advanced_integrations' | 'slack_teams_notifications' | 'webhook_support' | 'sso_saml' | 'api_access' | 'email_support' | 'priority_support' | 'dedicated_support' | 'custom_training' | 'sla_guarantees' | 'basic_team_management' | 'advanced_team_management' | 'role_based_access' | 'audit_logs' | 'user_permissions';
export interface SubscriptionPlanDetails {
    id: SubscriptionPlan;
    name: string;
    price: number;
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
export declare const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanDetails>;
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
export declare function getPlanDetails(plan: SubscriptionPlan): SubscriptionPlanDetails;
export declare function hasFeatureAccess(plan: SubscriptionPlan, feature: PlanFeature): boolean;
export declare function getFeatureAccessResult(plan: SubscriptionPlan, feature: PlanFeature): FeatureAccessResult;
export declare function getNextPlan(currentPlan: SubscriptionPlan): SubscriptionPlan | null;
export declare function canUpgrade(currentPlan: SubscriptionPlan): boolean;
//# sourceMappingURL=subscription.d.ts.map