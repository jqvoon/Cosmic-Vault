import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createScanQueue } from "../utils/queue.js";
import { createLogger } from "../utils/logger.js";
import { Files } from "../db/models/index.js";
import { enqueueImageTagging, isImageFile } from "./imageTaggingQueue.js";
import { enqueueTextSummarization, isSummarizableFile } from "./textSummarizationQueue.js";
import { emitFileEvent } from "../utils/fileEvents.js";
import { upsertQueueJob, startQueueJob, removeQueueJob } from "../utils/queueMonitor.js";

const logger = createLogger("scan");

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VT_BASE = "https://www.virustotal.com/api/v3";
const ALREADY_SUBMITTED_RETRY_MS = 30_000;

/**
 * Storage layout (all under a single storage/ folder at project root):
 *
 *   storage/
 *     quarantine/  <- all uploads land here first (untrusted)
 *     clean/       <- files moved here only after passing the VT scan
 *
 * Files that fail the scan are deleted from quarantine entirely.
 *
 * Override the storage root via env var in prod:
 *   STORAGE_DIR=/home/deploy/your-project/storage
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(__dirname, "..", "storage");

export const QUARANTINE_DIR = path.join(STORAGE_DIR, "quarantine");
export const CLEAN_DIR = path.join(STORAGE_DIR, "clean");

fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
fs.mkdirSync(CLEAN_DIR, { recursive: true });

export const scanQueue = createScanQueue();

// ─── VirusTotal client ────────────────────────────────────────────────────────
// TODO: plug in your session cookie / auth interceptor here when ready
const vtClient = axios.create({
  baseURL: VT_BASE,
  headers: { "x-apikey": VT_API_KEY },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const relativeStoragePath = (absolutePath) => path.relative(STORAGE_DIR, absolutePath).replaceAll("\\", "/");

const emitFileUpdated = (fileRecord, source = "scan") => {
  if (!fileRecord) return;

  emitFileEvent(fileRecord.userId, "file.updated", {
    fileId: fileRecord._id.toString(),
    source,
  });
};

const queueJobIdForFile = (fileId) => `scan:${fileId}`;

const isAlreadySubmittedError = (error) =>
  error.response?.status === 409 &&
  error.response?.data?.error?.code === "AlreadySubmittedError";

const scheduleScanRetry = ({ fileId, filePath, fileName, userId }) => {
  upsertQueueJob("scan", {
    id: queueJobIdForFile(fileId),
    fileId: String(fileId),
    fileName,
    userId,
    status: "queued",
  });

  setTimeout(() => {
    scanQueue.add(() => runScan({ fileId, filePath, fileName }), { priority: 0 });
  }, ALREADY_SUBMITTED_RETRY_MS);
};

const submitToVT = async (filePath) => {
  logger.info(`Submitting to VirusTotal: ${path.basename(filePath)}`);

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const { data } = await vtClient.post("/files", form, {
    headers: form.getHeaders(),
  });

  return data.data.id;
};

const pollAnalysis = async (analysisId, { intervalMs = 10_000, maxAttempts = 30 } = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    logger.debug(`Polling attempt ${attempt + 1}/${maxAttempts} for ${analysisId}`);
    const { data } = await vtClient.get(`/analyses/${analysisId}`);

    if (data.data.attributes.status === "completed") return data.data;
  }

  throw new Error(`VT analysis ${analysisId} did not complete in time`);
};

const getVerdict = (analysis) => {
  const { malicious = 0, suspicious = 0 } = analysis.attributes.stats;
  if (malicious > 0) return "malicious";
  if (suspicious > 0) return "suspicious";
  return "clean";
};

const moveFile = (src, dest) => {
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code === "EXDEV") {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    } else {
      throw err;
    }
  }
};

export const moveFileToClean = async (filePath, logMessage, fileId = null) => {
  const cleanPath = path.join(CLEAN_DIR, path.basename(filePath));
  moveFile(filePath, cleanPath);

  if (fileId) {
    const fileRecord = await Files.findByIdAndUpdate(fileId, {
      $set: {
        storagePath: relativeStoragePath(cleanPath),
        uploadStatus: "stored",
      },
    }, { returnDocument: "after" });

    emitFileUpdated(fileRecord);

    // Once the file is trusted and in clean/, image files can move on to
    // the post-processing queue for LLaVA tagging.
    if (isImageFile(fileRecord)) {
      enqueueImageTagging(fileId, 0, {
        userId: fileRecord.userId,
        fileName: fileRecord.originalName,
      });
    }

    // Summaries follow the same post-clean pattern so uploads that skip VT
    // and uploads that pass VT both reuse the same enqueue hook.
    if (fileRecord?.summary?.status === "pending" && isSummarizableFile(fileRecord)) {
      enqueueTextSummarization(fileId, {
        userId: fileRecord.userId,
        fileName: fileRecord.originalName,
      });
    }
  }

  logger.info(logMessage);
  return cleanPath;
};

// ─── Core scan job ────────────────────────────────────────────────────────────

const runScan = async ({ fileId, filePath, fileName }) => {
  startQueueJob("scan", queueJobIdForFile(fileId));
  logger.info(`Starting scan: ${fileName}`);

  try {
    const analysisId = await submitToVT(filePath);
    const analysis = await pollAnalysis(analysisId);
    const verdict = getVerdict(analysis);

    if (verdict === "clean") {
      await moveFileToClean(filePath, `Passed scan for ${fileName} and moved to storage/clean/`, fileId);
      const updatedFile = await Files.findByIdAndUpdate(fileId, {
        $set: {
          scanStatus: "clean",
          scanVerdict: verdict,
          scanError: null,
          scannedAt: new Date(),
        },
      }, { returnDocument: "after" });
      emitFileUpdated(updatedFile);
      removeQueueJob("scan", queueJobIdForFile(fileId));
      return;
    }

    try {
      fs.unlinkSync(filePath);
      logger.warn(`Deleted ${fileName} from quarantine (${verdict})`);
      const updatedFile = await Files.findByIdAndUpdate(fileId, {
        $set: {
          uploadStatus: "failed",
          scanStatus: "infected",
          scanVerdict: verdict,
          scanError: null,
          scannedAt: new Date(),
        },
      }, { returnDocument: "after" });
      emitFileUpdated(updatedFile);
      removeQueueJob("scan", queueJobIdForFile(fileId));
    } catch (deleteErr) {
      logger.error(`Failed to delete ${fileName} from quarantine: ${deleteErr.message}`);
      const updatedFile = await Files.findByIdAndUpdate(fileId, {
        $set: {
          uploadStatus: "failed",
          scanStatus: "failed",
          scanError: deleteErr.message,
          scannedAt: new Date(),
        },
      }, { returnDocument: "after" });
      emitFileUpdated(updatedFile);
      removeQueueJob("scan", queueJobIdForFile(fileId));
    }
  } catch (err) {
    if (isAlreadySubmittedError(err)) {
      logger.info(`VirusTotal already has ${fileName} pending. Keeping it in queue and retrying.`);
      const pendingFile = await Files.findByIdAndUpdate(fileId, {
        $set: {
          uploadStatus: "uploading",
          scanStatus: "pending",
          scanError: null,
        },
      }, { returnDocument: "after" });
      emitFileUpdated(pendingFile);
      scheduleScanRetry({
        fileId,
        filePath,
        fileName,
        userId: pendingFile?.userId,
      });
      return;
    }

    logger.error(`Error scanning ${fileName}: ${err.message}`);
    if (err.response) {
      logger.error(`VirusTotal error response: ${JSON.stringify({
        status: err.response.status,
        statusText: err.response.statusText,
        headers: err.response.headers,
        data: err.response.data,
      })}`);
    }

    const updatedFile = await Files.findByIdAndUpdate(fileId, {
      $set: {
        uploadStatus: "failed",
        scanStatus: "failed",
        scanError: err.message,
      },
    }, { returnDocument: "after" });
    emitFileUpdated(updatedFile);
    removeQueueJob("scan", queueJobIdForFile(fileId));
    // File stays in storage/quarantine/ - recoverQuarantinedFiles() will re-queue on restart
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const enqueueFileScan = (fileId, filePath, fileName, userId = null) => {
  upsertQueueJob("scan", {
    id: queueJobIdForFile(fileId),
    fileId: String(fileId),
    fileName,
    userId,
    status: "queued",
  });

  return scanQueue.add(() => runScan({ fileId, filePath, fileName }), { priority: 0 });
};

export const recoverQuarantinedFiles = async () => {
  let files;

  try {
    files = fs.readdirSync(QUARANTINE_DIR);
  } catch {
    logger.error("Could not read quarantine directory.");
    return;
  }

  if (files.length === 0) {
    logger.info("No files in quarantine to recover.");
    return;
  }

  logger.info(`Recovering ${files.length} file(s) from quarantine...`);
  for (const fileName of files) {
    const filePath = path.join(QUARANTINE_DIR, fileName);
    const fileRecord = await Files.findOne({
      savedAs: fileName,
      deletedAt: null,
      scanEnabled: true,
      scanStatus: { $in: ["pending", "failed"] },
    });

    if (!fileRecord) {
      logger.warn(`No file record found for quarantined file ${fileName}; leaving it in place.`);
      continue;
    }

    enqueueFileScan(fileRecord._id, filePath, fileRecord.originalName, fileRecord.userId);
  }
};
