-- Create marketing_signups table for beta testers and general signups
CREATE TABLE IF NOT EXISTS marketing_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  role TEXT,
  team_size TEXT,
  current_pain_points TEXT[],
  interested_features TEXT[],
  primary_usage TEXT,
  experience TEXT,
  referral_source TEXT,
  linkedin_profile TEXT,
  github_profile TEXT,
  motivation TEXT,
  expectations TEXT,
  available_time TEXT,
  communication_preference TEXT[],
  source TEXT,
  utm_parameters JSONB,
  metadata JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'provisioned', 'rejected')),
  provisioned_at TIMESTAMP WITH TIME ZONE,
  access_expires TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_marketing_signups_email ON marketing_signups(email);
CREATE INDEX idx_marketing_signups_status ON marketing_signups(status);
CREATE INDEX idx_marketing_signups_source ON marketing_signups(source);
CREATE INDEX idx_marketing_signups_created_at ON marketing_signups(created_at DESC);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at column
CREATE TRIGGER update_marketing_signups_updated_at
BEFORE UPDATE ON marketing_signups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant appropriate permissions (adjust based on your auth setup)
GRANT SELECT, INSERT, UPDATE ON marketing_signups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_signups TO service_role;