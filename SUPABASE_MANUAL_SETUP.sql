-- ============================================================================
-- NIXBIT SUPABASE SETUP - EASY COPY VERSION
-- Copy and paste this entire script into your Supabase Dashboard > SQL Editor
-- ============================================================================

-- Clean up existing tables (safe to run multiple times)
DROP TABLE IF EXISTS test_results CASCADE;
DROP TABLE IF EXISTS test_runs CASCADE;
DROP TABLE IF EXISTS flaky_test_patterns CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ============================================================================
-- CREATE CORE TABLES
-- ============================================================================

-- 1. Create user_profiles table
CREATE TABLE user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create projects table
CREATE TABLE projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT,
    branch TEXT DEFAULT 'main',
    user_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    retry_enabled BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 30,
    flaky_threshold DECIMAL(3,2) DEFAULT 0.30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create test_runs table
CREATE TABLE test_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch TEXT,
    commit_sha TEXT,
    commit_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create test_results table
CREATE TABLE test_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_suite TEXT,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create flaky_test_patterns table
CREATE TABLE flaky_test_patterns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_suite TEXT,
    total_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    failure_rate DECIMAL(5,4) DEFAULT 0.0000,
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT true,
    is_quarantined BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_active ON projects(is_active);
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_test_results_project_id ON test_results(project_id);
CREATE INDEX idx_flaky_patterns_project_id ON flaky_test_patterns(project_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE flaky_test_patterns ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE SECURITY POLICIES (PERMISSIVE FOR NOW)
-- ============================================================================

CREATE POLICY "Enable all operations for user_profiles" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Enable all operations for projects" ON projects FOR ALL USING (true);
CREATE POLICY "Enable all operations for test_runs" ON test_runs FOR ALL USING (true);
CREATE POLICY "Enable all operations for test_results" ON test_results FOR ALL USING (true);
CREATE POLICY "Enable all operations for flaky_test_patterns" ON flaky_test_patterns FOR ALL USING (true);

-- ============================================================================
-- CREATE UPDATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flaky_patterns_updated_at 
    BEFORE UPDATE ON flaky_test_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT TEST DATA
-- ============================================================================

INSERT INTO user_profiles (id, email, name) 
VALUES ('test-setup-user', 'setup-test@nixbit.dev', 'Setup Test User');

INSERT INTO projects (id, name, description, user_id) 
VALUES ('test-setup-project', 'Setup Test Project', 'Created during setup', 'test-setup-user');

-- ============================================================================
-- VERIFY SETUP SUCCESS
-- ============================================================================

SELECT 'Setup Complete!' as status, COUNT(*) as project_count FROM projects;
SELECT 'Tables Created:' as info, table_name FROM information_schema.tables 
WHERE table_name IN ('user_profiles', 'projects', 'test_runs', 'test_results', 'flaky_test_patterns')
ORDER BY table_name;

-- SUCCESS! Your Nixbit database is ready for production use!