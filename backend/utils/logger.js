/**
 * Simple logging utility with namespaces and log levels.
 * Log levels in ascending order of severity.
 * Setting a level will output that level and everything above it.
 *
 *   debug → info → warn → error
 *
 * Control via env var:
 *   LOG_LEVEL=debug   (most verbose)
 *   LOG_LEVEL=info    (default)
 *   LOG_LEVEL=warn
 *   LOG_LEVEL=error   (least verbose)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL ?? "info"] ?? LEVELS.info;

const timestamp = () => new Date().toISOString();

const shouldLog = (level) => LEVELS[level] >= CURRENT_LEVEL;

const format = (level, namespace, message) =>
  `[${timestamp()}] [${level.toUpperCase()}] [${namespace}] ${message}`;

export const createLogger = (namespace) => ({
  debug: (message) => {
    if (shouldLog("debug")) console.debug(format("debug", namespace, message));
  },
  info: (message) => {
    if (shouldLog("info")) console.info(format("info", namespace, message));
  },
  warn: (message) => {
    if (shouldLog("warn")) console.warn(format("warn", namespace, message));
  },
  error: (message) => {
    if (shouldLog("error")) console.error(format("error", namespace, message));
  },
});
