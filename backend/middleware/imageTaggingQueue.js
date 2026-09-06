import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createScanQueue } from "../utils/queue.js";
import { createLogger } from "../utils/logger.js";
import { Files } from "../db/models/index.js";
import { emitFileEvent } from "../utils/fileEvents.js";
import { upsertQueueJob, startQueueJob, removeQueueJob } from "../utils/queueMonitor.js";

const logger = createLogger("image-tags");

const OLLAMA_CHAT_URL = process.env.OLLAMA_CHAT_URL;
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_REQUEST_TIMEOUT_MS = parseInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS ?? "30000", 10);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic"]);
const MAX_AUTO_TAGGING_RETRIES = 2;
const RETRY_DELAY_MS = 5_000;

const TAGGING_PROMPT =
  "Return 5-10 tags that must use a single word each to describe this image. The format must be a list of strings ['tag1', 'tag2', 'tag3', ...] and nothing else";

export const imageTaggingQueue = createScanQueue();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(__dirname, "..", "storage");

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const isImageFile = (file) =>
  file?.mimeType?.startsWith("image/") || IMAGE_EXTENSIONS.has(file?.extension);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractQuotedTags = (content) => {
  const matches = [...content.matchAll(/['"]([^'"]+)['"]/g)];
  return matches.map((match) => match[1]);
};

const normalizeTag = (tag) => {
  const firstWord = tag.trim().split(/\s+/)[0];
  return firstWord.replace(/^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_-]+$/gu, "").toLowerCase();
};

const parseTagsFromContent = (content) => {
  if (!content || typeof content !== "string") return [];

  const rawTags = extractQuotedTags(content.trim());
  const normalized = rawTags
    .map(normalizeTag)
    .filter(Boolean);

  return [...new Set(normalized)];
};

const requestImageTags = async (filePath) => {
  if (!OLLAMA_API_KEY) {
    throw new Error("OLLAMA_API_KEY is not configured");
  }

  const imageBase64 = fs.readFileSync(filePath, "base64");
  const { data } = await axios.post(
    OLLAMA_CHAT_URL,
    {
      model: "llava",
      stream: false,
      messages: [
        {
          role: "user",
          content: TAGGING_PROMPT,
          images: [imageBase64],
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": OLLAMA_API_KEY,
      },
      timeout: OLLAMA_REQUEST_TIMEOUT_MS,
    }
  );

  return data?.message?.content ?? "";
};

const scheduleRetry = (fileId, attempt, meta = {}) => {
  upsertQueueJob("imageTagging", {
    id: queueJobIdForFile(fileId),
    fileId: String(fileId),
    fileName: meta.fileName ?? "Image file",
    userId: meta.userId ?? null,
    status: "queued",
    attempt: attempt + 1,
  });

  setTimeout(() => {
    enqueueImageTagging(fileId, attempt + 1, meta);
  }, RETRY_DELAY_MS);
};

const emitFileUpdated = (fileRecord) => {
  if (!fileRecord) return;

  emitFileEvent(fileRecord.userId, "file.updated", {
    fileId: fileRecord._id.toString(),
    source: "imageTagging",
  });
};

const queueJobIdForFile = (fileId) => `imageTagging:${fileId}`;

// ─── Core image tagging job ───────────────────────────────────────────────────

const runImageTagging = async (fileId, attempt = 0) => {
  startQueueJob("imageTagging", queueJobIdForFile(fileId), { attempt });
  const file = await Files.findOne({
    _id: fileId,
    deletedAt: null,
    uploadStatus: "stored",
  });

  if (!file || !isImageFile(file)) {
    removeQueueJob("imageTagging", queueJobIdForFile(fileId));
    return;
  }

  const absolutePath = path.join(STORAGE_DIR, file.storagePath);
  if (!fs.existsSync(absolutePath)) {
    logger.warn(`Stored image missing for tag generation: ${file.originalName}`);
    removeQueueJob("imageTagging", queueJobIdForFile(fileId));
    return;
  }

  try {
    logger.info(`Generating tags for ${file.originalName}`);
    const content = await requestImageTags(absolutePath);
    const parsedTags = parseTagsFromContent(content);

    if (parsedTags.length === 0) {
      if (attempt >= MAX_AUTO_TAGGING_RETRIES) {
        const updatedFile = await Files.findByIdAndUpdate(fileId, {
          $set: {
            imageTaggingStatus: "failed",
          },
        }, { returnDocument: "after" });
        emitFileUpdated(updatedFile);
        removeQueueJob("imageTagging", queueJobIdForFile(fileId));
        logger.error(`Image tagging failed for ${file.originalName} after ${MAX_AUTO_TAGGING_RETRIES} automatic retries.`);
        return;
      }

      logger.warn(`Image tagging returned unusable output for ${file.originalName}; re-queueing.`);
      scheduleRetry(fileId, attempt, {
        userId: file.userId,
        fileName: file.originalName,
      });
      return;
    }

    const updatedFile = await Files.findByIdAndUpdate(fileId, {
      $set: {
        tags: parsedTags.map((label) => ({
          label,
          source: "ollama_llava",
        })),
        imageTaggingStatus: "completed",
        imageTaggedAt: new Date(),
      },
    }, { returnDocument: "after" });
    emitFileUpdated(updatedFile);
    removeQueueJob("imageTagging", queueJobIdForFile(fileId));

    logger.info(`Stored ${parsedTags.length} image tags for ${file.originalName}`);
  } catch (err) {
    if (attempt >= MAX_AUTO_TAGGING_RETRIES) {
      const updatedFile = await Files.findByIdAndUpdate(fileId, {
        $set: {
          imageTaggingStatus: "failed",
        },
      }, { returnDocument: "after" });
      emitFileUpdated(updatedFile);
      removeQueueJob("imageTagging", queueJobIdForFile(fileId));
      logger.error(`Image tagging failed for ${file.originalName}: ${err.message}`);
      return;
    }

    logger.warn(`Image tagging error for ${file.originalName}: ${err.message}. Re-queueing.`);
    await delay(RETRY_DELAY_MS);
    enqueueImageTagging(fileId, attempt + 1, {
      userId: file.userId,
      fileName: file.originalName,
    });
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const enqueueImageTagging = (fileId, attempt = 0, meta = {}) => {
  upsertQueueJob("imageTagging", {
    id: queueJobIdForFile(fileId),
    fileId: String(fileId),
    fileName: meta.fileName ?? "Image file",
    userId: meta.userId ?? null,
    status: "queued",
    attempt,
  });

  return imageTaggingQueue.add(() => runImageTagging(fileId, attempt), { priority: 0 });
};

export const recoverPendingImageTagging = async () => {
  const files = await Files.find({
    deletedAt: null,
    uploadStatus: "stored",
    imageTaggingStatus: "pending",
    $or: [
      { mimeType: /^image\// },
      { extension: { $in: [...IMAGE_EXTENSIONS] } },
    ],
  }).select("_id originalName userId");

  if (files.length === 0) {
    logger.info("No clean image files need tag recovery.");
    return;
  }

  logger.info(`Recovering ${files.length} image tagging job(s).`);
  for (const file of files) {
    enqueueImageTagging(file._id, 0, {
      userId: file.userId,
      fileName: file.originalName,
    });
  }
};
