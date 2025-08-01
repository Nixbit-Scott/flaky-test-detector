-- Performance Optimization Migration for Nixbit
-- This migration adds critical indexes for high-performance queries

-- Test Results Performance Indexes
-- Critical for webhook processing and analytics queries
CREATE INDEX IF NOT EXISTS "idx_test_results_project_timestamp" ON "test_results" ("projectId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_test_results_test_name_status" ON "test_results" ("testName", "status");
CREATE INDEX IF NOT EXISTS "idx_test_results_test_suite_status" ON "test_results" ("testSuite", "status") WHERE "testSuite" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_test_results_status_timestamp" ON "test_results" ("status", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_test_results_duration" ON "test_results" ("duration") WHERE "duration" IS NOT NULL;

-- Flaky Test Pattern Performance Indexes
-- Critical for quarantine automation and AI analysis
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_project_active" ON "flaky_test_patterns" ("projectId", "isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_quarantined" ON "flaky_test_patterns" ("isQuarantined", "projectId");
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_failure_rate" ON "flaky_test_patterns" ("failureRate" DESC, "confidence" DESC);
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_last_seen" ON "flaky_test_patterns" ("lastSeen" DESC);
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_test_name_suite" ON "flaky_test_patterns" ("testName", "testSuite");
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_total_runs" ON "flaky_test_patterns" ("totalRuns" DESC);

-- Test Runs Performance Indexes
-- Critical for CI/CD integration and build analytics
CREATE INDEX IF NOT EXISTS "idx_test_runs_project_started" ON "test_runs" ("projectId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_test_runs_branch_status" ON "test_runs" ("branch", "status");
CREATE INDEX IF NOT EXISTS "idx_test_runs_commit" ON "test_runs" ("commit");
CREATE INDEX IF NOT EXISTS "idx_test_runs_build_id" ON "test_runs" ("buildId") WHERE "buildId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_test_runs_completion" ON "test_runs" ("completedAt" DESC) WHERE "completedAt" IS NOT NULL;

-- Quarantine History Performance Indexes
-- Critical for quarantine analytics and audit trails
CREATE INDEX IF NOT EXISTS "idx_quarantine_history_pattern_action" ON "quarantine_history" ("flakyTestPatternId", "action");
CREATE INDEX IF NOT EXISTS "idx_quarantine_history_created_at" ON "quarantine_history" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_quarantine_history_triggered_by" ON "quarantine_history" ("triggeredBy");
CREATE INDEX IF NOT EXISTS "idx_quarantine_history_confidence" ON "quarantine_history" ("confidence" DESC) WHERE "confidence" IS NOT NULL;

-- Quarantine Impact Performance Indexes
-- Critical for impact calculation and ROI analytics
CREATE INDEX IF NOT EXISTS "idx_quarantine_impact_project_period" ON "quarantine_impacts" ("projectId", "periodStart" DESC);
CREATE INDEX IF NOT EXISTS "idx_quarantine_impact_pattern_active" ON "quarantine_impacts" ("flakyTestPatternId", "periodEnd") WHERE "periodEnd" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_quarantine_impact_builds_blocked" ON "quarantine_impacts" ("buildsBlocked" DESC);
CREATE INDEX IF NOT EXISTS "idx_quarantine_impact_ci_time" ON "quarantine_impacts" ("ciTimeWasted" DESC);

-- Environmental Context Performance Indexes
-- Critical for AI analysis and pattern recognition
CREATE INDEX IF NOT EXISTS "idx_environmental_context_execution_time" ON "environmental_contexts" ("executionTime" DESC);
CREATE INDEX IF NOT EXISTS "idx_environmental_context_ci_runner" ON "environmental_contexts" ("ciRunner");
CREATE INDEX IF NOT EXISTS "idx_environmental_context_time_patterns" ON "environmental_contexts" ("timeOfDay", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "idx_environmental_context_resource_usage" ON "environmental_contexts" ("cpuUsage", "memoryUsage") WHERE "cpuUsage" IS NOT NULL AND "memoryUsage" IS NOT NULL;

-- Root Cause Analysis Performance Indexes
-- Critical for AI-powered diagnostics
CREATE INDEX IF NOT EXISTS "idx_root_cause_analysis_pattern" ON "root_cause_analyses" ("flakyTestPatternId", "confidence" DESC);
CREATE INDEX IF NOT EXISTS "idx_root_cause_analysis_category" ON "root_cause_analyses" ("primaryCategory", "confidence" DESC);
CREATE INDEX IF NOT EXISTS "idx_root_cause_analysis_model_version" ON "root_cause_analyses" ("modelVersion", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_root_cause_analysis_similar_issues" ON "root_cause_analyses" ("similarIssuesCount" DESC);

-- Predictive Analysis Performance Indexes
-- Critical for ML predictions and risk scoring
CREATE INDEX IF NOT EXISTS "idx_predictive_analysis_project_risk" ON "predictive_analyses" ("projectId", "riskScore" DESC);
CREATE INDEX IF NOT EXISTS "idx_predictive_analysis_risk_level" ON "predictive_analyses" ("riskLevel", "confidence" DESC);
CREATE INDEX IF NOT EXISTS "idx_predictive_analysis_file_path" ON "predictive_analyses" ("testFilePath");
CREATE INDEX IF NOT EXISTS "idx_predictive_analysis_model_version" ON "predictive_analyses" ("modelVersion", "analysisDate" DESC);

-- Static Code Features Performance Indexes
-- Critical for code complexity analysis
CREATE INDEX IF NOT EXISTS "idx_static_code_features_complexity" ON "static_code_features" ("cyclomaticComplexity" DESC, "cognitiveComplexity" DESC);
CREATE INDEX IF NOT EXISTS "idx_static_code_features_async_patterns" ON "static_code_features" ("asyncAwaitCount" DESC, "promiseChainCount" DESC);
CREATE INDEX IF NOT EXISTS "idx_static_code_features_timing_risk" ON "static_code_features" ("timingSensitivity" DESC, "raceConditionPatterns" DESC);

-- System Metrics Performance Indexes
-- Critical for monitoring and alerting
CREATE INDEX IF NOT EXISTS "idx_system_metrics_name_timestamp" ON "system_metrics" ("metricName", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_system_metrics_type_timestamp" ON "system_metrics" ("metricType", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_system_metrics_value" ON "system_metrics" ("value" DESC) WHERE "value" IS NOT NULL;

-- Organization and Team Performance Indexes
-- Critical for multi-tenant queries
CREATE INDEX IF NOT EXISTS "idx_projects_user_team" ON "projects" ("userId", "teamId");
CREATE INDEX IF NOT EXISTS "idx_projects_team_active" ON "projects" ("teamId") WHERE "teamId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_organization_members_user" ON "organization_members" ("userId", "role");
CREATE INDEX IF NOT EXISTS "idx_team_members_team_role" ON "team_members" ("teamId", "role");

-- API Keys Performance Indexes
-- Critical for API authentication
CREATE INDEX IF NOT EXISTS "idx_api_keys_last_used" ON "api_keys" ("lastUsed" DESC) WHERE "lastUsed" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_api_keys_user_active" ON "api_keys" ("userId") WHERE "expiresAt" IS NULL OR "expiresAt" > NOW();

-- Admin and Monitoring Indexes
-- Critical for admin dashboard performance
CREATE INDEX IF NOT EXISTS "idx_admin_audit_logs_user_created" ON "admin_audit_logs" ("userId", "createdAt" DESC) WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_monitoring_logs_type_timestamp" ON "monitoring_logs" ("type", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_monitoring_logs_level_timestamp" ON "monitoring_logs" ("level", "timestamp" DESC);

-- Composite Indexes for Complex Analytics Queries
-- Critical for dashboard and reporting performance
CREATE INDEX IF NOT EXISTS "idx_test_results_analytics" ON "test_results" ("projectId", "status", "timestamp" DESC, "duration");
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_analytics" ON "flaky_test_patterns" ("projectId", "isActive", "failureRate" DESC, "totalRuns" DESC);
CREATE INDEX IF NOT EXISTS "idx_quarantine_history_analytics" ON "quarantine_history" ("flakyTestPatternId", "action", "createdAt" DESC, "confidence");

-- Partial Indexes for Common Filters
-- Optimized for specific query patterns
CREATE INDEX IF NOT EXISTS "idx_test_results_failed_recent" ON "test_results" ("projectId", "timestamp" DESC) WHERE "status" = 'failed';
CREATE INDEX IF NOT EXISTS "idx_flaky_patterns_high_risk" ON "flaky_test_patterns" ("projectId", "failureRate" DESC) WHERE "failureRate" > 0.3 AND "isActive" = true;
CREATE INDEX IF NOT EXISTS "idx_quarantine_impacts_active" ON "quarantine_impacts" ("projectId", "periodStart" DESC) WHERE "periodEnd" IS NULL;

-- Add table statistics update for better query planning
ANALYZE "test_results";
ANALYZE "flaky_test_patterns";
ANALYZE "test_runs";
ANALYZE "quarantine_history";
ANALYZE "quarantine_impacts";
ANALYZE "environmental_contexts";
ANALYZE "root_cause_analyses";
ANALYZE "predictive_analyses";
ANALYZE "static_code_features";

-- Add performance-related configuration
-- Enable auto-vacuum and statistics collection for performance-critical tables
ALTER TABLE "test_results" SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE "flaky_test_patterns" SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE "quarantine_history" SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE "system_metrics" SET (autovacuum_vacuum_scale_factor = 0.05);

-- Create partial unique indexes for better constraint performance
CREATE UNIQUE INDEX IF NOT EXISTS "idx_flaky_patterns_unique_active" ON "flaky_test_patterns" ("projectId", "testName", "testSuite") WHERE "isActive" = true;

-- Performance monitoring views (optional - can be created separately)
-- These views help monitor query performance and index usage

-- View for slow queries monitoring
CREATE OR REPLACE VIEW "performance_slow_queries" AS
SELECT 
    query,
    calls,
    total_time,
    total_time/calls as mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE total_time > 1000 -- queries taking more than 1 second total
ORDER BY total_time DESC;

-- View for index usage monitoring
CREATE OR REPLACE VIEW "performance_index_usage" AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Comments for documentation
COMMENT ON INDEX "idx_test_results_project_timestamp" IS 'Optimizes webhook processing and analytics queries by project and time';
COMMENT ON INDEX "idx_flaky_patterns_project_active" IS 'Optimizes quarantine automation queries for active flaky tests';
COMMENT ON INDEX "idx_quarantine_history_pattern_action" IS 'Optimizes quarantine analytics and audit queries';
COMMENT ON INDEX "idx_predictive_analysis_project_risk" IS 'Optimizes ML prediction queries by risk score';
COMMENT ON INDEX "idx_system_metrics_name_timestamp" IS 'Optimizes monitoring dashboard queries';