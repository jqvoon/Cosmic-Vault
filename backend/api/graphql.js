import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { graphql, buildSchema } from "graphql";
import { Files } from "../db/models/index.js";
import {
  enqueueImageTagging,
  isImageFile,
} from "../middleware/imageTaggingQueue.js";
import {
  enqueueTextSummarization,
  isSummarizableFile,
  normalizeSummaryLengthOption,
  SUMMARY_LENGTH_OPTIONS,
} from "../middleware/textSummarizationQueue.js";
import { emitFileEvent } from "../utils/fileEvents.js";
import { removeQueueJob } from "../utils/queueMonitor.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR =
  process.env.STORAGE_DIR ?? path.join(__dirname, "..", "storage");

const schema = buildSchema(`
  type FileSummary {
    status: String!
    lengthOption: String
    wordLimit: Float
    text: String
    generatedAt: String
    model: String
    error: String
  }

  type File {
    id: ID!
    originalName: String!
    savedAs: String!
    storagePath: String!
    mimeType: String
    extension: String
    size: Float!
    category: String!
    description: String!
    tags: [String!]!
    summary: FileSummary!
    imageTaggingStatus: String!
    scanEnabled: Boolean!
    uploadStatus: String!
    scanStatus: String!
    scanVerdict: String
    scanError: String
    scannedAt: String
    deletedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type DeleteUserFileResult {
    success: Boolean!
    id: ID!
  }

  type UpdateUserFileResult {
    success: Boolean!
    file: File!
  }

  type Query {
    userFiles: [File!]!
  }

  type Mutation {
    deleteUserFile(id: ID!): DeleteUserFileResult!
    updateUserFileDescription(id: ID!, description: String!): UpdateUserFileResult!
    updateUserFileTags(id: ID!, tags: [String!]!): UpdateUserFileResult!
    retryImageTagging(id: ID!): UpdateUserFileResult!
    dismissImageTaggingFailure(id: ID!): UpdateUserFileResult!
    summarizeUserFile(id: ID!, lengthOption: String!): UpdateUserFileResult!
    retrySummarization(id: ID!): UpdateUserFileResult!
    dismissSummarizationFailure(id: ID!): UpdateUserFileResult!
  }
`);

const mapFile = (file) => ({
  id: file._id.toString(),
  originalName: file.originalName,
  savedAs: file.savedAs,
  storagePath: file.storagePath,
  mimeType: file.mimeType ?? null,
  extension: file.extension ?? null,
  size: file.size,
  category: file.category,
  description: file.description ?? "",
  tags: (file.tags ?? []).map((tag) => tag.label).filter(Boolean),
  summary: {
    status: file.summary?.status ?? "not_available",
    lengthOption: file.summary?.lengthOption ?? null,
    wordLimit: file.summary?.wordLimit ?? null,
    text: file.summary?.text ?? null,
    generatedAt: file.summary?.generatedAt?.toISOString() ?? null,
    model: file.summary?.model ?? null,
    error: file.summary?.error ?? null,
  },
  imageTaggingStatus: file.imageTaggingStatus ?? "not_applicable",
  scanEnabled: file.scanEnabled,
  uploadStatus: file.uploadStatus,
  scanStatus: file.scanStatus,
  scanVerdict: file.scanVerdict ?? null,
  scanError: file.scanError ?? null,
  scannedAt: file.scannedAt?.toISOString() ?? null,
  deletedAt: file.deletedAt?.toISOString() ?? null,
  createdAt: file.createdAt.toISOString(),
  updatedAt: file.updatedAt.toISOString(),
});

