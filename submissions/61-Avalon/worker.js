/**
 * BullMQ automation worker — standalone entry point.
 *
 * This file is the `CMD` target for the `worker` Docker Compose service.
 * It consumes jobs from the "automation" BullMQ queue (backed by Redis) and
 * executes automation actions asynchronously, decoupled from the HTTP request
 * lifecycle.
 *
 * Why a separate worker process?
 *   The automation engine can call Gmail/Calendar APIs and run AI
 *   classification. Under high load these operations would block Next.js
 *   serverless functions. The worker runs concurrently (up to 5 jobs at once),
 *   can be scaled independently, and retries on failure with exponential
 *   back-off (3 attempts, 2-second base delay — configured in lib/queue.ts).
 *
 * Usage:
 *   node worker.js            (production — started by Docker Compose)
 *   NODE_ENV=development node worker.js  (local with Redis running)
 *
 * Required env vars: REDIS_URL, plus any vars needed by the automation
 * executor (GROQ_API_KEY, GOOGLE_CLIENT_ID, etc.) — all inherited from .env
 * via the docker-compose env_file directive.
 */

// Load environment variables in non-Docker environments
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local' })
}

const { createAutomationWorker } = require('./lib/queue')
const { logger } = require('./lib/logger')

const log = logger.child({ component: 'automation-worker' })

log.info('worker.starting', { concurrency: 5, queue: 'automation' })

/**
 * Job processor: receives a BullMQ Job<AutomationJobData> and executes
 * the automation action. Currently logs the job; full automation-executor
 * integration is wired here when lib/automation-executor.ts is imported.
 *
 * The job data shape matches AutomationJobData from lib/queue.ts:
 *   { userId, threadId, actionId, type, payload }
 */
const worker = createAutomationWorker(async (job) => {
  const { userId, threadId, actionId, type } = job.data
  log.info('job.start', { jobId: job.id, actionId, type, threadId, userId })

  try {
    // Report 0% progress so the BullMQ dashboard shows activity
    await job.updateProgress(10)

    // Placeholder: in Phase 7+ this calls the automation executor.
    // The executor imports lib/automation-executor.ts and runs the Gmail/
    // Calendar actions for the given payload, then updates the action status
    // in Postgres via lib/automation-store.ts.
    log.info('job.processed', { jobId: job.id, actionId, type })
    await job.updateProgress(100)
  } catch (err) {
    log.error('job.failed', { jobId: job.id, actionId, error: err?.message ?? String(err) })
    throw err // BullMQ will retry according to the defaultJobOptions in lib/queue.ts
  }
})

// Graceful shutdown: drain in-flight jobs before the process exits
process.on('SIGTERM', async () => {
  log.info('worker.stopping')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  log.info('worker.stopping')
  await worker.close()
  process.exit(0)
})

log.info('worker.ready')
