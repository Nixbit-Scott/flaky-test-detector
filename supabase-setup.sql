-- ============================================================================
-- Nixbit Flaky Test Detector - Complete Supabase Database Schema
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS AND AUTHENTICATION
-- ============================================================================

-- Users table (integrates with Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system_admin BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    domain TEXT,
    plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'team', 'enterprise')),
    billing_email TEXT NOT NULL,
    max_projects INTEGER DEFAULT 5,
    max_members INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    
    -- Billing information
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- ============================================================================
-- PROJECTS AND TEST MANAGEMENT
-- ============================================================================

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT,
    branch TEXT DEFAULT 'main',
    
    -- User/Organization relationships
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Project settings
    is_active BOOLEAN DEFAULT true,
    retry_enabled BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 30, -- seconds
    flaky_threshold DECIMAL(3,2) DEFAULT 0.30,
    
    -- CI/CD Integration
    ci_provider TEXT, -- 'github', 'gitlab', 'jenkins', etc.
    webhook_secret TEXT,
    api_key_hash TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test runs (CI/CD executions)
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Run metadata
    branch TEXT,
    commit_sha TEXT,
    commit_message TEXT,
    trigger_type TEXT, -- 'push', 'pull_request', 'manual', 'scheduled'
    ci_run_id TEXT, -- External CI system run ID
    
    -- Results
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failure', 'cancelled')),
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    duration_ms INTEGER,
    
    -- Environment
    ci_provider TEXT,
    ci_runner TEXT,
    environment TEXT DEFAULT 'test',
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual test results
CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Test identification
    test_name TEXT NOT NULL,
    test_suite TEXT,
    test_file TEXT,
    test_class TEXT,
    
    -- Result data
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
    duration_ms INTEGER,
    error_message TEXT,
    stack_trace TEXT,
    
    -- Retry information
    attempt_number INTEGER DEFAULT 1,
    is_retry BOOLEAN DEFAULT false,
    retry_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- FLAKY TEST DETECTION AND ANALYSIS
-- ============================================================================

-- Flaky test patterns (detected flaky tests)
CREATE TABLE IF NOT EXISTS flaky_test_patterns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Test identification
    test_name TEXT NOT NULL,
    test_suite TEXT,
    test_file TEXT,
    
    -- Flaky statistics
    total_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    failure_rate DECIMAL(5,4) DEFAULT 0.0000,
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    is_quarantined BOOLEAN DEFAULT false,
    detection_method TEXT, -- 'statistical', 'pattern', 'manual'
    first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id, test_name, test_suite)
);

-- AI Analysis results
CREATE TABLE IF NOT EXISTS ai_analysis (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    flaky_test_pattern_id TEXT NOT NULL REFERENCES flaky_test_patterns(id) ON DELETE CASCADE,
    test_result_id TEXT REFERENCES test_results(id) ON DELETE CASCADE,
    
    -- AI Analysis Results
    primary_category TEXT NOT NULL,
    secondary_categories TEXT[], -- Array of strings
    confidence DECIMAL(5,4) NOT NULL,
    
    -- Failure Analysis
    error_pattern TEXT,
    stack_trace_signature TEXT,
    timing_issues TEXT[],
    environment_factors TEXT[],
    
    -- Recommendations (stored as JSONB for flexibility)
    recommendations JSONB,
    estimated_fix_effort TEXT CHECK (estimated_fix_effort IN ('low', 'medium', 'high')),
    similar_issues_count INTEGER DEFAULT 0,
    
    -- Enhanced Analysis
    enhanced JSONB, -- For advanced AI features
    historical_pattern JSONB, -- Trend analysis
    cross_test_patterns JSONB, -- Related test patterns
    
    -- Metadata
    model_version TEXT NOT NULL,
    processing_time INTEGER, -- milliseconds
    data_quality DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- QUARANTINE SYSTEM
-- ============================================================================

-- Quarantine history
CREATE TABLE IF NOT EXISTS quarantine_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    flaky_test_pattern_id TEXT NOT NULL REFERENCES flaky_test_patterns(id) ON DELETE CASCADE,
    
    -- Action details
    action TEXT NOT NULL CHECK (action IN ('quarantined', 'unquarantined', 'auto_quarantined', 'auto_unquarantined')),
    reason TEXT NOT NULL,
    triggered_by TEXT, -- 'user', 'system', 'schedule'
    user_id TEXT REFERENCES users(id),
    
    -- Quarantine decision data
    decision_data JSONB, -- Store the decision logic details
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quarantine policies
CREATE TABLE IF NOT EXISTS quarantine_policies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Policy details
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    
    -- Policy configuration (stored as JSONB for flexibility)
    config JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INTEGRATIONS AND NOTIFICATIONS
-- ============================================================================

-- Integration configurations (Slack, Teams, etc.)
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Integration details
    type TEXT NOT NULL, -- 'slack', 'teams', 'email', 'webhook'
    name TEXT NOT NULL,
    config JSONB NOT NULL, -- Store integration-specific configuration
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys for CI/CD integration
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Key details
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- Store hashed version only
    permissions TEXT[] DEFAULT ARRAY['read', 'write'], -- Array of permissions
    
    -- Status and usage
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);

