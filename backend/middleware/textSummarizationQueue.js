import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import { createScanQueue } from "../utils/queue.js";
import { createLogger } from "../utils/logger.js";
import { Files } from "../db/models/index.js";
import { emitFileEvent } from "../utils/fileEvents.js";
import {
  upsertQueueJob,
  startQueueJob,
  removeQueueJob,
} from "../utils/queueMonitor.js";

const logger = createLogger("text-summary");

const OLLAMA_CHAT_URL = process.env.OLLAMA_CHAT_URL;
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_REQUEST_TIMEOUT_MS = parseInt(
  process.env.OLLAMA_REQUEST_TIMEOUT_MS ?? "30000",
  10,
);
const SUMMARY_MODEL = "qwen2.5";
const SUMMARY_PROMPT = `Summarize the following document into:
- Key points
- Important entities
- Actionable insights

Keep it concise.`;
const CHUNK_TRIGGER_TOKENS = 4000;
const CHUNK_SIZE_TOKENS = 2000;
const SUMMARY_EXTENSIONS = new Set(["txt", "docx"]);
export const SUMMARY_LENGTH_OPTIONS = {
  short: 20,
  medium: 100,
  long: 200,
};

export const textSummarizationQueue = createScanQueue();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR =
  process.env.STORAGE_DIR ?? path.join(__dirname, "..", "storage");

// --- Helpers -----------------------------------------------------------------

const emitFileUpdated = (fileRecord) => {
  if (!fileRecord) return;

  logger.info(
    `Emitting file.updated event for fileId=${fileRecord._id.toString()}, userId=${fileRecord.userId}, source=summary`,
  );
  emitFileEvent(fileRecord.userId, "file.updated", {
    fileId: fileRecord._id.toString(),
    source: "summary",
  });
};

const queueJobIdForFile = (fileId) => `textSummarization:${fileId}`;

export const isSummarizableExtension = (extension) =>
  SUMMARY_EXTENSIONS.has((extension ?? "").toLowerCase());

export const isSummarizableFile = (file) =>
  isSummarizableExtension(file?.extension);

export const normalizeSummaryLengthOption = (value) =>
  Object.prototype.hasOwnProperty.call(SUMMARY_LENGTH_OPTIONS, value)
    ? value
    : "medium";

const splitIntoTokenChunks = (text, chunkSize) => {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length <= chunkSize) {
    return [text];
  }

  const chunks = [];
  for (let index = 0; index < tokens.length; index += chunkSize) {
    chunks.push(tokens.slice(index, index + chunkSize).join(" "));
  }
  return chunks;
};

