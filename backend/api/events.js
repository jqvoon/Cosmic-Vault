import { Router } from "express";
import { registerFileEventClient } from "../utils/fileEvents.js";

const router = Router();

router.get("/events", (req, res) => {
  const userId = req.userId;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const stopStreaming = registerFileEventClient(userId, res);
  const heartbeat = setInterval(() => {
    if (!res.destroyed) {
      res.write(
        `event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`,
      );
    }
  }, 25_000);

  res.on("error", (err) => {
    console.error(`[Events] Response error: ${err.message}`);
    clearInterval(heartbeat);
    stopStreaming();
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    stopStreaming();
  });
});

export default router;