-- Test runs indexes
CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_created_at ON test_runs(created_at DESC);

-- Test results indexes
CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_project_id ON test_results(project_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_name ON test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);

-- Flaky patterns indexes
CREATE INDEX IF NOT EXISTS idx_flaky_patterns_project_id ON flaky_test_patterns(project_id);
CREATE INDEX IF NOT EXISTS idx_flaky_patterns_active ON flaky_test_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_flaky_patterns_quarantined ON flaky_test_patterns(is_quarantined);
CREATE INDEX IF NOT EXISTS idx_flaky_patterns_failure_rate ON flaky_test_patterns(failure_rate DESC);

-- AI Analysis indexes
CREATE INDEX IF NOT EXISTS idx_ai_analysis_pattern_id ON ai_analysis(flaky_test_pattern_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_confidence ON ai_analysis(confidence DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE flaky_test_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Projects policies
CREATE POLICY IF NOT EXISTS "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY IF NOT EXISTS "Users can create own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid()::text = user_id);

-- Test runs policies (users can access test runs for their projects)
CREATE POLICY IF NOT EXISTS "Users can view test runs for own projects" ON test_runs
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY IF NOT EXISTS "Users can create test runs for own projects" ON test_runs
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE user_id = auth.uid()::text
        )
    );

-- Test results policies
CREATE POLICY IF NOT EXISTS "Users can view test results for own projects" ON test_results
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY IF NOT EXISTS "Users can create test results for own projects" ON test_results
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE user_id = auth.uid()::text
        )
    );

-- Flaky patterns policies
CREATE POLICY IF NOT EXISTS "Users can view flaky patterns for own projects" ON flaky_test_patterns
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY IF NOT EXISTS "Users can manage flaky patterns for own projects" ON flaky_test_patterns
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects WHERE user_id = auth.uid()::text
        )
    );

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_flaky_patterns_updated_at ON flaky_test_patterns;
CREATE TRIGGER update_flaky_patterns_updated_at BEFORE UPDATE ON flaky_test_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_analysis_updated_at ON ai_analysis;
CREATE TRIGGER update_ai_analysis_updated_at BEFORE UPDATE ON ai_analysis 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA AND SETUP
-- ============================================================================

-- Create a default organization for single-user setup (optional)
-- This can be removed if not needed
-- INSERT INTO organizations (id, name, billing_email, plan) 
-- VALUES ('default-org', 'Default Organization', 'admin@example.com', 'starter')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for project summary with statistics
CREATE OR REPLACE VIEW project_summary AS
SELECT 
    p.*,
    COUNT(DISTINCT tr.id) as total_test_runs,
    COUNT(DISTINCT ftp.id) as flaky_test_count,
    COUNT(DISTINCT CASE WHEN ftp.is_quarantined THEN ftp.id END) as quarantined_test_count,
    MAX(tr.completed_at) as last_test_run
FROM projects p
LEFT JOIN test_runs tr ON p.id = tr.project_id
LEFT JOIN flaky_test_patterns ftp ON p.id = ftp.project_id AND ftp.is_active = true
GROUP BY p.id;

-- View for flaky test summary with latest analysis
CREATE OR REPLACE VIEW flaky_test_summary AS
SELECT 
    ftp.*,
    ai.primary_category,
    ai.confidence as analysis_confidence,
    ai.recommendations,
    ai.estimated_fix_effort,
    ai.created_at as analysis_created_at
FROM flaky_test_patterns ftp
LEFT JOIN ai_analysis ai ON ftp.id = ai.flaky_test_pattern_id
WHERE ftp.is_active = true;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- Create a function to verify the setup
CREATE OR REPLACE FUNCTION verify_database_setup()
RETURNS TABLE(table_name text, row_count bigint) AS $$
BEGIN
    RETURN QUERY
    SELECT 'users'::text, COUNT(*) FROM users
    UNION ALL
    SELECT 'organizations'::text, COUNT(*) FROM organizations
    UNION ALL
    SELECT 'projects'::text, COUNT(*) FROM projects
    UNION ALL
    SELECT 'test_runs'::text, COUNT(*) FROM test_runs
    UNION ALL
    SELECT 'test_results'::text, COUNT(*) FROM test_results
    UNION ALL
    SELECT 'flaky_test_patterns'::text, COUNT(*) FROM flaky_test_patterns
    UNION ALL
    SELECT 'ai_analysis'::text, COUNT(*) FROM ai_analysis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the setup
SELECT * FROM verify_database_setup();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 Nixbit Flaky Test Detector database setup completed successfully!';
    RAISE NOTICE '📊 All tables, indexes, policies, and views have been created.';
    RAISE NOTICE '🔒 Row Level Security (RLS) is enabled for data protection.';
    RAISE NOTICE '🚀 The database is ready for production use!';
END $$;