import {
  catColor as getCategoryColor,
  catIcon as getCategoryIcon,
  formatTime,
  getPreviewType,
} from "../../../utils/fileUtils";
import { CATEGORIES } from "../../../data/appData";
import { PreviewContent } from "./PreviewContent";
import "./PreviewModal.css";

const catColor = (id) => getCategoryColor(CATEGORIES, id);
const catIcon = (id) => getCategoryIcon(CATEGORIES, id);

export function PreviewModal({ file, onClose }) {
  const cc = catColor(file.category);
  const previewType = getPreviewType(file.name);
  const ext = file.name.split(".").pop().toLowerCase();

  return (
    <div onClick={onClose} className="preview-modal-overlay">
      <div
        onClick={(e) => e.stopPropagation()}
        className={`preview-modal-content preview-modal-content--${previewType} preview-modal-content--${ext}`}
      >
        <div className="preview-modal-header">
          <div
            className="preview-modal-category-icon"
            style={{
              background: `radial-gradient(circle,${cc}33,${cc}11)`,
              border: `1.5px solid ${cc}44`,
            }}
          >
            {catIcon(file.category)}
          </div>
          <div className="preview-modal-file-info">
            <div className="preview-modal-file-name">{file.name}</div>
            <div className="preview-modal-file-meta">
              {file.size} · {formatTime(file.ts)}
            </div>
          </div>
          <button onClick={onClose} className="preview-modal-close-btn">
            ×
          </button>
        </div>

        <PreviewContent file={file} />

        <div className="preview-modal-footer">
          {(() => {
            const categoryLabel =
              CATEGORIES.find((c) => c.id === file.category)?.label ??
              file.category;
            return (
              <span
                className="preview-modal-category-tag"
                style={{
                  background: `${cc}18`,
                  border: `1px solid ${cc}30`,
                  color: `${cc}CC`,
                }}
              >
                {categoryLabel}
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
