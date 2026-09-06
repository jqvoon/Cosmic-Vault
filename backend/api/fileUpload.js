import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { QUARANTINE_DIR, enqueueFileScan, moveFileToClean } from "../middleware/scanQueue.js";
import { Files } from "../db/models/index.js";

const router = Router();

// ─── Multer config ────────────────────────────────────────────────────────────
//
// Multer handles the incoming multipart/form-data request from the browser
// and saves the file to disk before the route handler runs.
//
// diskStorage gives us control over where and how the file is saved.
// The alternative (memoryStorage) would hold the file in RAM — not suitable
// for large files or high concurrency.

const storage = multer.diskStorage({
  // All uploads land in quarantine/ first — they are untrusted until
  // the VT scan passes and moves them to clean/
  destination: (_req, _file, cb) => cb(null, QUARANTINE_DIR),

  // Rename the file to a UUID on disk so that:
  //   - original filenames with special characters can't cause issues
  //   - two users uploading the same filename don't collide
  //   - the original name is still preserved in req.file.originalname
  filename: (_req, file, cb) => {
    const uid = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uid}${ext}`);
  },
});

const uploadWithScanLimit = multer({
  storage,
  limits: {
    // VirusTotal free tier rejects files over 32 MB
    fileSize: 32 * 1024 * 1024,
  },
});

const uploadWithoutScanLimit = multer({ storage });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeStoragePath = (filePath) =>
  path.relative(path.dirname(QUARANTINE_DIR), filePath).replaceAll("\\", "/");

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic"]);
const isImageUpload = (mimeType, extension) =>
  mimeType?.startsWith("image/") || IMAGE_EXTENSIONS.has(extension);
const SUMMARY_EXTENSIONS = new Set(["txt", "docx"]);
const isSummarizableUpload = (extension) => SUMMARY_EXTENSIONS.has(extension);
const SUMMARY_LENGTH_OPTIONS = {
  short: 20,
  medium: 100,
  long: 200,
};
const normalizeSummaryLengthOption = (value) =>
  Object.prototype.hasOwnProperty.call(SUMMARY_LENGTH_OPTIONS, value) ? value : "medium";
const normalizeOriginalName = (uploadedName, requestedName) => {
  if (requestedName == null) return uploadedName;

  const trimmedName = requestedName.trim();
  if (!trimmedName) return "";

  const uploadedExt = path.extname(uploadedName);
  const requestedExt = path.extname(trimmedName);
  const requestedBase = requestedExt ? path.basename(trimmedName, requestedExt) : trimmedName;
  return `${requestedBase || path.basename(uploadedName, uploadedExt)}${uploadedExt}`;
};

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/upload", (req, res) => {
  // Read the toggle before Multer runs so the request can choose
  // the correct upload limits while the file stream is still incoming.
  const scanEnabled = req.query.scanEnabled === "true";
  const uploadMiddleware = scanEnabled
    ? uploadWithScanLimit.single("file")
    : uploadWithoutScanLimit.single("file");

  uploadMiddleware(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File size is limited to 32 MB when virus scan is enabled.",
      });
    }

    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const category = req.body.category || "others";
    const originalName = normalizeOriginalName(req.file.originalname, req.body.originalName);
    if (!originalName.trim()) {
      return res.status(400).json({ error: "Filename cannot be empty." });
    }
    const description = req.body.description?.trim() || originalName;
    const extension = path.extname(originalName).replace(".", "").toLowerCase();
    const summarizeDocument = req.body.summarizeDocument === "true";
    const summaryLengthOption = normalizeSummaryLengthOption(req.body.summaryLength);
    const isSummarizableDocument = category === "documents" && isSummarizableUpload(extension);
    let fileRecord;

    try {
      fileRecord = await Files.create({
        userId: req.userId,
        originalName,
        savedAs: path.basename(req.file.path),
        storagePath: normalizeStoragePath(req.file.path),
        mimeType: req.file.mimetype,
        extension,
        size: req.file.size,
        category,
        description,
        imageTaggingStatus: isImageUpload(req.file.mimetype, extension) ? "pending" : "not_applicable",
        summary: {
          status: isSummarizableDocument
            ? (summarizeDocument ? "pending" : "not_requested")
            : "not_available",
          lengthOption: isSummarizableDocument ? summaryLengthOption : null,
          wordLimit: isSummarizableDocument ? SUMMARY_LENGTH_OPTIONS[summaryLengthOption] : null,
          text: "",
          model: summarizeDocument ? "qwen2.5" : undefined,
          error: null,
        },
        scanEnabled,
        uploadStatus: "uploading",
        scanStatus: scanEnabled ? "pending" : "skipped",
      });

      if (!scanEnabled) {
        // When the toggle is off, bypass quarantine processing and treat
        // the upload as immediately trusted.
        await moveFileToClean(
          req.file.path,
          `Skipped file scan for ${originalName} and moved directly to storage/clean/`,
          fileRecord._id
        );

        return res.status(201).json({
          message: "File uploaded directly to clean storage.",
          file: fileRecord,
        });
      }

      // Enqueue the scan — does not block the response
      enqueueFileScan(fileRecord._id, req.file.path, originalName, req.userId);

      return res.status(202).json({
        message: "File uploaded to quarantine and queued for scanning.",
        file: fileRecord,
      });
    } catch (uploadErr) {
      if (fileRecord?._id) {
        await Files.findByIdAndUpdate(fileRecord._id, {
          $set: {
            uploadStatus: "failed",
            scanStatus: scanEnabled ? "failed" : "skipped",
            scanError: uploadErr.message,
          },
        });
      }

      return res.status(500).json({ error: uploadErr.message });
    }
  });
});

export default router;
