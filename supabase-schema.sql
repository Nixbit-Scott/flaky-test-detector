-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
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