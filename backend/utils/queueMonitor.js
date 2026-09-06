import { emitFileEvent } from "./fileEvents.js";

const queueStates = new Map();

const getQueueState = (queueName) => {
  let queueState = queueStates.get(queueName);
  if (!queueState) {
    queueState = new Map();
    queueStates.set(queueName, queueState);
  }
  return queueState;
};

const emitQueueUpdated = (userId, queueName) => {
  if (!userId) return;

  emitFileEvent(userId, "queue.updated", {
    queueName,
    ts: Date.now(),
  });
};

export const upsertQueueJob = (queueName, job) => {
  const queueState = getQueueState(queueName);
  const existing = queueState.get(job.id);
  const nextJob = {
    ...existing,
    ...job,
    queueName,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  queueState.set(job.id, nextJob);
  emitQueueUpdated(nextJob.userId, queueName);
};

export const startQueueJob = (queueName, jobId, updates = {}) => {
  const queueState = getQueueState(queueName);
  const existing = queueState.get(jobId);
  if (!existing) return;

  const nextJob = {
    ...existing,
    ...updates,
    status: "running",
    updatedAt: new Date().toISOString(),
    startedAt: existing.startedAt ?? new Date().toISOString(),
  };
  queueState.set(jobId, nextJob);
  emitQueueUpdated(nextJob.userId, queueName);
};

export const removeQueueJob = (queueName, jobId) => {
  const queueState = getQueueState(queueName);
  const existing = queueState.get(jobId);
  if (!existing) return;

  queueState.delete(jobId);
  emitQueueUpdated(existing.userId, queueName);
};

export const getUserQueueSnapshot = (userId) => {
  const normalizedUserId = String(userId);
  const queueLabels = {
    scan: "Virus Scan Queue",
    imageTagging: "Image Tagging Queue",
    textSummarization: "Document Summary Queue",
  };
  const queueNames = ["scan", "imageTagging", "textSummarization"];

  return queueNames.map((queueName) => {
    const queueState = queueStates.get(queueName) ?? new Map();
    const visibleItems = [...queueState.values()]
      .filter((job) => String(job.userId) === normalizedUserId)
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
    let queuePosition = 0;
    const items = visibleItems.map((job) => {
      if (job.status !== "queued") {
        return { ...job, position: 0 };
      }

      queuePosition += 1;
      return { ...job, position: queuePosition };
    });

    return {
      key: queueName,
      label: queueLabels[queueName] ?? queueName,
      count: items.length,
      items,
    };
  });
};