const readDocumentText = async (filePath, extension) => {
  if (extension === "txt") {
    return fs.readFileSync(filePath, "utf8");
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error("Document type is currently unsupported for summarization");
};

const summarizeText = async (text, wordLimit) => {
  if (!OLLAMA_API_KEY) {
    throw new Error("OLLAMA_API_KEY is not configured");
  }

  const { data } = await axios.post(
    OLLAMA_CHAT_URL,
    {
      model: SUMMARY_MODEL,
      stream: false,
      messages: [
        {
          role: "user",
          content: `${SUMMARY_PROMPT}\n\nThe final summary must stay within or below ${wordLimit} words.\n\n${text}`,
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": OLLAMA_API_KEY,
      },
      timeout: OLLAMA_REQUEST_TIMEOUT_MS,
    },
  );

  return data?.message?.content?.trim() ?? "";
};

const buildSummary = async (text, wordLimit) => {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length <= CHUNK_TRIGGER_TOKENS) {
    return summarizeText(text, wordLimit);
  }

  const chunkSummaries = [];
  for (const chunk of splitIntoTokenChunks(text, CHUNK_SIZE_TOKENS)) {
    const partialSummary = await summarizeText(chunk, wordLimit);
    if (partialSummary) {
      chunkSummaries.push(partialSummary);
    }
  }

  return summarizeText(chunkSummaries.join("\n\n"), wordLimit);
};

// --- Core summary job --------------------------------------------------------

const runTextSummarization = async (fileId) => {
  startQueueJob("textSummarization", queueJobIdForFile(fileId));
  const file = await Files.findOne({
    _id: fileId,
    deletedAt: null,
    uploadStatus: "stored",
  });

  if (!file || !isSummarizableFile(file)) {
    removeQueueJob("textSummarization", queueJobIdForFile(fileId));
    return;
  }

  const absolutePath = path.join(STORAGE_DIR, file.storagePath);
  if (!fs.existsSync(absolutePath)) {
    logger.warn(
      `Stored document missing for summarization: ${file.originalName}`,
    );
    removeQueueJob("textSummarization", queueJobIdForFile(fileId));
    return;
  }

  try {
    logger.info(`Generating summary for ${file.originalName}`);
    const documentText = await readDocumentText(absolutePath, file.extension);
    const lengthOption = normalizeSummaryLengthOption(
      file.summary?.lengthOption,
    );
    const wordLimit = SUMMARY_LENGTH_OPTIONS[lengthOption];
    const summaryText = await buildSummary(documentText, wordLimit);

    if (!summaryText) {
      throw new Error("Generated summary was empty");
    }

    const updatedFile = await Files.findByIdAndUpdate(
      fileId,
      {
        $set: {
          summary: {
            status: "completed",
            lengthOption,
            wordLimit,
            text: summaryText,
            generatedAt: new Date(),
            model: SUMMARY_MODEL,
            error: null,
          },
        },
      },
      { returnDocument: "after" },
    );
    emitFileUpdated(updatedFile);
    removeQueueJob("textSummarization", queueJobIdForFile(fileId));
  } catch (error) {
    logger.warn(
      `Text summarization failed for ${file.originalName}: ${error.message}. Updating file status to failed.`,
    );
    const updatedFile = await Files.findByIdAndUpdate(
      fileId,
      {
        $set: {
          summary: {
            ...(file.summary?.toObject?.() ?? file.summary ?? {}),
            status: "failed",
            lengthOption: normalizeSummaryLengthOption(
              file.summary?.lengthOption,
            ),
            wordLimit:
              SUMMARY_LENGTH_OPTIONS[
                normalizeSummaryLengthOption(file.summary?.lengthOption)
              ],
            text: file.summary?.text ?? "",
            generatedAt: file.summary?.generatedAt ?? null,
            model: SUMMARY_MODEL,
            error: error.message,
          },
        },
      },
      { returnDocument: "after" },
    );
    logger.info(
      `Updated file status to failed: fileId=${fileId}. Emitting event...`,
    );
    emitFileUpdated(updatedFile);
    removeQueueJob("textSummarization", queueJobIdForFile(fileId));
    logger.info(`Removed queue job for fileId=${fileId}`);

    logger.error(
      `Text summarization failed for ${file.originalName}: ${error.message}`,
    );
  }
};

// --- Public API --------------------------------------------------------------

export const enqueueTextSummarization = (fileId, meta = {}) => {
  upsertQueueJob("textSummarization", {
    id: queueJobIdForFile(fileId),
    fileId: String(fileId),
    fileName: meta.fileName ?? "Document file",
    userId: meta.userId ?? null,
    status: "queued",
  });

  return textSummarizationQueue.add(() => runTextSummarization(fileId), {
    priority: 0,
  });
};

export const recoverPendingTextSummaries = async () => {
  const files = await Files.find({
    deletedAt: null,
    uploadStatus: "stored",
    "summary.status": "pending",
    extension: { $in: [...SUMMARY_EXTENSIONS] },
  }).select("_id originalName userId");

  if (files.length === 0) {
    logger.info("No text summaries need recovery.");
    return;
  }

  logger.info(`Recovering ${files.length} text summarization job(s).`);
  for (const file of files) {
    enqueueTextSummarization(file._id, {
      userId: file.userId,
      fileName: file.originalName,
    });
  }
};
