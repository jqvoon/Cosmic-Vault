import { Router } from "express";
import { getUserQueueSnapshot } from "../utils/queueMonitor.js";

const router = Router();

router.get("/queues", (req, res) => {
  return res.json({
    queues: getUserQueueSnapshot(req.userId),
  });
});

export default router;
