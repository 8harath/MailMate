-- Migration: Create agent_memory table for persistent AI agent preferences
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'sender_preference',
    'priority_rule',
    'scheduling_preference',
    'writing_style',
    'general'
  )),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(user_id, category);

-- Enable Row Level Security
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own memories
CREATE POLICY "Users can manage their own memories"
  ON agent_memory
  FOR ALL
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'email')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'email');

-- Allow service role full access (used by the Next.js API routes via supabaseAdmin)
CREATE POLICY "Service role full access"
  ON agent_memory
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
