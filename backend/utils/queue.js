import PQueue from "p-queue";

/**
 * Creates a rate-limited scan queue.
 * Defaults are tuned for VirusTotal's free tier (4 req/min).
 *
 * concurrency  - parallel jobs running at once (default: 1)
 * interval     - time window in ms (default: 15000)
 * intervalCap  - max jobs per interval (default: 1)
 */
export const createScanQueue = ({
  concurrency  = parseInt(process.env.DEFAULT_QUEUE_CONCURRENCY  ?? "1"),
  interval     = parseInt(process.env.DEFAULT_QUEUE_INTERVAL     ?? "15000"),
  intervalCap  = parseInt(process.env.DEFAULT_QUEUE_INTERVAL_CAP ?? "1"),
} = {}) => {
  return new PQueue({ concurrency, interval, intervalCap });
}

// Default instance — ready to use without any config
export const scanQueue = createScanQueue();