const rootValue = {
  userFiles: async (_args, context) => {
    const files = await Files.find({
      userId: context.userId,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    return files.map(mapFile);
  },

  deleteUserFile: async ({ id }, context) => {
    const file = await Files.findOne({
      _id: id,
      userId: context.userId,
      deletedAt: null,
    });

    if (!file) {
      throw new Error("File not found");
    }

    const absolutePath = path.join(STORAGE_DIR, file.storagePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    file.deletedAt = new Date();
    file.uploadStatus = "deleted";
    await file.save();
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "graphql",
    });

    return {
      success: true,
      id: file._id.toString(),
    };
  },

  updateUserFileDescription: async ({ id, description }, context) => {
    const file = await Files.findOneAndUpdate(
      {
        _id: id,
        userId: context.userId,
        deletedAt: null,
      },
      {
        $set: {
          description,
        },
      },
      { returnDocument: "after" },
    );

    if (!file) {
      throw new Error("File not found");
    }
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "graphql",
    });

    return {
      success: true,
      file: mapFile(file),
    };
  },

  updateUserFileTags: async ({ id, tags }, context) => {
    const file = await Files.findOne({
      _id: id,
      userId: context.userId,
      deletedAt: null,
    });

    if (!file) {
      throw new Error("File not found");
    }

    if (!["completed", "failed"].includes(file.imageTaggingStatus)) {
      throw new Error(
        "Tags can only be edited after image tagging completes or fails",
      );
    }

    const normalizedTags = [
      ...new Set(
        tags
          .map((tag) =>
            String(tag ?? "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ].slice(0, 10);

    file.tags = normalizedTags.map((label) => ({
      label,
      source: "user_edit",
    }));
    await file.save();
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "graphql",
    });

    return {
      success: true,
      file: mapFile(file),
    };
  },

  retryImageTagging: async ({ id }, context) => {
    const file = await Files.findOne({
      _id: id,
      userId: context.userId,
      deletedAt: null,
      uploadStatus: "stored",
    });

    if (!file) {
      throw new Error("File not found");
    }

    if (!isImageFile(file)) {
      throw new Error("Image tagging is only available for image files");
    }

    if (file.imageTaggingStatus !== "failed") {
      throw new Error("Image tagging can only be retried after a failure");
    }

    file.imageTaggingStatus = "pending";
    await file.save();
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "imageTagging",
    });

    enqueueImageTagging(file._id, 0, {
      userId: file.userId,
      fileName: file.originalName,
    });

    return {
      success: true,
      file: mapFile(file),
    };
  },

  dismissImageTaggingFailure: async ({ id }, context) => {
    const file = await Files.findOne({
      _id: id,
      userId: context.userId,
      deletedAt: null,
      uploadStatus: "stored",
    });

    if (!file) {
      throw new Error("File not found");
    }

    if (file.imageTaggingStatus !== "failed") {
      throw new Error("Only failed image tagging items can be removed");
    }

    file.imageTaggingStatus = "not_applicable";
    await file.save();
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "imageTagging",
    });

    return {
      success: true,
      file: mapFile(file),
    };
  },

  summarizeUserFile: async ({ id, lengthOption }, context) => {
    const file = await Files.findOne({
      _id: id,
      userId: context.userId,
      deletedAt: null,
      uploadStatus: "stored",
    });

    if (!file) {
      throw new Error("File not found");
    }

    if (file.category !== "documents" || !isSummarizableFile(file)) {
      throw new Error(
        "This filetype is currently unsupported for summarization",
      );
    }

    const normalizedLengthOption = normalizeSummaryLengthOption(lengthOption);
    file.summary = {
      ...(file.summary?.toObject?.() ?? file.summary ?? {}),
      status: "pending",
      lengthOption: normalizedLengthOption,
      wordLimit: SUMMARY_LENGTH_OPTIONS[normalizedLengthOption],
      model: "qwen2.5",
      error: null,
    };
    await file.save();
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "summary",
    });

    enqueueTextSummarization(file._id, {
      userId: file.userId,
      fileName: file.originalName,
    });

    return {
      success: true,
      file: mapFile(file),
    };
  },

  retrySummarization: async ({ id }, context) => {
    const file = await Files.findOne({
      _id: id,
      userId: context.userId,
      deletedAt: null,
      uploadStatus: "stored",
    });

    if (!file) {
      throw new Error("File not found");
    }

    if (file.category !== "documents" || !isSummarizableFile(file)) {
      throw new Error(
        "Summarization is only available for supported document files",
      );
    }

    if (file.summary?.status !== "failed") {
      throw new Error("Summarization can only be retried after a failure");
    }

    // Remove the old failed queue job before re-enqueueing
    removeQueueJob("textSummarization", `textSummarization:${file._id}`);

    file.summary = {
      ...(file.summary?.toObject?.() ?? file.summary ?? {}),
      status: "pending",
      error: null,
    };
    await file.save();
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "summary",
    });

    enqueueTextSummarization(file._id, {
      userId: file.userId,
      fileName: file.originalName,
    });

    return {
      success: true,
      file: mapFile(file),
    };
  },

  dismissSummarizationFailure: async ({ id }, context) => {
    const file = await Files.findOne({
      _id: id,
      userId: context.userId,
      deletedAt: null,
      uploadStatus: "stored",
    });

    if (!file) {
      throw new Error("File not found");
    }

    if (file.summary?.status !== "failed") {
      throw new Error("Only failed summarization items can be removed");
    }

    file.summary = {
      ...(file.summary?.toObject?.() ?? file.summary ?? {}),
      status: "not_requested",
      error: null,
    };
    await file.save();
    emitFileEvent(file.userId, "file.updated", {
      fileId: file._id.toString(),
      source: "summary",
    });

    return {
      success: true,
      file: mapFile(file),
    };
  },
};

router.post("/graphql", async (req, res) => {
  const { query, variables, operationName } = req.body ?? {};

  if (!query) {
    return res
      .status(400)
      .json({ errors: [{ message: "GraphQL query is required" }] });
  }

  const result = await graphql({
    schema,
    source: query,
    rootValue,
    contextValue: { userId: req.userId },
    variableValues: variables,
    operationName,
  });

  const statusCode = result.errors ? 400 : 200;
  return res.status(statusCode).json(result);
});

export default router;
