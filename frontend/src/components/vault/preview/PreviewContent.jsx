import { useEffect, useRef, useState } from "react";
import {
  catColor as getCategoryColor,
  catIcon as getCategoryIcon,
  getPreviewType,
} from "../../../utils/fileUtils";
import {
  docxToHtml,
  pptxToHtml,
  renderDocxPreview,
  renderPptxPreview,
  xlsxToSheetHtml,
} from "../../../utils/documentPreview";
import { CATEGORIES } from "../../../data/appData";
import { download } from "../../../utils/apiClient";
import { getValidAccessToken } from "../../../utils/tokenManager";

const catColor = (id) => getCategoryColor(CATEGORIES, id);
const catIcon = (id) => getCategoryIcon(CATEGORIES, id);

const isDirectPreviewUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("blob:") || url.startsWith("data:"));

export function PreviewContent({ file }) {
  const type = getPreviewType(file.name);
  const cc = catColor(file.category);
  const ext = file.name.split(".").pop().toUpperCase();
  const sourceUrl = file.localPreviewUrl || file.dataUrl || file.previewUrl;
  const directPreviewUrl = isDirectPreviewUrl(sourceUrl) ? sourceUrl : null;
  const canDownload = Boolean(file.downloadUrl);
  const [docContent, setDocContent] = useState(null);
  const [textContent, setTextContent] = useState("");
  const [xlsxSheets, setXlsxSheets] = useState([]);
  const [activeXlsxSheet, setActiveXlsxSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageBlobUrl, setImageBlobUrl] = useState(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const showOfficeContainer = type === "office";
  const showOfficeRenderer =
    ["DOCX", "PPTX"].includes(ext) && Boolean(sourceUrl);
  const officePreviewRef = useRef(null);
  const officePreviewerRef = useRef(null);

  useEffect(() => {
    let active = true;
    const objectUrls = [];

    const registerObjectUrl = (blob) => {
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);
      return objectUrl;
    };

    const resetPreviewState = ({
      docContent = null,
      textContent = "",
      xlsxSheets = [],
      activeXlsxSheet = 0,
      image = null,
      video = null,
      audio = null,
      pdf = null,
    } = {}) => {
      setDocContent(docContent);
      setTextContent(textContent);
      setXlsxSheets(xlsxSheets);
      setActiveXlsxSheet(activeXlsxSheet);
      setImageBlobUrl(image);
      setVideoBlobUrl(video);
      setAudioBlobUrl(audio);
      setPdfBlobUrl(pdf);
    };

    const loadContent = async () => {
      if (!sourceUrl) {
        resetPreviewState();
        setError(null);
        setLoading(false);
        return;
      }

      if (type === "image") {
        resetPreviewState({ image: imageBlobUrl });

        if (directPreviewUrl) {
          setImageBlobUrl(null);
          setError(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);
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
        } catch (err) {
          if (active) {
            setError(err.message);
            setImageBlobUrl(null);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
        return;
      }

      if (type === "video") {
        resetPreviewState({ video: videoBlobUrl });

        if (directPreviewUrl) {
          setVideoBlobUrl(null);
          setError(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);
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
        } catch (err) {
          if (active) {
            setError(err.message);
            setVideoBlobUrl(null);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
        return;
      }

      if (type === "audio") {
        resetPreviewState({ audio: audioBlobUrl });

        if (directPreviewUrl) {
          setAudioBlobUrl(null);
          setError(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);
        try {
          const token = await getValidAccessToken();
          const response = await fetch(sourceUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            throw new Error(`Failed to load audio: ${response.status}`);
          }
          const blob = await response.blob();
          if (active) {
            setAudioBlobUrl(registerObjectUrl(blob));
          }
        } catch (err) {
          if (active) {
            setError(err.message);
            setAudioBlobUrl(null);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
        return;
      }

      if (type === "pdf") {
        resetPreviewState({ pdf: pdfBlobUrl });

        if (directPreviewUrl) {
          setPdfBlobUrl(null);
          setError(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);
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
        } catch (err) {
          if (active) {
            setError(err.message);
            setPdfBlobUrl(null);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
        return;
      }

      if (!["office", "text"].includes(type)) {
        resetPreviewState();
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      resetPreviewState();

      try {
        if (officePreviewerRef.current?.destroy) {
          officePreviewerRef.current.destroy();
          officePreviewerRef.current = null;
        }

        if (officePreviewRef.current) {
          officePreviewRef.current.innerHTML = "";
        }

        if (type === "text") {
          const token = await getValidAccessToken();
          const response = await fetch(sourceUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const text = await response.text();
          if (active) {
            setTextContent(text);
          }
        } else if (ext === "DOCX") {
          try {
            await renderDocxPreview(sourceUrl, officePreviewRef.current);
          } catch {
            const html = await docxToHtml(sourceUrl);
            if (active) {
              setDocContent(html);
            }
          }
        } else if (ext === "PPTX") {
          try {
            officePreviewerRef.current = await renderPptxPreview(
              sourceUrl,
              officePreviewRef.current,
            );
          } catch {
            const html = await pptxToHtml(sourceUrl);
            if (active) {
              setDocContent(html);
            }
          }
        } else if (ext === "XLSX") {
          const sheets = await xlsxToSheetHtml(sourceUrl);
          if (active) {
            setXlsxSheets(sheets);
            setDocContent(sheets[0]?.html ?? "");
          }
        } else if (active) {
          setError(`No preview for .${ext.toLowerCase()} files`);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadContent();
    return () => {
      active = false;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      if (officePreviewerRef.current?.destroy) {
        officePreviewerRef.current.destroy();
        officePreviewerRef.current = null;
      }
    };
  }, [directPreviewUrl, ext, sourceUrl, type]);

  useEffect(() => {
    if (ext !== "XLSX" || !xlsxSheets.length) return;
    setDocContent(xlsxSheets[activeXlsxSheet]?.html ?? "");
  }, [activeXlsxSheet, ext, xlsxSheets]);

  const downloadFile = async () => {
    if (!canDownload) return;

    const response = await download(file.id);
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="preview-modal-body">
      {type === "image" && (imageBlobUrl || directPreviewUrl) && (
        <img
          src={imageBlobUrl || directPreviewUrl}
          alt={file.name}
          className="preview-modal-image"
        />
      )}
      {type === "image" && loading && (
        <div className="preview-modal-loading">
          <div className="preview-modal-loading-text">Loading image...</div>
          <div className="preview-modal-spinner" />
        </div>
      )}
      {type === "image" && error && (
        <div className="preview-modal-error">
          <div className="preview-modal-error-title">Error loading image</div>
          <div className="preview-modal-error-message">{error}</div>
          <button
            onClick={downloadFile}
            disabled={!canDownload}
            className="preview-modal-download-btn"
          >
            â†“ Download Instead
          </button>
        </div>
      )}
      {type === "video" && (videoBlobUrl || directPreviewUrl) && (
        <video controls autoPlay className="preview-modal-video">
          <source src={videoBlobUrl || directPreviewUrl} />
        </video>
      )}
      {type === "video" && loading && (
        <div className="preview-modal-loading">
          <div className="preview-modal-loading-text">Loading video...</div>
          <div className="preview-modal-spinner" />
        </div>
      )}
      {type === "video" && error && (
        <div className="preview-modal-error">
          <div className="preview-modal-error-title">Error loading video</div>
          <div className="preview-modal-error-message">{error}</div>
          <button
            onClick={downloadFile}
            disabled={!canDownload}
            className="preview-modal-download-btn"
          >
            â†“ Download Instead
          </button>
        </div>
      )}
      {type === "audio" && (audioBlobUrl || directPreviewUrl) && (
        <div className="preview-modal-audio-container">
          <div className="preview-modal-audio-icon">♪</div>
          <div className="preview-modal-audio-name">{file.name}</div>
          <audio controls autoPlay className="preview-modal-audio-player">
            <source src={audioBlobUrl || directPreviewUrl} />
          </audio>
        </div>
      )}
      {type === "audio" && loading && (
        <div className="preview-modal-loading">
          <div className="preview-modal-loading-text">Loading audio...</div>
          <div className="preview-modal-spinner" />
        </div>
      )}
      {type === "audio" && error && (
        <div className="preview-modal-error">
          <div className="preview-modal-error-title">Error loading audio</div>
          <div className="preview-modal-error-message">{error}</div>
          <button
            onClick={downloadFile}
            disabled={!canDownload}
            className="preview-modal-download-btn"
          >
            â†“ Download Instead
          </button>
        </div>
      )}
      {type === "pdf" && (pdfBlobUrl || directPreviewUrl) && (
        <iframe
          src={pdfBlobUrl || directPreviewUrl}
          className="preview-modal-pdf"
          title={file.name}
        />
      )}
      {showOfficeContainer && sourceUrl && (
        <div className="preview-modal-document-container">
          {showOfficeRenderer && (
            <div
              ref={officePreviewRef}
              className="preview-modal-office-content"
            />
          )}
          {loading && (
            <div className="preview-modal-loading">
              <div className="preview-modal-loading-text">
                Loading {ext} preview...
              </div>
              <div className="preview-modal-spinner" />
            </div>
          )}
          {error && (
            <div className="preview-modal-error">
              <div className="preview-modal-error-title">
                Error loading office document
              </div>
              <div className="preview-modal-error-message">{error}</div>
              <button
                onClick={downloadFile}
                disabled={!canDownload}
                className="preview-modal-download-btn"
              >
                â†“ Download Instead
              </button>
            </div>
          )}
          {docContent && !loading && !error && (
            <div
              className={`preview-modal-doc-content preview-modal-doc-content--${ext.toLowerCase()}`}
            >
              {ext === "XLSX" && xlsxSheets.length > 1 && (
                <div className="preview-modal-sheet-tabs">
                  {xlsxSheets.map((sheet, index) => (
                    <button
                      key={sheet.name}
                      type="button"
                      className={`preview-modal-sheet-tab${
                        index === activeXlsxSheet
                          ? " preview-modal-sheet-tab--active"
                          : ""
                      }`}
                      onClick={() => setActiveXlsxSheet(index)}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}
              <div dangerouslySetInnerHTML={{ __html: docContent }} />
            </div>
          )}
        </div>
      )}
      {type === "text" && sourceUrl && (
        <div className="preview-modal-document-container">
          {loading && (
            <div className="preview-modal-loading">
              <div className="preview-modal-loading-text">
                Loading text preview...
              </div>
              <div className="preview-modal-spinner" />
            </div>
          )}
          {error && (
            <div className="preview-modal-error">
              <div className="preview-modal-error-title">
                Error loading office document
              </div>
              <div className="preview-modal-error-message">{error}</div>
              <button
                onClick={downloadFile}
                disabled={!canDownload}
                className="preview-modal-download-btn"
              >
                â†“ Download Instead
              </button>
            </div>
          )}
          {!loading && !error && (
            <pre className="preview-modal-text-content">{textContent}</pre>
          )}
        </div>
      )}
      {!sourceUrl && (
        <div className="preview-modal-no-preview">
          <div
            className="preview-modal-no-preview-icon"
            style={{
              background: `radial-gradient(circle at 35% 35%,${cc}33,${cc}11)`,
              border: `2px solid ${cc}44`,
              boxShadow: `0 0 40px ${cc}22`,
            }}
          >
            {catIcon(file.category)}
          </div>
          <div className="preview-modal-no-preview-text">
            Preview not available
          </div>
          <div className="preview-modal-no-preview-subtext">
            This file is still pending processing or does not have preview
            content.
          </div>
        </div>
      )}
      {type === "none" && sourceUrl && (
        <div className="preview-modal-no-preview">
          <div
            className="preview-modal-no-preview-icon"
            style={{
              borderRadius: 16,
              background: `radial-gradient(circle at 35% 35%,${cc}33,${cc}11)`,
              border: `2px solid ${cc}44`,
              fontWeight: 700,
              color: cc,
              fontSize: 22,
            }}
          >
            .{ext.toLowerCase()}
          </div>
          <div className="preview-modal-no-preview-text">
            No preview for .{ext.toLowerCase()} files
          </div>
          <button
            onClick={downloadFile}
            disabled={!canDownload}
            className="preview-modal-no-preview-download"
            style={{
              background: `${cc}22`,
              border: `1px solid ${cc}44`,
              color: cc,
            }}
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
}
