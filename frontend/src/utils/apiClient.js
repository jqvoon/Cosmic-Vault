import axios from "axios";
import {
  authApi,
} from "./authClient";
import {
  setAccessToken,
  clearAccessToken,
  getValidAccessToken,
} from "./tokenManager";


// ─── Token Refresh ────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = parseInt(import.meta.env.VITE_TOKEN_REFRESH_INTERVAL); // e.g. 780000 (13 min)
let refreshTimer = null;
let refreshPromise = null;

// Calls POST /auth/refresh, which reads the HttpOnly refreshToken cookie.
// Returns the new access token, or throws and redirects on failure.
export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = authApi
      .refresh()
      .then(({ data }) => {
        setAccessToken(data.accessToken, data.expiresIn);
        return data.accessToken;
      })
      .catch(() => {
        clearAccessToken();
        window.location.href = "/";
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

export const startTokenRefresh = () => {
  // Kick off immediately, then on interval
  refreshAccessToken();
  refreshTimer = setInterval(refreshAccessToken, REFRESH_INTERVAL);
};

export const stopTokenRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// ─── API Client ───────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: "/api",
  withCredentials: false, // API calls use Bearer token — no cookies needed
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach current access token to every API call
api.interceptors.request.use(async (config) => {
  try {
    const token = await getValidAccessToken();
    config.headers["Authorization"] = `Bearer ${token}`;
  } catch {
    // getValidAccessToken will redirect on total failure — nothing to do here
  }
  return config;
});

// Response interceptor — reactive fallback if token was rejected
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true; // prevent infinite retry loop
      try {
        await refreshAccessToken();
        // Re-attach new token before retrying
        const token = await getValidAccessToken();
        error.config.headers["Authorization"] = `Bearer ${token}`;
        return api(error.config);
      } catch {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

// ─── REST helpers ─────────────────────────────────────────────────────────────

// const { data } = await get('/files');
// const { data } = await get('/files', { status: 'clean', userId: '123' });
export const get = (path, params = {}) => api.get(path, { params });

// const { data } = await post('/files', { name: 'test.txt' });
export const post = (path, body = {}) => api.post(path, body);

export const download = (id) =>
  api.get(`/files/${id}/download`, { responseType: "blob" });

// const formData = new FormData();
// formData.append('file', file);
// await upload('/upload', formData, (progress) => console.log(`${progress}%`));
export const upload = (path, formData, onProgress) =>
  api.post(path, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) =>
      onProgress?.(Math.round((e.loaded * 100) / e.total)),
  });


// ─── GraphQL ──────────────────────────────────────────────────────────────────

export const graphql = async (query, variables = {}) => {
  const { data } = await api.post("/graphql", { query, variables });

  if (data.errors?.length) {
    throw new Error(data.errors[0].message || "GraphQL request failed");
  }

  return data.data;
};

export const subscribeToFileEvents = ({
  onFileUpdated,
  onQueueUpdated,
  initialDelayMs = 750,
} = {}) => {
  let events = null;
  let disposed = false;

  const connect = async () => {
    if (disposed) return;

    try {
      const token = await getValidAccessToken();
      if (!token) {
        console.error("[SSE] No valid access token available");
        return;
      }

      const sseUrl = `/api/events?token=${encodeURIComponent(token)}`;
      events = new EventSource(sseUrl);

      events.addEventListener("connected", (event) => {
        try {
          const data = JSON.parse(event.data);
        } catch (err) {
          console.error("[SSE] Error parsing connected event:", err);
        }
      });

      events.addEventListener("file.updated", (event) => {
        try {
          const data = JSON.parse(event.data);
          onFileUpdated?.(data);
        } catch (err) {
          console.error("[SSE] Error parsing file.updated event:", err);
          onFileUpdated?.(null);
        }
      });

      events.addEventListener("queue.updated", (event) => {
        try {
          const data = JSON.parse(event.data);
          onQueueUpdated?.(data);
        } catch (err) {
          console.error("[SSE] Error parsing queue.updated event:", err);
          onQueueUpdated?.(null);
        }
      });

      events.addEventListener("error", (err) => {
        console.error("[SSE] Connection error:", {
          type: err.type,
          eventPhase: err.eventPhase,
          srcElement: err.srcElement?.readyState,
        });
        if (events?.readyState === EventSource.CLOSED) {
          console.error("[SSE] Connection closed");
        }
      });

      events.addEventListener("heartbeat", () => {});
    } catch (err) {
      console.error("[SSE] Failed to connect:", err);
    }
  };

  const connectTimer = window.setTimeout(connect, initialDelayMs);

  return () => {
    disposed = true;
    window.clearTimeout(connectTimer);
    if (events) {
      events.close();
    }
  };
};

export const fileApi = {
  queueSnapshot: () => get("/queues").then(({ data }) => data),
  userFiles: () =>
    graphql(`
      query UserFiles {
        userFiles {
          id
          originalName
          savedAs
          storagePath
          mimeType
          extension
          size
          category
          description
          tags
          summary {
            status
            lengthOption
            wordLimit
            text
            generatedAt
            model
            error
          }
          imageTaggingStatus
          scanEnabled
          uploadStatus
          scanStatus
          scanVerdict
          scanError
          scannedAt
          deletedAt
          createdAt
          updatedAt
        }
      }
    `),

  deleteUserFile: (id) =>
    graphql(
      `
        mutation DeleteUserFile($id: ID!) {
          deleteUserFile(id: $id) {
            success
            id
          }
        }
      `,
      { id },
    ),

  updateUserFileDescription: (id, description) =>
    graphql(
      `
        mutation UpdateUserFileDescription($id: ID!, $description: String!) {
          updateUserFileDescription(id: $id, description: $description) {
            success
            file {
              id
              originalName
              savedAs
              storagePath
              mimeType
              extension
              size
              category
              description
              tags
              summary {
                status
                lengthOption
                wordLimit
                text
                generatedAt
                model
                error
              }
              imageTaggingStatus
              scanEnabled
              uploadStatus
              scanStatus
              scanVerdict
              scanError
              scannedAt
              deletedAt
              createdAt
              updatedAt
            }
          }
        }
      `,
      { id, description },
    ),

  updateUserFileTags: (id, tags) =>
    graphql(
      `
        mutation UpdateUserFileTags($id: ID!, $tags: [String!]!) {
          updateUserFileTags(id: $id, tags: $tags) {
            success
            file {
              id
              originalName
              savedAs
              storagePath
              mimeType
              extension
              size
              category
              description
              tags
              summary {
                status
                text
                generatedAt
                model
                error
              }
              imageTaggingStatus
              scanEnabled
              uploadStatus
              scanStatus
              scanVerdict
              scanError
              scannedAt
              deletedAt
              createdAt
              updatedAt
            }
          }
        }
      `,
      { id, tags },
    ),

  retryImageTagging: (id) =>
    graphql(
      `
        mutation RetryImageTagging($id: ID!) {
          retryImageTagging(id: $id) {
            success
            file {
              id
              originalName
              savedAs
              storagePath
              mimeType
              extension
              size
              category
              description
              tags
              summary {
                status
                lengthOption
                wordLimit
                text
                generatedAt
                model
                error
              }
              imageTaggingStatus
              scanEnabled
              uploadStatus
              scanStatus
              scanVerdict
              scanError
              scannedAt
              deletedAt
              createdAt
              updatedAt
            }
          }
        }
      `,
      { id },
    ),

  dismissImageTaggingFailure: (id) =>
    graphql(
      `
        mutation DismissImageTaggingFailure($id: ID!) {
          dismissImageTaggingFailure(id: $id) {
            success
            file {
              id
              originalName
              savedAs
              storagePath
              mimeType
              extension
              size
              category
              description
              tags
              summary {
                status
                lengthOption
                wordLimit
                text
                generatedAt
                model
                error
              }
              imageTaggingStatus
              scanEnabled
              uploadStatus
              scanStatus
              scanVerdict
              scanError
              scannedAt
              deletedAt
              createdAt
              updatedAt
            }
          }
        }
      `,
      { id },
    ),

  summarizeUserFile: (id, lengthOption) =>
    graphql(
      `
        mutation SummarizeUserFile($id: ID!, $lengthOption: String!) {
          summarizeUserFile(id: $id, lengthOption: $lengthOption) {
            success
            file {
              id
              originalName
              savedAs
              storagePath
              mimeType
              extension
              size
              category
              description
              tags
              summary {
                status
                lengthOption
                wordLimit
                text
                generatedAt
                model
                error
              }
              imageTaggingStatus
              scanEnabled
              uploadStatus
              scanStatus
              scanVerdict
              scanError
              scannedAt
              deletedAt
              createdAt
              updatedAt
            }
          }
        }
      `,
      { id, lengthOption },
    ),

  retrySummarization: (id) =>
    graphql(
      `
        mutation RetrySummarization($id: ID!) {
          retrySummarization(id: $id) {
            success
            file {
              id
              originalName
              savedAs
              storagePath
              mimeType
              extension
              size
              category
              description
              tags
              summary {
                status
                lengthOption
                wordLimit
                text
                generatedAt
                model
                error
              }
              imageTaggingStatus
              scanEnabled
              uploadStatus
              scanStatus
              scanVerdict
              scanError
              scannedAt
              deletedAt
              createdAt
              updatedAt
            }
          }
        }
      `,
      { id },
    ),

  dismissSummarizationFailure: (id) =>
    graphql(
      `
        mutation DismissSummarizationFailure($id: ID!) {
          dismissSummarizationFailure(id: $id) {
            success
            file {
              id
              originalName
              savedAs
              storagePath
              mimeType
              extension
              size
              category
              description
              tags
              summary {
                status
                lengthOption
                wordLimit
                text
                generatedAt
                model
                error
              }
              imageTaggingStatus
              scanEnabled
              uploadStatus
              scanStatus
              scanVerdict
              scanError
              scannedAt
              deletedAt
              createdAt
              updatedAt
            }
          }
        }
      `,
      { id },
    ),
};
