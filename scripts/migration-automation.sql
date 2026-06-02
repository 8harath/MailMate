-- Migration: Create automation tables
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor > New Query)

-- Stores all automation actions (executed, pending, rejected)
CREATE TABLE IF NOT EXISTS automation_actions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  type TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('auto', 'confirm', 'notify')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'undone')),
  payload JSONB NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  thread_subject TEXT,
  thread_from JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auto_actions_user ON automation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_actions_status ON automation_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auto_actions_risk ON automation_actions(user_id, risk_level);

-- Per-user automation settings
CREATE TABLE IF NOT EXISTS automation_settings (
  user_id TEXT PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;

-- Service role full access (used by Next.js API via supabaseAdmin)
CREATE POLICY "Service role access on automation_actions"
  ON automation_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role access on automation_settings"
  ON automation_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
