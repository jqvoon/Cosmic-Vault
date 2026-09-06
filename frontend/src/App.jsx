import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "./context/AuthContext";
import "./App.css";
import Avatar from "./utils/Avatar";
import { INITIAL_FILES, STARS } from "./data/appData";
import { ACCENT_COLORS } from "./data/settingsData";
import { findSafePosition } from "./utils/fileUtils";
import { fileApi, subscribeToFileEvents } from "./utils/apiClient";
import { QueueSidebar } from "./components/queues/QueueSidebar";
import {
  SettingsPanel,
  AvatarDropdown,
} from "./components/settings/SettingsPanel";
import { LoginScreen } from "./components/loginScreen/LoginScreen";
import { PreviewModal } from "./components/vault/preview/PreviewModal";
import { UploadModal } from "./components/upload/UploadModal";
import {
  BlobView as SpaceView,
  DetailPanel as FileDetailPanel,
  TimelineView as VaultTimelineView,
} from "./components/vault/VaultViews";

// Flip this off when you want to test with backend data only.
const ENABLE_DEMO_FILES = false;
const SCAN_TOGGLE_STORAGE_KEY = "cosmicvault.scanEnabled";
const AI_TOGGLE_STORAGE_KEY = "cosmicvault.aiEnabled";
const ACTIVITY_HISTORY_LIMIT = 60;
const QUEUE_ACTIVITY_LABELS = {
  scan: "Security Check",
  imageTagging: "Image Analysis",
  textSummarization: "Summarizing Documents",
};

const buildQueueActivityEntries = (previousQueues, nextQueues) => {
  const previousItems = new Map(
    previousQueues.flatMap((queue) =>
      queue.items.map((item) => [item.id, { ...item, queueKey: queue.key }]),
    ),
  );
  const nextItems = new Map(
    nextQueues.flatMap((queue) =>
      queue.items.map((item) => [item.id, { ...item, queueKey: queue.key }]),
    ),
  );
  const entries = [];

  for (const item of nextItems.values()) {
    const previous = previousItems.get(item.id);
    const queueLabel = QUEUE_ACTIVITY_LABELS[item.queueKey] ?? item.queueKey;

    if (!previous) {
      entries.push({ message: `${item.fileName} entered ${queueLabel}.` });
      continue;
    }

    if (previous.status !== item.status) {
      if (item.status === "running") {
        entries.push({ message: `${item.fileName} started ${queueLabel}.` });
      } else if (item.status === "queued") {
        entries.push({
          message: `${item.fileName} was queued for ${queueLabel}.`,
        });
      }
    }
  }

  return entries;
};

const buildFileActivityEntries = (previousFiles, nextFiles) => {
  const previousById = new Map(previousFiles.map((file) => [file.id, file]));
  const entries = [];

  for (const file of nextFiles) {
    const previous = previousById.get(file.id);
    if (!previous) continue;

    if (previous.scanStatus !== file.scanStatus) {
      if (file.scanStatus === "clean")
        entries.push({ message: `Security check passed for ${file.name}.` });
      if (file.scanStatus === "infected")
        entries.push({ message: `Security check flagged ${file.name}.` });
      if (file.scanStatus === "failed")
        entries.push({ message: `Security check failed for ${file.name}.` });
    }

    if (previous.imageTaggingStatus !== file.imageTaggingStatus) {
      if (file.imageTaggingStatus === "completed")
        entries.push({ message: `Image analysis completed for ${file.name}.` });
      if (file.imageTaggingStatus === "failed")
        entries.push({ message: `Image analysis failed for ${file.name}.` });
    }

    const previousSummaryStatus = previous.summary?.status;
    const nextSummaryStatus = file.summary?.status;
    if (previousSummaryStatus !== nextSummaryStatus) {
      if (nextSummaryStatus === "pending")
        entries.push({
          message: `Document summarization started for ${file.name}.`,
        });
      if (nextSummaryStatus === "completed")
        entries.push({
          message: `Document summary generated for ${file.name}.`,
        });
      if (nextSummaryStatus === "failed")
        entries.push({ message: `Document summary failed for ${file.name}.` });
    }
  }

  return entries;
};

