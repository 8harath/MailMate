/**
 * BullMQ automation job queue — lib/queue.ts
 *
 * PURPOSE:
 * Decouples slow / retryable automation work from the HTTP request cycle.
 * When a user triggers "Automate inbox", the API route enqueues a job and
 * returns immediately. The separate `worker` process (worker.js) picks up
 * the job from Redis and executes the Gmail/Calendar actions asynchronously.
 *
 * WHY BULLMQ?
 *   - Built on Redis: same infrastructure already required for rate limiting
 *   - Type-safe job data via TypeScript generics
 *   - Built-in retry with exponential back-off
 *   - Job deduplication via jobId (prevents duplicate runs for the same action)
 *   - Observable: BullMQ Board / Arena can show queue health in production
 *
 * QUEUE NAME: "automation"
 *   All automation jobs share one queue. If you need priority differentiation
 *   in the future, create separate queues (e.g. "automation:high", "automation:low").
 *
 * JOB LIFECYCLE:
 *   1. enqueueAutomation()  → job added to Redis, status: waiting
 *   2. Worker picks it up   → status: active
 *   3. Processor succeeds   → status: completed (kept for 100 jobs)
 *   4. Processor throws     → status: failed, retried up to 3× with 2s base delay
 *      (kept for 50 failed jobs for debugging)
 *
 * DEDUPLICATION:
 *   jobId is set to "automation:<actionId>" so enqueueing the same action
 *   twice is idempotent — BullMQ silently ignores the duplicate.
 *
 * USAGE:
 *   // In an API route:
 *   import { enqueueAutomation } from '@/lib/queue'
 *   const jobId = await enqueueAutomation({ userId, threadId, actionId, type, payload })
 *
 *   // In worker.js:
 *   import { createAutomationWorker } from '@/lib/queue'
 *   const worker = createAutomationWorker(async (job) => { ... })
 */
import { Queue, Worker, Job } from 'bullmq'

// Redis connection config — supports both URL and host/port
const connection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: 'localhost', port: 6379 }

// ── Job data type ──────────────────────────────────────────────────────────────

/**
 * Shape of every job in the "automation" queue.
 * Matches the AutomationAction fields needed to execute the action.
 */
export type AutomationJobData = {
  /** Email address used as the user identifier (matches session.user.email) */
  userId: string
  /** Gmail thread ID the action targets */
  threadId: string
  /** UUID of the AutomationAction row in Postgres (used for deduplication) */
  actionId: string
  /** Action type string e.g. "archive", "label", "send_reply" */
  type: string
  /** Action-specific parameters (label name, reply body, etc.) */
  payload: Record<string, unknown>
}

// ── Queue instance ─────────────────────────────────────────────────────────────

/**
 * Shared BullMQ queue instance.
 * Exported so the API routes can enqueue jobs and status checks can query them.
 */
export const automationQueue = new Queue<AutomationJobData>('automation', {
  connection,
  defaultJobOptions: {
    // Retry 3 times total with exponential back-off starting at 2 seconds
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    // Keep last 100 completed jobs for audit/debugging
    removeOnComplete: { count: 100 },
    // Keep last 50 failed jobs so engineers can inspect what went wrong
    removeOnFail: { count: 50 },
  },
})

// ── Enqueue helpers ────────────────────────────────────────────────────────────

/**
 * Adds an automation action to the queue.
 * Idempotent: calling this twice for the same actionId has no effect.
 *
 * @returns The BullMQ job ID (same as "automation:<actionId>")
 */
export async function enqueueAutomation(data: AutomationJobData): Promise<string> {
  const job = await automationQueue.add('run', data, {
    // Deterministic job ID prevents double-queuing the same action
    jobId: `automation:${data.actionId}`,
  })
  return job.id!
}

/**
 * Returns the current status of a job by its BullMQ job ID.
 * Used by the automation status API to show real-time progress.
 *
 * Returns null if the job does not exist (already cleaned up or never queued).
 */
export async function getJobStatus(jobId: string) {
  const job = await Job.fromId(automationQueue, jobId)
  if (!job) return null
  const state = await job.getState()
  return { id: job.id, state, progress: job.progress, returnValue: job.returnvalue }
}

// ── Worker factory ────────────────────────────────────────────────────────────

/**
 * Creates a BullMQ Worker that processes jobs from the "automation" queue.
 * Called once in worker.js — not in the web process.
 *
 * concurrency: 5 — process up to 5 jobs simultaneously per worker instance.
 * Increase this if your automation actions are I/O-bound (most are).
 *
 * @param processor  Async function that receives a Job and performs the action
 */
export function createAutomationWorker(
  processor: (job: Job<AutomationJobData>) => Promise<void>
): Worker<AutomationJobData> {
  return new Worker<AutomationJobData>('automation', processor, {
    connection,
    concurrency: 5,
  })
}
