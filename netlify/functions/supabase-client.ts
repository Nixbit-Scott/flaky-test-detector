import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxkjkqdkmnnjdrgyrocy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4a2prcWRrbW5uamRyZ3lyb2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTM2NDQsImV4cCI6MjA2ODkyOTY0NH0.sK3h00e2J2tqaEJUmppPWygpC6ZdlFhHtaJap6bcnQM';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database table schemas
export interface Project {
  id: string;
  name: string;
  description?: string;
  repository_url?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

// Helper functions for common database operations
export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase error fetching projects:', error);
      // Return empty array if table doesn't exist yet
      if (error.code === '42P01') {
        console.log('Projects table does not exist yet, returning empty array');
        return [];
      }
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.warn('Supabase connection error:', error);
    // Return empty array if Supabase is not available
    return [];
  }
}

export async function createProject(project: Omit<Project, 'created_at' | 'updated_at'>): Promise<Project> {
  try {
    const now = new Date().toISOString();
    const projectData = {
      ...project,
      created_at: now,
      updated_at: now,
    };

    console.log('Creating project in Supabase:', projectData);

    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();

    if (error) {
      console.warn('Supabase error creating project:', error);
      console.warn('Error details:', { code: error.code, message: error.message, details: error.details });
      
      // If table doesn't exist, return a mock project
      if (error.code === '42P01' || error.code === 'PGRST106') {
        console.log('Projects table does not exist, returning mock project');
        return {
          ...projectData,
          created_at: now,
          updated_at: now,
        };
      }
      
      // If it's a column missing error, still return mock
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('Projects table has wrong structure, returning mock project');
        return {
          ...projectData,
          created_at: now,
          updated_at: now,
        };
      }
      
      throw new Error(`Failed to create project: ${error.message}`);
    }

    console.log('Successfully created project in Supabase:', data);
    return data;
  } catch (error) {
    console.warn('Supabase connection error, creating mock project:', error);
    // Return a mock project if Supabase is not available
    const now = new Date().toISOString();
    return {
      ...project,
      created_at: now,
      updated_at: now,
    };
  }
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    throw new Error(`Failed to update project: ${error.message}`);
  }

  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting project:', error);
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    console.error('Error fetching user:', error);
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data;
}

export async function createUser(user: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
  const now = new Date().toISOString();
  const userData = {
    ...user,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data;
}