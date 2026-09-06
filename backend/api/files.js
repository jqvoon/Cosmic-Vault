import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Files } from "../db/models/index.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(__dirname, "..", "storage");

const getStoredFile = async (req) =>
  Files.findOne({
    _id: req.params.id,
    userId: req.userId,
    deletedAt: null,
    uploadStatus: "stored",
  });

router.get("/files/:id/content", async (req, res) => {
  const file = await getStoredFile(req);
  if (!file) {
    return res.status(404).json({ error: "File not found" });
  }

  const absolutePath = path.join(STORAGE_DIR, file.storagePath);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: "Stored file not found" });
  }

  const stat = fs.statSync(absolutePath);
  const mimeType = file.mimeType || "application/octet-stream";

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
  res.setHeader("Accept-Ranges", "bytes");

  const range = req.headers.range;
  if (range && mimeType.startsWith("video/")) {
    const [startPart, endPart] = range.replace(/bytes=/, "").split("-");
    const start = Number.parseInt(startPart, 10);
    const end = endPart ? Number.parseInt(endPart, 10) : stat.size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
      return res.status(416).end();
    }

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", end - start + 1);

    return fs.createReadStream(absolutePath, { start, end }).pipe(res);
  }

  res.setHeader("Content-Length", stat.size);
  return fs.createReadStream(absolutePath).pipe(res);
});

router.get("/files/:id/download", async (req, res) => {
  const file = await getStoredFile(req);

  if (!file) {
    return res.status(404).json({ error: "File not found" });
  }

  const absolutePath = path.join(STORAGE_DIR, file.storagePath);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: "Stored file not found" });
  }

  const stat = fs.statSync(absolutePath);
  const mimeType = file.mimeType || "application/octet-stream";

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
  res.setHeader("Content-Length", stat.size);
  return fs.createReadStream(absolutePath).pipe(res);
});

export default router;
