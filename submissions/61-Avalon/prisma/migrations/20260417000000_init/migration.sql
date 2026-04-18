-- MailMate initial schema migration
-- Creates all application tables, NextAuth tables, and LangGraph support tables.
-- Run via: npx prisma migrate deploy

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('sender_preference', 'priority_rule', 'scheduling_preference', 'writing_style', 'automation_rule', 'general');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('auto', 'confirm', 'notify');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('pending', 'approved', 'rejected', 'executed', 'undone');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('running', 'completed', 'interrupted', 'failed');

-- CreateTable: NextAuth OAuth accounts (links users to Google provider)
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NextAuth sessions (DB-backed for multi-replica support)
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NextAuth email verification tokens
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable: Core user record (upserted on every sign-in)
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Per-user AI memory entries (preferences, rules, styles)
CREATE TABLE "agent_memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sourceMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Cached AI thread analyses (avoid re-analyzing same thread)
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "analysisData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Thread-level metadata (labels, snooze, read state)
CREATE TABLE "thread_meta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "thread_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Custom user-defined inbox labels
CREATE TABLE "user_labels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Automation actions (executed, pending approval, or rejected)
CREATE TABLE "automation_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL DEFAULT '',
    "threadSubject" TEXT,
    "threadFrom" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    CONSTRAINT "automation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Per-user automation on/off settings and rule overrides
CREATE TABLE "automation_settings" (
    "userId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable: LangGraph agent run tracking (links run_id → user → status)
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "graphName" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'running',
    "threadId" TEXT,
    "checkpointId" TEXT,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: HITL approval requests (risky automation / calendar creation)
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "agent_memory_userId_idx" ON "agent_memory"("userId");
CREATE INDEX "agent_memory_userId_category_idx" ON "agent_memory"("userId", "category");
CREATE UNIQUE INDEX "agent_memory_userId_category_key_key" ON "agent_memory"("userId", "category", "key");
CREATE INDEX "analyses_userId_idx" ON "analyses"("userId");
CREATE UNIQUE INDEX "analyses_userId_threadId_key" ON "analyses"("userId", "threadId");
CREATE INDEX "thread_meta_userId_idx" ON "thread_meta"("userId");
CREATE UNIQUE INDEX "thread_meta_userId_threadId_key" ON "thread_meta"("userId", "threadId");
CREATE INDEX "user_labels_userId_idx" ON "user_labels"("userId");
CREATE UNIQUE INDEX "user_labels_userId_name_key" ON "user_labels"("userId", "name");
CREATE INDEX "automation_actions_userId_idx" ON "automation_actions"("userId");
CREATE INDEX "automation_actions_userId_status_idx" ON "automation_actions"("userId", "status");
CREATE INDEX "automation_actions_userId_riskLevel_idx" ON "automation_actions"("userId", "riskLevel");
CREATE INDEX "agent_runs_userId_idx" ON "agent_runs"("userId");
CREATE INDEX "agent_runs_userId_status_idx" ON "agent_runs"("userId", "status");
CREATE INDEX "approval_requests_userId_status_idx" ON "approval_requests"("userId", "status");

-- Foreign keys (all CASCADE on delete to clean up orphaned rows)
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "thread_meta" ADD CONSTRAINT "thread_meta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_labels" ADD CONSTRAINT "user_labels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
