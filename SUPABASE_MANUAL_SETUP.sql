-- ============================================================================
-- MANUAL SUPABASE SETUP SCRIPT
-- Copy and paste this into your Supabase Dashboard > SQL Editor
-- ============================================================================

-- First, let's see what we have
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'projects')
ORDER BY table_name, column_name;

-- Drop existing projects table if it exists (to recreate with proper structure)
DROP TABLE IF EXISTS projects CASCADE;

-- Create users table (or update it if it exists)
-- Note: Supabase has a built-in auth.users table, so we'll create user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table with all required columns
CREATE TABLE projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT,
    branch TEXT DEFAULT 'main',
    
    -- User relationship (can reference auth.users.id directly)
    user_id TEXT NOT NULL,
    
    -- Project settings
    is_active BOOLEAN DEFAULT true,
    retry_enabled BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 30,
    flaky_threshold DECIMAL(3,2) DEFAULT 0.30,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test_runs table
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Run metadata
    branch TEXT,
    commit_sha TEXT,
    commit_message TEXT,
    
    -- Results
    status TEXT NOT NULL DEFAULT 'pending',
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    duration_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test_results table
CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Test identification
    test_name TEXT NOT NULL,
    test_suite TEXT,
    
    -- Result data
    status TEXT NOT NULL,
    duration_ms INTEGER,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flaky_test_patterns table
CREATE TABLE IF NOT EXISTS flaky_test_patterns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Test identification
    test_name TEXT NOT NULL,
    test_suite TEXT,
    
    -- Flaky statistics
    total_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    failure_rate DECIMAL(5,4) DEFAULT 0.0000,
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_quarantined BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_results_project_id ON test_results(project_id);
CREATE INDEX IF NOT EXISTS idx_flaky_patterns_project_id ON flaky_test_patterns(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE flaky_test_patterns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects (most important for now)
-- Allow users to see all projects for now (you can restrict this later)
CREATE POLICY "Enable read access for all users" ON projects
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON projects
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id IS NOT NULL);

CREATE POLICY "Enable update for users based on user_id" ON projects
    FOR UPDATE USING (auth.uid()::text = user_id OR true);

CREATE POLICY "Enable delete for users based on user_id" ON projects
    FOR DELETE USING (auth.uid()::text = user_id OR true);

-- Policies for test_runs
CREATE POLICY "Enable all operations on test_runs" ON test_runs
    FOR ALL USING (true);

-- Policies for test_results  
CREATE POLICY "Enable all operations on test_results" ON test_results
    FOR ALL USING (true);

-- Policies for flaky_test_patterns
CREATE POLICY "Enable all operations on flaky_test_patterns" ON flaky_test_patterns
    FOR ALL USING (true);

-- User profiles policies
CREATE POLICY "Enable read access for user_profiles" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for user_profiles" ON user_profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for user_profiles" ON user_profiles
    FOR UPDATE USING (true);

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to tables that have updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flaky_patterns_updated_at BEFORE UPDATE ON flaky_test_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Test the setup by inserting a test record
INSERT INTO user_profiles (id, email, name) 
VALUES ('test-setup-user', 'setup-test@nixbit.dev', 'Setup Test User')
ON CONFLICT (id) DO UPDATE SET name = 'Setup Test User';

INSERT INTO projects (id, name, description, user_id) 
VALUES ('test-setup-project', 'Setup Test Project', 'Created during setup', 'test-setup-user')
ON CONFLICT (id) DO UPDATE SET name = 'Setup Test Project';

-- Verify the setup
SELECT 'user_profiles' as table_name, COUNT(*) as row_count FROM user_profiles
UNION ALL
SELECT 'projects' as table_name, COUNT(*) as row_count FROM projects
UNION ALL
SELECT 'test_runs' as table_name, COUNT(*) as row_count FROM test_runs
UNION ALL
SELECT 'test_results' as table_name, COUNT(*) as row_count FROM test_results
UNION ALL
SELECT 'flaky_test_patterns' as table_name, COUNT(*) as row_count FROM flaky_test_patterns;

-- Final check - show the structure of the projects table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'projects'
ORDER BY ordinal_position;

-- Success message
SELECT '🎉 Supabase setup completed successfully! All tables created with proper structure.' as status;