import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "../../../data/appData";
import {
  catColor as getCategoryColor,
  catIcon as getCategoryIcon,
  getPreviewType,
} from "../../../utils/fileUtils";
import { getValidAccessToken } from "../../../utils/tokenManager";
import {
  docxToHtml,
  pptxToHtml,
  renderPptxPreview,
  xlsxToHtml,
} from "../../../utils/documentPreview";
import "../detail/DetailPanel.css";

const catColor = (id) => getCategoryColor(CATEGORIES, id);
const catIcon = (id) => getCategoryIcon(CATEGORIES, id);

const isDirectPreviewUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("blob:") || url.startsWith("data:"));

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ThumbPreview({
  file,
  onPreview,
  height = 120,
  clickable = true,
  className = "",
}) {
  const cc = catColor(file.category);
  const previewType = getPreviewType(file.name);
  const sourceUrl = file.localPreviewUrl || file.dataUrl || file.previewUrl;
  const ext = file.name.split(".").pop().toUpperCase();
  const [textSnippet, setTextSnippet] = useState("");
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const officeThumbRef = useRef(null);
  const officePreviewerRef = useRef(null);
  const directPreviewUrl = isDirectPreviewUrl(sourceUrl) ? sourceUrl : null;
  const showTextSnippet =
    ["text", "office"].includes(previewType) &&
    !["PPTX"].includes(ext) &&
    textSnippet;
  const showOfficeThumb = sourceUrl && ["PPTX"].includes(ext);

  useEffect(() => {
    let active = true;
    const objectUrls = [];

    const registerObjectUrl = (blob) => {
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);
      return objectUrl;
    };

    const resetPreviewState = ({ image = null, video = null, pdf = null } = {}) => {
      setTextSnippet("");
      setSnippetLoading(false);
      setImageBlobUrl(image);
      setVideoBlobUrl(video);
      setPdfBlobUrl(pdf);
    };

    const loadSnippet = async () => {
      if (!sourceUrl) {
        resetPreviewState();
        return;
      }

      if (previewType === "image") {
        resetPreviewState({ image: imageBlobUrl });

        if (directPreviewUrl) {
          setImageBlobUrl(null);
          return;
        }

        try {
          const token = await getValidAccessToken();
          const response = await fetch(sourceUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            throw new Error(`Failed to load image: ${response.status}`);
          }
          const blob = await response.blob();
          if (active) {
            setImageBlobUrl(registerObjectUrl(blob));
          }
        } catch {
          if (active) {
            setImageBlobUrl(null);
          }
        }
        return;
      }

      if (previewType === "video") {
        resetPreviewState({ video: videoBlobUrl });

        if (directPreviewUrl) {
          setVideoBlobUrl(null);
          return;
        }

        try {
          const token = await getValidAccessToken();
          const response = await fetch(sourceUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            throw new Error(`Failed to load video: ${response.status}`);
          }
          const blob = await response.blob();
          if (active) {
            setVideoBlobUrl(registerObjectUrl(blob));
          }
        } catch {
          if (active) {
            setVideoBlobUrl(null);
          }
        }
        return;
      }

      if (previewType === "pdf") {
        resetPreviewState({ pdf: pdfBlobUrl });

        if (directPreviewUrl) {
          setPdfBlobUrl(null);
          return;
        }

        try {
          const token = await getValidAccessToken();
          const response = await fetch(sourceUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            throw new Error(`Failed to load pdf: ${response.status}`);
          }
          const blob = await response.blob();
          if (active) {
            setPdfBlobUrl(registerObjectUrl(blob));
          }
        } catch {
          if (active) {
            setPdfBlobUrl(null);
          }
        }
        return;
      }

      if (!["text", "office"].includes(previewType)) {
        resetPreviewState();
        return;
      }

      setSnippetLoading(true);
      setImageBlobUrl(null);
      setVideoBlobUrl(null);
      setPdfBlobUrl(null);

      try {
        if (officePreviewerRef.current?.destroy) {
          officePreviewerRef.current.destroy();
          officePreviewerRef.current = null;
        }

        if (officeThumbRef.current) {
          officeThumbRef.current.innerHTML = "";
        }

        if (previewType === "text") {
          const token = await getValidAccessToken();
          const response = await fetch(sourceUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const text = await response.text();
          if (active) {
            setTextSnippet(text.trim().slice(0, 220));
          }
        } else if (ext === "DOCX") {
          const html = await docxToHtml(sourceUrl);
          if (active) {
            setTextSnippet(stripHtml(html).slice(0, 220));
          }
        } else if (ext === "PPTX") {
          try {
            officePreviewerRef.current = await renderPptxPreview(
              sourceUrl,
              officeThumbRef.current,
              {
                width: 260,
                height: 146,
                firstSlideOnly: true,
              },
            );
            if (active) {
              setTextSnippet("");
            }
          } catch {
            const html = await pptxToHtml(sourceUrl);
            if (active) {
              setTextSnippet(stripHtml(html).slice(0, 220));
            }
          }
        } else if (ext === "XLSX") {
          const html = await xlsxToHtml(sourceUrl);
          if (active) {
            setTextSnippet(stripHtml(html).slice(0, 220));
          }
        } else if (active) {
          setTextSnippet("");
        }
      } catch {
        if (active) {
          setTextSnippet("");
        }
      } finally {
        if (active) {
          setSnippetLoading(false);
        }
      }
    };

    loadSnippet();
    return () => {
      active = false;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      if (officePreviewerRef.current?.destroy) {
        officePreviewerRef.current.destroy();
        officePreviewerRef.current = null;
      }
    };
  }, [directPreviewUrl, ext, previewType, sourceUrl]);

  return (
    <div
      className={`detail-thumb ${className}`.trim()}
      onClick={
        clickable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreview?.(file);
            }
          : undefined
      }
      style={{
        "--thumb-height": `${height}px`,
        "--thumb-color": cc,
        "--thumb-solid": cc,
        "--thumb-border": `${cc}22`,
        "--thumb-border-solid": `${cc}44`,
        "--thumb-bg-solid": `${cc}11`,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {(imageBlobUrl || directPreviewUrl) && previewType === "image" && (
        <img
          className="detail-thumb__image"
          src={imageBlobUrl || directPreviewUrl}
          alt=""
        />
      )}
      {(videoBlobUrl || directPreviewUrl) && previewType === "video" && (
        <video
          className="detail-thumb__video"
          src={videoBlobUrl || directPreviewUrl}
          muted
          playsInline
          preload="metadata"
          autoPlay
          loop
        />
      )}
      {(pdfBlobUrl || directPreviewUrl) && previewType === "pdf" && (
        <iframe
          className="detail-thumb__pdf"
          src={pdfBlobUrl || directPreviewUrl}
          title={`${file.name} preview`}
        />
      )}
      {showOfficeThumb && (
        <div
          ref={officeThumbRef}
          className={`detail-thumb__office-preview detail-thumb__office-preview--${ext.toLowerCase()}`}
        />
      )}
      {showTextSnippet && (
        <div className="detail-thumb__text-preview">{textSnippet}</div>
      )}
      {snippetLoading && !["image", "video", "pdf"].includes(previewType) && (
        <div className="detail-thumb__text-preview detail-thumb__text-preview--loading">
          Loading preview...
        </div>
      )}
      {(!sourceUrl ||
        (!["image", "video", "pdf"].includes(previewType) &&
          !showOfficeThumb &&
          !showTextSnippet &&
          !snippetLoading)) && (
        <div className="detail-thumb__fallback">{catIcon(file.category)}</div>
      )}
      {clickable && (
        <div className="detail-thumb__overlay">
          <span className="detail-thumb__overlay-label">Click to preview</span>
        </div>
      )}
    </div>
  );
}
