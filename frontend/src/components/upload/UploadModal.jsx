import { useEffect, useRef, useState } from "react";
import { CATEGORIES, EXT_MAP } from "../../data/appData";
import {
  catColor as getCategoryColor,
  catIcon as getCategoryIcon,
  guessCategory as getGuessedCategory,
  getPreviewType,
} from "../../utils/fileUtils";
import { upload } from "../../utils/apiClient";
import { PreviewModal } from "../vault/preview/PreviewModal";
import { ThumbPreview } from "../vault/preview/ThumbPreview";
import "./UploadModal.css";

const catColor = (id) => getCategoryColor(CATEGORIES, id);
const catIcon = (id) => getCategoryIcon(CATEGORIES, id);
const guessCategory = (name) => getGuessedCategory(EXT_MAP, name);
const SUMMARY_LENGTH_OPTIONS = [
  { value: "short", label: "Short", words: 20 },
  { value: "medium", label: "Medium", words: 100 },
  { value: "long", label: "Long", words: 200 },
];

const splitFileName = (fileName) => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) {
    return { baseName: fileName, extension: "" };
  }

  return {
    baseName: fileName.slice(0, lastDot),
    extension: fileName.slice(lastDot),
  };
};

export function UploadModal({ onClose, onAccept, scanEnabled, aiEnabled }) {
  const [phase, setPhase] = useState("drop");
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [dataUrl, setDataUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editFileName, setEditFileName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [summarizeDocument, setSummarizeDocument] = useState(false);
  const [summaryLength, setSummaryLength] = useState("medium");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef();
  const backdropClickRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const readDataUrl = (file, onProgress) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.round((event.loaded * 100) / event.total));
      };
      reader.onload = (event) => resolve(event.target.result);
      reader.readAsDataURL(file);
    });

  const processFile = async (file) => {
    const category = guessCategory(file.name);
    const sizeStr =
      file.size > 1e6
        ? `${(file.size / 1e6).toFixed(1)} MB`
        : `${(file.size / 1e3).toFixed(0)} KB`;
    setPhase("analyzing");
    setProcessingProgress(0);
    const url = await readDataUrl(file, setProcessingProgress);
    const nextPreviewUrl = URL.createObjectURL(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setUploadError("");
    setPendingFile(file);
    setDataUrl(url);
    setPreviewUrl(nextPreviewUrl);
    setPending({ name: file.name, size: sizeStr, category });
    setEditFileName(splitFileName(file.name).baseName);
    setEditDesc("");
    setSummarizeDocument(false);
    setSummaryLength("medium");
    setShowPreview(false);
    setProcessingProgress(100);
    setPhase("review");
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleAccept = async () => {
    if (!pending || !pendingFile || isUploading) return;
    if (!editFileName.trim()) {
      setUploadError("Filename cannot be empty.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadProgress(0);

    try {
      const { extension } = splitFileName(pendingFile.name);
      const normalizedFileName = `${editFileName.trim()}${extension}`;
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("originalName", normalizedFileName);
      formData.append("category", pending.category);
      formData.append("description", editDesc.trim() || normalizedFileName);
      formData.append("summarizeDocument", String(aiEnabled && summarizeDocument));
      formData.append("summaryLength", summaryLength);

      await upload(`/upload?scanEnabled=${scanEnabled}`, formData, setUploadProgress);

      await onAccept();
      onClose();
    } catch (error) {
      setUploadError(
        error.response?.data?.error || "File upload failed. Please try again."
      );
      console.error("File upload failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  const cc = pending ? catColor(pending.category) : "#7C3AED";
  const { extension } = pendingFile
    ? splitFileName(pendingFile.name)
    : { extension: "" };
  const displayName = `${editFileName}${extension}`;
  const previewType = getPreviewType(pendingFile?.name || pending?.name || "");
  const canSummarizeDocument =
    aiEnabled &&
    pending?.category === "documents" &&
    [".txt", ".docx"].includes(extension.toLowerCase());
  const uploadPreviewAvailable =
    !scanEnabled && Boolean(previewUrl) && previewType !== "none";
  const uploadPreviewFile =
    pending && pendingFile
      ? {
          id: "upload-preview",
          name: displayName,
          category: pending.category,
          size: pending.size,
          ts: Date.now(),
          localPreviewUrl: previewUrl,
        }
      : null;
  const showUploadThumbnailPreview = !scanEnabled && Boolean(uploadPreviewFile);

  return (
    <>
      <div
        className="upload-modal-overlay"
        onMouseDown={(event) => {
          backdropClickRef.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (backdropClickRef.current && event.target === event.currentTarget) {
            onClose();
          }
          backdropClickRef.current = false;
        }}
      >
        <div
          className={`upload-modal-content ${phase === "review" ? "review-phase" : ""}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="upload-modal-header">
            <div className="upload-modal-title">
              {phase === "drop" && "Upload a File"}
              {phase === "analyzing" && "Analyzing..."}
              {phase === "review" && "Review & Confirm"}
            </div>
            <button onClick={onClose} className="upload-modal-close-btn">
              x
            </button>
          </div>

          {phase === "drop" && (
            <div className="upload-modal-drop-zone">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current.click()}
                className={`upload-modal-drop-area ${dragOver ? "drag-over" : ""}`}
              >
                <div className="upload-modal-drop-icon">+</div>
                <div className="upload-modal-drop-text">Drop your file here</div>
                <div className="upload-modal-drop-subtext">
                  or click to browse - any file type
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  className="upload-modal-file-input"
                  onChange={async (event) => {
                    const file = event.target.files[0];
                    if (file) {
                      await processFile(file);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {phase === "analyzing" && (
            <div className="upload-modal-analyzing">
              <div className="upload-modal-analyzing-filename">
                {pending?.name}
              </div>
              <div className="upload-modal-analyzing-spinner" />
              <div className="upload-modal-analyzing-steps">
                {[
                  "Detecting file type",
                  "Preparing preview",
                  "Assigning category",
                ].map((step, index) => (
                  <div
                    key={step}
                    className="upload-modal-analyzing-step"
                    style={{ animationDelay: `${index * 0.3}s` }}
                  >
                    {step}
                  </div>
                ))}
              </div>
              <div className="upload-modal-progress-bar">
                <div
                  className="upload-modal-progress-fill upload-modal-progress-fill--determinate"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <div className="upload-modal-progress-label">
                Preparing file... {processingProgress}%
              </div>
            </div>
          )}

          {phase === "review" && pending && (
            <div className="upload-modal-review">
              <div className="upload-modal-ai-badge category-detected">
                CATEGORY DETECTED - REVIEW BELOW
              </div>

              <div className="upload-modal-file-preview">
                {showUploadThumbnailPreview ? (
                  <ThumbPreview
                    file={uploadPreviewFile}
                    onPreview={() => setShowPreview(true)}
                    height={70}
                    className="upload-modal-thumb-preview"
                  />
                ) : (
                  <div
                    className="upload-modal-file-thumbnail"
                    style={{
                      background: `radial-gradient(circle,${cc}22,${cc}08)`,
                      border: `1px solid ${cc}22`,
                    }}
                  >
                    <div className="upload-modal-thumbnail-icon">
                      {catIcon(pending.category)}
                    </div>
                  </div>
                )}

                <div className="upload-modal-file-info">
                  <div className="upload-modal-file-name">{displayName}</div>
                  <div className="upload-modal-file-details">
                    {pending.size} -{" "}
                    {CATEGORIES.find((category) => category.id === pending.category)?.label}
                  </div>

                  {uploadPreviewAvailable ? (
                    <button
                      type="button"
                      className="upload-modal-preview-button"
                      onClick={() => setShowPreview(true)}
                      style={{
                        color: `${cc}CC`,
                        borderColor: `${cc}30`,
                        background: `${cc}12`,
                      }}
                    >
                      Open Preview
                    </button>
                  ) : (
                    <div
                      className="upload-modal-preview-note"
                      style={{ color: `${cc}99` }}
                    >
                      {scanEnabled
                        ? "Preview is available only when Shield Scan is off."
                        : "Preview not available for this file type."}
                    </div>
                  )}
                </div>
              </div>

              <div className="upload-modal-description-section">
                <div className="upload-modal-section-header">
                  <div className="upload-modal-section-label">FILENAME</div>
                  <button
                    type="button"
                    className="upload-modal-filename-reset"
                    onClick={() => {
                      setEditFileName(splitFileName(pendingFile.name).baseName);
                      setUploadError("");
                    }}
                    title="Reset filename"
                  >
                    ↻
                  </button>
                </div>
              </div>

              <div className="upload-modal-filename-section">
                <input
                  value={editFileName}
                  onChange={(event) => {
                    setEditFileName(event.target.value);
                    setUploadError("");
                  }}
                  className="upload-modal-filename-input"
                />
                {extension && (
                  <div className="upload-modal-filename-extension">{extension}</div>
                )}
              </div>

              <div className="upload-modal-description-section">
                <div className="upload-modal-section-label">DESCRIPTION</div>
                <textarea
                  value={editDesc}
                  onChange={(event) => setEditDesc(event.target.value)}
                  placeholder={displayName}
                  rows={3}
                  className="upload-modal-description-textarea"
                />
              </div>

              <div className="upload-modal-category-section">
                <div className="upload-modal-section-label">CATEGORY</div>
                <div
                  className="upload-modal-category-badge"
                  style={{
                    background: `${cc}18`,
                    border: `1px solid ${cc}30`,
                    color: `${cc}CC`,
                  }}
                >
                  {catIcon(pending.category)}{" "}
                  {CATEGORIES.find((category) => category.id === pending.category)?.label}
                </div>
              </div>

              {canSummarizeDocument && (
                <div className="upload-modal-summary-options">
                  <label className="upload-modal-summary-toggle">
                    <input
                      type="checkbox"
                      checked={summarizeDocument}
                      onChange={(event) => setSummarizeDocument(event.target.checked)}
                    />
                    <span>Enable document summary</span>
                  </label>
                  <div className="upload-modal-summary-lengths">
                    {SUMMARY_LENGTH_OPTIONS.map((option) => (
                      <label key={option.value} className="upload-modal-summary-length">
                        <input
                          type="radio"
                          name="summary-length"
                          value={option.value}
                          checked={summaryLength === option.value}
                          onChange={(event) => setSummaryLength(event.target.value)}
                          disabled={!summarizeDocument}
                        />
                        <span>{option.label} ({option.words} words)</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="upload-modal-actions">
                {uploadError && (
                  <div className="upload-modal-error">
                    {uploadError}
                  </div>
                )}
                {isUploading && (
                  <div className="upload-modal-upload-progress">
                    <div className="upload-modal-upload-progress-row">
                      <div className="upload-modal-upload-spinner" />
                      <span>Uploading file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="upload-modal-progress-bar upload-modal-progress-bar--upload">
                      <div
                        className="upload-modal-progress-fill upload-modal-progress-fill--determinate"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <button onClick={onClose} className="upload-modal-cancel-btn">
                  Cancel
                </button>
                <button
                  onClick={handleAccept}
                  className="upload-modal-accept-btn"
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading..." : "Accept & Upload"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPreview && uploadPreviewFile && (
        <PreviewModal
          file={uploadPreviewFile}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
