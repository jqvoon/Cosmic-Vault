import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({

  // --- Ownership --------------------------------------------------------------
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true, index: true },

  // --- File Info --------------------------------------------------------------
  originalName: { type: String, required: true },  // original filename from user
  savedAs:      { type: String, required: true, unique: true }, // UUID filename on disk
  storagePath:  { type: String, required: true },  // relative path under storage/
  mimeType:     { type: String },                  // e.g. application/pdf, video/mp4
  extension:    { type: String },                  // lowercased extension without dot
  size:         { type: Number, required: true },  // file size in bytes
  category:     {
    type: String,
    enum: ["photos", "videos", "documents", "presentations", "spreadsheets", "music", "archives", "others"],
    default: "others"
  },
  description:  { type: String, default: "" },

  // --- Upload Lifecycle -------------------------------------------------------
  scanEnabled: {
    type: Boolean,
    required: true,
    default: false,
  },
  uploadStatus: {
    type: String,
    enum: ["uploading", "stored", "failed", "deleted"],
    default: "uploading",
  },

  // --- Virus Scan -------------------------------------------------------------
  scanStatus: {
    type: String,
    enum: ["skipped", "pending", "clean", "infected", "failed"],
    default: "skipped"
  },
  scanVerdict: { type: String },
  scanError:   { type: String },
  scannedAt:   { type: Date },

  // --- Movie Identification (planned) ----------------------------------------
  movie: {
    identified:  { type: Boolean, default: false },
    title:       { type: String },
    year:        { type: Number },
    tmdbId:      { type: String },
    imdbId:      { type: String },
    posterUrl:   { type: String },
    genres:      [{ type: String }],
    runtime:     { type: Number }, // in minutes
    rating:      { type: Number },
  },

  // --- Image Tagging (planned) ------------------------------------------------
  tags: [{
    label:      { type: String },
    confidence: { type: Number }, // 0-1 score from Vision API
    source:     { type: String }, // e.g. 'google_vision'
  }],
  imageTaggingStatus: {
    type: String,
    enum: ["not_applicable", "pending", "completed", "failed"],
    default: "not_applicable",
  },
  imageTaggedAt: { type: Date },

  // --- Document Summarisation (planned) --------------------------------------
  summary: {
    status:       {
      type: String,
      enum: ["not_available", "not_requested", "pending", "completed", "failed"],
      default: "not_available",
    },
    lengthOption: { type: String },
    wordLimit:    { type: Number },
    text:         { type: String },  // AI generated summary
    generatedAt:  { type: Date },
    model:        { type: String },  // e.g. 'gemini-1.5-flash'
    error:        { type: String },
  },

  // --- Soft Delete ------------------------------------------------------------
  deletedAt: { type: Date, default: null },

}, { timestamps: true }); // adds createdAt and updatedAt

fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ userId: 1, uploadStatus: 1 });

export const Files = mongoose.model("Files", fileSchema);
