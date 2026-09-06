import { useEffect, useState } from "react";
import { CATEGORIES } from "../../../data/appData";
import {
  catColor as getCategoryColor,
  catIcon as getCategoryIcon,
} from "../../../utils/fileUtils";
import { ThumbPreview } from "../preview/ThumbPreview";
import { download } from "../../../utils/apiClient";
import "./DetailPanel.css";

const catColor = (id) => getCategoryColor(CATEGORIES, id);
const catIcon = (id) => getCategoryIcon(CATEGORIES, id);
const SUMMARY_LENGTH_OPTIONS = [
  { value: "short", label: "Short", words: 20 },
  { value: "medium", label: "Medium", words: 100 },
  { value: "long", label: "Long", words: 200 },
];

export function DetailPanel({
  file,
  aiEnabled,
  onClose,
  onUpdate,
  onDelete,
  onSummarize,
  onPreview,
}) {
  const [description, setDescription] = useState(file.description);
  const [tags, setTags] = useState(file.tags ?? []);
  const [newTag, setNewTag] = useState("");
  const [summaryLength, setSummaryLength] = useState(
    file.summary?.lengthOption ?? "medium",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const cc = catColor(file.category);
  const isArchived = file.category === "archives";
  const hasDescriptionChanged = description !== file.description;
  const hasTagsChanged =
    JSON.stringify(tags) !== JSON.stringify(file.tags ?? []);
  const categoryLabel =
    CATEGORIES.find((category) => category.id === file.category)?.label ??
    file.category;
  const fileTags = tags;
  const canEditTags =
    aiEnabled && ["completed", "failed"].includes(file.imageTaggingStatus);
  const tagLimitReached = fileTags.length >= 10;
  const canDownload = Boolean(file.downloadUrl);
  const isSupportedSummaryType = ["txt", "docx"].includes(
    (file.name.split(".").pop() || "").toLowerCase(),
  );
  const canSummarize =
    aiEnabled &&
    !file.isDemo &&
    isSupportedSummaryType &&
    file.summary?.status !== "pending";
  const tagMessage =
    file.category !== "photos"
      ? "AI tag editing is only available for image files."
      : !aiEnabled
        ? "AI is disabled in settings."
        : file.imageTaggingStatus === "pending"
          ? "AI tag generation is still running for this image."
          : file.imageTaggingStatus === "failed"
            ? "AI tag generation failed. Use Live Activity to retry, or edit tags manually."
            : "Tag editing becomes available after AI tag generation completes.";
  const summaryMessage = !aiEnabled
    ? "AI is disabled in settings."
    : file.isDemo
      ? "Document summarization is unavailable for demo files."
      : !isSupportedSummaryType
        ? "This filetype is currently unsupported."
        : file.summary?.status === "pending"
          ? "Document summarization is currently running."
          : file.summary?.status === "failed"
            ? file.summary?.error || "Document summarization failed."
            : file.summary?.text || "No summary generated yet.";

  useEffect(() => {
    setDescription(file.description);
    setTags(file.tags ?? []);
    setNewTag("");
    setSummaryLength(file.summary?.lengthOption ?? "medium");
  }, [file.description, file.id, file.tags, file.summary?.lengthOption]);

  const archiveFile = () => {
    if (isArchived) return;
    onUpdate({ ...file, category: "archives" });
  };

  const saveDescription = async () => {
    if (!hasDescriptionChanged || isSaving) return;

    setIsSaving(true);
    try {
      await onUpdate({ ...file, description });
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    const normalizedTag = newTag.trim().toLowerCase();
    if (!normalizedTag || fileTags.includes(normalizedTag) || tagLimitReached)
      return;

    setTags((current) => [...current, normalizedTag]);
    setNewTag("");
  };

  const removeTag = (tagToRemove) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  };

  const saveTags = async () => {
    if (!canEditTags || !hasTagsChanged || isSavingTags) return;

    setIsSavingTags(true);
    try {
      await onUpdate({ ...file, tags });
    } finally {
      setIsSavingTags(false);
    }
  };

  const downloadFile = async() => {
    if (!canDownload) return;

    const response = await download(file.id);
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summarizeFile = async () => {
    if (!canSummarize) return;
    await onSummarize(file, summaryLength);
  };

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <div className="detail-panel__label">FILE INFO</div>
        <button className="detail-panel__close" onClick={onClose}>
          x
        </button>
      </div>
      <ThumbPreview file={file} onPreview={onPreview} />
      <div>
        <div className="detail-panel__title">{file.name}</div>
        <div className="detail-panel__meta">
          {file.size} - {new Date(file.ts).toLocaleString()}
        </div>
      </div>
      <div>
        <div className="detail-panel__section-label">DESCRIPTION</div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="detail-panel__description-input"
        />
        <button
          className="detail-panel__save"
          onClick={saveDescription}
          disabled={!hasDescriptionChanged || isSaving}
        >
          {isSaving ? "Saving..." : "Save Description"}
        </button>
      </div>
      <div>
        <div className="detail-panel__section-label">CATEGORY</div>
        <div
          className="detail-panel__category"
          style={{
            "--accent-bg": `${cc}18`,
            "--accent-border": `${cc}30`,
            "--accent-tag": `${cc}CC`,
          }}
        >
          {catIcon(file.category)} {categoryLabel}
        </div>
      </div>
      {aiEnabled && file.category === "photos" && (
        <div>
          <div className="detail-panel__section-label">TAGS</div>
          {canEditTags ? (
            <>
              {fileTags.length > 0 ? (
                <div className="detail-panel__tags">
                  {fileTags.map((tag) => (
                    <span
                      key={tag}
                      className="detail-panel__tag detail-panel__tag--editable"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        className="detail-panel__tag-remove"
                        onClick={() => removeTag(tag)}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="detail-panel__empty-tags">
                  No tags available.
                </div>
              )}
              <div className="detail-panel__tag-editor">
                <input
                  className="detail-panel__tag-input"
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  placeholder={
                    tagLimitReached ? "Tag limit reached" : "Add a tag"
                  }
                  disabled={tagLimitReached}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                />
                <button
                  type="button"
                  className="detail-panel__tag-add"
                  onClick={addTag}
                  disabled={
                    !newTag.trim() ||
                    tagLimitReached ||
                    fileTags.includes(newTag.trim().toLowerCase())
                  }
                >
                  Add
                </button>
              </div>
              <div className="detail-panel__tag-limit">
                {fileTags.length}/10 tags
              </div>
              <button
                className="detail-panel__save"
                onClick={saveTags}
                disabled={!hasTagsChanged || isSavingTags}
              >
                {isSavingTags ? "Saving Tags..." : "Save Tags"}
              </button>
            </>
          ) : (
            <div className="detail-panel__empty-tags">{tagMessage}</div>
          )}
        </div>
      )}
      {aiEnabled && file.category === "documents" && (
        <div>
          <div className="detail-panel__section-label">SUMMARY</div>
          <div className="detail-panel__summary">{summaryMessage}</div>
          <div className="detail-panel__summary-lengths">
            {SUMMARY_LENGTH_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="detail-panel__summary-length"
              >
                <input
                  type="radio"
                  name={`summary-length-${file.id}`}
                  value={option.value}
                  checked={summaryLength === option.value}
                  onChange={(event) => setSummaryLength(event.target.value)}
                  disabled={
                    !isSupportedSummaryType ||
                    file.summary?.status === "pending"
                  }
                />
                <span>
                  {option.label} ({option.words} words)
                </span>
              </label>
            ))}
          </div>
          <button
            className="detail-panel__summary-button"
            onClick={summarizeFile}
            disabled={!canSummarize}
          >
            {file.summary?.status === "pending"
              ? "Summarizing..."
              : "Summarize Document"}
          </button>
        </div>
      )}
      <div className="detail-panel__actions">
        <button
          className="detail-panel__preview"
          onClick={() => onPreview(file)}
          style={{
            "--accent-bg": `${cc}18`,
            "--accent-preview-border": `${cc}33`,
            "--accent-solid": cc,
          }}
        >
          Preview
        </button>
        <button
          className="detail-panel__download"
          onClick={downloadFile}
          disabled={!canDownload}
        >
          Download
        </button>
        <button
          className="detail-panel__archive"
          onClick={archiveFile}
          disabled={isArchived}
        >
          {isArchived ? "Archived" : "Archive"}
        </button>
        <button className="detail-panel__delete" onClick={() => onDelete(file)}>
          Delete
        </button>
      </div>
    </div>
  );
}