const hexToRgba = (hex, alpha) => {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatSize = (size) => {
  if (size >= 1e9) return `${(size / 1e9).toFixed(1)} GB`;
  if (size >= 1e6) return `${(size / 1e6).toFixed(1)} MB`;
  if (size >= 1e3) return `${(size / 1e3).toFixed(0)} KB`;
  return `${size} B`;
};

const trustForFile = (file) => {
  if (file.scanStatus === "clean" || file.scanStatus === "skipped") return 100;
  if (file.scanStatus === "pending") return 65;
  if (file.scanStatus === "failed") return 35;
  if (file.scanStatus === "infected") return 0;
  return 80;
};

const mapBackendFiles = (files) => {
  const positioned = [];

  return files.map((file) => {
    const mapped = {
      id: file.id,
      name: file.originalName,
      category: file.category,
      size: formatSize(file.size),
      ts: new Date(file.createdAt).getTime(),
      trust: trustForFile(file),
      description: file.description || "No description available.",
      tags: file.tags ?? [],
      summary: file.summary ?? {
        status: "not_available",
        text: null,
        generatedAt: null,
        model: null,
        error: null,
      },
      imageTaggingStatus: file.imageTaggingStatus ?? "not_applicable",
      dataUrl: null,
      savedAs: file.savedAs,
      storagePath: file.storagePath,
      uploadStatus: file.uploadStatus,
      scanStatus: file.scanStatus,
      scanEnabled: file.scanEnabled,
      scanError: file.scanError,
      previewUrl:
        file.uploadStatus === "stored" ? `/api/files/${file.id}/content` : null,
      downloadUrl:
        file.uploadStatus === "stored"
          ? file.id
          : null,
      isDemo: false,
    };

    const pos = findSafePosition(positioned);
    const result = { ...mapped, ...pos };
    positioned.push(result);
    return result;
  });
};
const useAuth = () => useContext(AuthContext);

function CosmicVaultApp({ user, onLogout }) {
  const [userFiles, setUserFiles] = useState([]);
  const [demoFiles, setDemoFiles] = useState(() =>
    INITIAL_FILES.map((file) => ({
      ...file,
      id: `demo-${file.id}`,
      isDemo: true,
    })),
  );
  const [activeCategory, setActiveCategory] = useState("categories");
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState("");
  const [photoSearchMode, setPhotoSearchMode] = useState("default");
  const [mode, setMode] = useState("grid");
  const [showQueueSidebar, setShowQueueSidebar] = useState(true);
  const [queueSnapshot, setQueueSnapshot] = useState([]);
  const [activityHistory, setActivityHistory] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [accent, setAccent] = useState(ACCENT_COLORS[0].color);
  const [aiEnabled, setAiEnabled] = useState(() => {
    const stored = window.localStorage.getItem(AI_TOGGLE_STORAGE_KEY);
    return stored !== "false";
  });
  const [scanEnabled, setScanEnabled] = useState(() => {
    const stored = window.localStorage.getItem(SCAN_TOGGLE_STORAGE_KEY);
    return stored === "true";
  });

  const filesWithAiState = useMemo(() => {
    if (aiEnabled) {
      return userFiles;
    }

    return userFiles.map((file) => ({
      ...file,
      tags: [],
      imageTaggingStatus:
        file.category === "photos" ? "not_applicable" : file.imageTaggingStatus,
      summary: {
        ...(file.summary ?? {}),
        status: "not_available",
        lengthOption: null,
        wordLimit: null,
        text: null,
        generatedAt: null,
        model: null,
        error: null,
      },
    }));
  }, [aiEnabled, userFiles]);

  const demoFilesWithAiState = useMemo(() => {
    if (aiEnabled) {
      return demoFiles;
    }

    return demoFiles.map((file) => ({
      ...file,
      tags: [],
      imageTaggingStatus:
        file.category === "photos" ? "not_applicable" : file.imageTaggingStatus,
      summary: {
        status: "not_available",
        lengthOption: null,
        wordLimit: null,
        text: null,
        generatedAt: null,
        model: null,
        error: null,
      },
    }));
  }, [aiEnabled, demoFiles]);

  const files = useMemo(
    () =>
      ENABLE_DEMO_FILES
        ? [...filesWithAiState, ...demoFilesWithAiState]
        : filesWithAiState,
    [demoFilesWithAiState, filesWithAiState],
  );

  const selectedFile = files.find((f) => f.id === selected);
  const visibleQueues = useMemo(
    () =>
      aiEnabled
        ? queueSnapshot
        : queueSnapshot.filter(
            (queue) =>
              !["imageTagging", "textSummarization"].includes(queue.key),
          ),
    [aiEnabled, queueSnapshot],
  );
  const visibleActivityHistory = useMemo(
    () =>
      aiEnabled
        ? activityHistory
        : activityHistory.filter(
            (entry) =>
              !entry.message.includes("Image analysis") &&
              !entry.message.includes("Document summary") &&
              !entry.message.includes("Document summarization") &&
              !entry.message.includes("Summarizing Documents"),
          ),
    [activityHistory, aiEnabled],
  );
  const failedImageAnalysisItems = useMemo(
    () =>
      aiEnabled
        ? files.filter(
            (file) => !file.isDemo && file.imageTaggingStatus === "failed",
          )
        : [],
    [aiEnabled, files],
  );
  const failedSummarizationItems = useMemo(
    () =>
      aiEnabled
        ? files.filter(
            (file) => !file.isDemo && file.summary?.status === "failed",
          )
        : [],
    [aiEnabled, files],
  );
  const accentSoft = hexToRgba(accent, 0.18);
  const accentGlow = hexToRgba(accent, 0.35);
  const accentStrong = hexToRgba(accent, 0.5);
  const hasLoadedUserFilesRef = useRef(false);
  const hasLoadedQueuesRef = useRef(false);
  const currentUserFilesRef = useRef([]);
  const currentQueueSnapshotRef = useRef([]);

  const appendActivityEntries = (entries) => {
    if (!entries.length) return;

    const stampedEntries = entries.map((entry, index) => ({
      id: `${Date.now()}-${index}-${entry.message}`,
      timestamp: new Date().toISOString(),
      ...entry,
    }));

    setActivityHistory((current) =>
      [...stampedEntries.reverse(), ...current].slice(
        0,
        ACTIVITY_HISTORY_LIMIT,
      ),
    );
  };

  const loadUserFiles = async () => {
    const data = await fileApi.userFiles();
    const mappedFiles = mapBackendFiles(data.userFiles);
    if (hasLoadedUserFilesRef.current) {
      appendActivityEntries(
        buildFileActivityEntries(currentUserFilesRef.current, mappedFiles),
      );
    } else {
      hasLoadedUserFilesRef.current = true;
    }
    setUserFiles(mappedFiles);
  };

  const loadQueues = async () => {
    const data = await fileApi.queueSnapshot();
    if (hasLoadedQueuesRef.current) {
      appendActivityEntries(
        buildQueueActivityEntries(currentQueueSnapshotRef.current, data.queues),
      );
    } else {
      hasLoadedQueuesRef.current = true;
    }
    setQueueSnapshot(data.queues);
  };

  useEffect(() => {
    loadUserFiles().catch((error) => {
      console.error("Failed to load user files", error);
    });
    loadQueues().catch((error) => {
      console.error("Failed to load queue snapshot", error);
    });
  }, []);

  useEffect(() => {
    let fileRefreshTimer = null;
    let queueRefreshTimer = null;

    const unsubscribe = subscribeToFileEvents({
      onFileUpdated: () => {
        window.clearTimeout(fileRefreshTimer);
        fileRefreshTimer = window.setTimeout(() => {
          loadUserFiles().catch((error) => {
            console.error(
              "Failed to refresh user files after SSE update",
              error,
            );
          });
        }, 250);
      },
      onQueueUpdated: () => {
        window.clearTimeout(queueRefreshTimer);
        queueRefreshTimer = window.setTimeout(() => {
          loadQueues().catch((error) => {
            console.error("Failed to refresh queues after SSE update", error);
          });
        }, 150);
      },
      initialDelayMs: 100,
    });

    return () => {
      window.clearTimeout(fileRefreshTimer);
      window.clearTimeout(queueRefreshTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (queueSnapshot.some((queue) => queue.count > 0)) {
      setShowQueueSidebar(true);
    }
  }, [queueSnapshot]);

  useEffect(() => {
    currentUserFilesRef.current = userFiles;
  }, [userFiles]);

  useEffect(() => {
    currentQueueSnapshotRef.current = queueSnapshot;
  }, [queueSnapshot]);

  useEffect(() => {
    window.localStorage.setItem(SCAN_TOGGLE_STORAGE_KEY, String(scanEnabled));
  }, [scanEnabled]);

  useEffect(() => {
    window.localStorage.setItem(AI_TOGGLE_STORAGE_KEY, String(aiEnabled));
  }, [aiEnabled]);

  useEffect(() => {
    if (!aiEnabled && photoSearchMode === "tags") {
      setPhotoSearchMode("default");
      setSearch("");
    }
  }, [aiEnabled, photoSearchMode]);

  const persistUpdate = async (updatedFile) => {
    if (updatedFile.isDemo) {
      setDemoFiles((current) =>
        current.map((file) =>
          file.id === updatedFile.id ? updatedFile : file,
        ),
      );
      return;
    }

    const existingFile = userFiles.find((file) => file.id === updatedFile.id);
    if (!existingFile) {
      setUserFiles((current) =>
        current.map((file) =>
          file.id === updatedFile.id ? updatedFile : file,
        ),
      );
      return;
    }

    if (
      existingFile.description === updatedFile.description &&
      JSON.stringify(existingFile.tags ?? []) ===
        JSON.stringify(updatedFile.tags ?? [])
    ) {
      setUserFiles((current) =>
        current.map((file) =>
          file.id === updatedFile.id ? updatedFile : file,
        ),
      );
      return;
    }

    let persisted;
    if (existingFile.description !== updatedFile.description) {
      const data = await fileApi.updateUserFileDescription(
        updatedFile.id,
        updatedFile.description,
      );
      persisted = mapBackendFiles([data.updateUserFileDescription.file])[0];
    }

    if (
      JSON.stringify(existingFile.tags ?? []) !==
      JSON.stringify(updatedFile.tags ?? [])
    ) {
      const data = await fileApi.updateUserFileTags(
        updatedFile.id,
        updatedFile.tags ?? [],
      );
      persisted = mapBackendFiles([data.updateUserFileTags.file])[0];
    }

    setUserFiles((current) =>
      current.map((file) =>
        file.id === persisted.id ? { ...file, ...persisted } : file,
      ),
    );
  };

  const handleUploadAccepted = async () => {
    await Promise.all([loadUserFiles(), loadQueues()]);
  };

  const handleDelete = async (file) => {
    if (file.isDemo) {
      setDemoFiles((current) => current.filter((item) => item.id !== file.id));
    } else {
      await fileApi.deleteUserFile(file.id);
      setUserFiles((current) => current.filter((item) => item.id !== file.id));
    }

    setSelected(null);
    if (preview?.id === file.id) {
      setPreview(null);
    }
  };

  const handleSummarize = async (file, lengthOption) => {
    if (!aiEnabled || file.isDemo) {
      return;
    }

    const data = await fileApi.summarizeUserFile(file.id, lengthOption);
    const persisted = mapBackendFiles([data.summarizeUserFile.file])[0];
    setUserFiles((current) =>
      current.map((item) =>
        item.id === persisted.id ? { ...item, ...persisted } : item,
      ),
    );
    await loadQueues();
  };

  const handleRetryImageTagging = async (file) => {
    if (!aiEnabled || file.isDemo) {
      return;
    }

    const data = await fileApi.retryImageTagging(file.id);
    const persisted = mapBackendFiles([data.retryImageTagging.file])[0];
    setUserFiles((current) =>
      current.map((item) =>
        item.id === persisted.id ? { ...item, ...persisted } : item,
      ),
    );
    await loadQueues();
  };

  const handleDismissImageTaggingFailure = async (file) => {
    if (!aiEnabled || file.isDemo) {
      return;
    }

    const data = await fileApi.dismissImageTaggingFailure(file.id);
    const persisted = mapBackendFiles([
      data.dismissImageTaggingFailure.file,
    ])[0];
    setUserFiles((current) =>
      current.map((item) =>
        item.id === persisted.id ? { ...item, ...persisted } : item,
      ),
    );
    await loadQueues();
  };

  const handleRetrySummarization = async (file) => {
    if (!aiEnabled || file.isDemo) {
      return;
    }

    const data = await fileApi.retrySummarization(file.id);
    const persisted = mapBackendFiles([data.retrySummarization.file])[0];
    setUserFiles((current) =>
      current.map((item) =>
        item.id === persisted.id ? { ...item, ...persisted } : item,
      ),
    );
    await loadQueues();
  };

  const handleDismissSummarizationFailure = async (file) => {
    if (!aiEnabled || file.isDemo) {
      return;
    }

    const data = await fileApi.dismissSummarizationFailure(file.id);
    const persisted = mapBackendFiles([
      data.dismissSummarizationFailure.file,
    ])[0];
    setUserFiles((current) =>
      current.map((item) =>
        item.id === persisted.id ? { ...item, ...persisted } : item,
      ),
    );
    await loadQueues();
  };

  return (
    <div className="app-container">
      {/* Stars */}
      <div className="stars-background">
        {STARS.map((s, i) => (
          <div
            key={i}
            className="star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              opacity: s.o,
              animation: `twinkle ${2.5 + s.d}s ${s.d}s ease-in-out infinite`,
            }}
          />
        ))}
        <div className="nebula-1" />
        <div className="nebula-2" />
      </div>

      {/* ── HEADER ── */}
      <div className="app-header">
        <div className="header-brand">
          <div className="brand-title">
            COSMIC<span className="accent">VAULT</span>
          </div>
          <div className="brand-subtitle">PERSONAL CLOUD STORAGE</div>
        </div>

        {/* Search — only shown in grid mode, inside BlobView's filter bar */}
        {mode === "timeline" && <div className="header-spacer" />}
        {mode === "grid" && <div className="header-spacer" />}

        <div className="header-actions">
          {/* Storage meter */}
          <div className="storage-meter">
            <div className="storage-bar-container">
              <div
                className="storage-bar-fill"
                style={{
                  background: `linear-gradient(90deg,${accent},#14B8A6)`,
                }}
              />
            </div>
            <div className="storage-text">{files.length} files in storage</div>
          </div>

          {/* ── MODE TOGGLE ── */}
          <div className="mode-toggle">
            {[
              ["grid", "✦ Space"],
              ["timeline", "⋮ Timeline"],
            ].map(([m, label]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setSelected(null);
                }}
                className={`mode-button ${mode === m ? "active" : "inactive"}`}
                style={{
                  borderRight:
                    m === "grid" ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Scan toggle sits beside upload and keeps the same button footprint */}
          <div className="header-upload-controls">
            <button
              type="button"
              onClick={() => setScanEnabled((enabled) => !enabled)}
              className={`scan-toggle-button ${scanEnabled ? "enabled" : "disabled"}`}
            >
              {scanEnabled ? "🛡 Shield Scan On" : "🛡 Shield Scan Off"}
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="upload-button"
              style={{
                background: `linear-gradient(135deg,${hexToRgba(accent, 0.4)},${hexToRgba(accent, 0.25)})`,
                boxShadow: `0 0 20px ${accentSoft}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow = `0 0 30px ${accentGlow}`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = `0 0 20px ${accentSoft}`)
              }
            >
              ✦ Upload File
            </button>
          </div>

          {/* ── AVATAR ── */}
          <div className="avatar-container">
            <div
              onClick={() => setShowDropdown((d) => !d)}
              className="avatar-button"
              style={{
                background: `linear-gradient(135deg,${accent},${hexToRgba(accent, 0.72)})`,
                border: `2px solid ${accentStrong}`,
                boxShadow: `0 0 14px ${accentGlow}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow = `0 0 22px ${hexToRgba(accent, 0.6)}`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = `0 0 14px ${accentGlow}`)
              }
            >
              <Avatar user={user} />
            </div>
            {showDropdown && (
              <AvatarDropdown
                user={user}
                onSettings={() => {
                  setShowDropdown(false);
                  setShowSettings(true);
                }}
                onLogout={onLogout}
                onClose={() => setShowDropdown(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="app-body">
        <QueueSidebar
          open={showQueueSidebar}
          queues={visibleQueues}
          history={visibleActivityHistory}
          failedImageAnalysisItems={failedImageAnalysisItems}
          onRetryImageTagging={handleRetryImageTagging}
          onDismissImageTaggingFailure={handleDismissImageTaggingFailure}
          failedSummarizationItems={failedSummarizationItems}
          onRetrySummarization={handleRetrySummarization}
          onDismissSummarizationFailure={handleDismissSummarizationFailure}
          onToggle={() => setShowQueueSidebar((current) => !current)}
        />
        {/* ── BLOB / SPATIAL VIEW ── */}
        {mode === "grid" && (
          <SpaceView
            files={files}
            aiEnabled={aiEnabled}
            activeCategory={activeCategory}
            onCategoryChange={(id) => {
              setActiveCategory(id);
              setSelected(null);
            }}
            search={search}
            onSearch={setSearch}
            photoSearchMode={photoSearchMode}
            onPhotoSearchModeChange={setPhotoSearchMode}
            selected={selected}
            onSelect={setSelected}
            onPreview={setPreview}
          />
        )}

        {/* ── TIMELINE VIEW ── */}
        {mode === "timeline" && (
          <VaultTimelineView
            files={files}
            onPreview={setPreview}
            onSelect={(id) => setSelected(selected === id ? null : id)}
            selectedId={selected}
          />
        )}

        {/* DETAIL PANEL */}
        {selectedFile && (
          <FileDetailPanel
            file={selectedFile}
            aiEnabled={aiEnabled}
            onClose={() => setSelected(null)}
            onUpdate={persistUpdate}
            onDelete={handleDelete}
            onSummarize={handleSummarize}
            onPreview={setPreview}
          />
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onAccept={handleUploadAccepted}
          aiEnabled={aiEnabled}
          scanEnabled={scanEnabled}
        />
      )}
      {preview && (
        <PreviewModal file={preview} onClose={() => setPreview(null)} />
      )}
      {showSettings && (
        <SettingsPanel
          user={user}
          accent={accent}
          aiEnabled={aiEnabled}
          onAiEnabledChange={setAiEnabled}
          onAccentSave={setAccent}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
        />
      )}
      {/* Click-away to close dropdown */}
      {showDropdown && (
        <div
          onClick={() => setShowDropdown(false)}
          className="click-away-overlay"
        />
      )}
    </div>
  );
}

export default function App() {
  const { user, logout, loading } = useAuth();
  const [exiting, setExiting] = useState(false);

  const handleLogout = async () => {
    setExiting(true);
    await new Promise((r) => setTimeout(r, 400));
    await logout(); // calls authApi.logout() + stopTokenRefresh
    setExiting(false);
  };

  // show nothing while checking auth on load
  if (loading) return null;
  // not logged in — show login screen
  if (!user) return <LoginScreen />;

  return (
    <div className={exiting ? "root-app-exit" : "root-app-enter"}>
      <style>{`
        @keyframes vaultEnter  { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        @keyframes logoutExit  { from{opacity:1;transform:scale(1)}    to{opacity:0;transform:scale(1.03)} }
      `}</style>
      <CosmicVaultApp user={user} onLogout={handleLogout} />
    </div>
  );
}
