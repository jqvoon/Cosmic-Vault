# CosmicVault

CosmicVault is a next-generation cloud file storage application that replaces the traditional folder hierarchy with an intelligent, tag-driven, and visually rich interface. Instead of manually organising files into folders, CosmicVault uses metadata and file categorisation to help users store and retrieve files organically without the cognitive overhead of managing a folder structure.

## Video Demonstration

Please refer to our demonstration video at https://www.youtube.com/watch?v=1D5DLh1l24Y. The Ollama endpoint used in the video may not be available during grading, so follow the "Local LLM Server (Development)" section to run the required models locally.


## Features

- **Spatial UI** — Dynamic blob-based grid (space) and timeline view for browsing files visually, with category-based navigation and tag-driven orb exploration for images.
- **File Organisation** — Category-aware metadata (photos, videos, documents, etc.) with search, filter, rename, description editing, and an `Others` fallback for unknown types.
- **Virus Scanning** — Quarantine-first upload workflow + VirusTotal API scanning (skippable via toggle), with retry handling for duplicate submissions treated as pending.
- **Secure Storage** — `storage/quarantine` → `storage/clean` transition for verified files; infected files are deleted. File access and download are gated behind authentication.
- **SSO + JWT Authentication** — Google/GitHub login via Passport.js, with short-lived JWT access tokens and rotating HttpOnly refresh tokens stored in Redis.
- **Live Updates** — Authenticated SSE stream per user, emitting `file.updated` and queue state events. A Live Activity sidebar shows active jobs and session history.
- **Background Queues** — Async pipelines for VirusTotal scanning, image tagging, and document summarization, with per-user queue tracking and retry handling.
- **Image Tagging** — Local LLM (OLLAMA/LLaVA) tag generation after clean storage, with normalized tag storage, frequency-based orb UI, and manual editing via GraphQL.
- **Document Summarisation** — Local LLM summarization (OLLAMA/Qwen) for TXT and DOCX with chunking for large documents, configurable length presets, and SSE-driven auto-population.
- **GraphQL API** — `userFiles`, `deleteUserFile`, `updateUserFileDescription`, `updateUserFileTags`, `retryImageTagging`, `dismissImageTaggingFailure`, `summarizeUserFile`, `retrySummarization`, `dismissSummarizationFailure`.
- **REST API** — Authenticated file preview/download endpoints and per-user queue snapshot endpoint, with byte-range streaming for video previews.
- **Rich Preview System** — Unified preview for images, video, audio, text, PDF, spreadsheets, DOCX, and PPTX, with fallback handling for unsupported Office formats.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React | UI framework |
| Vite | Build tool and dev server |
| JSX/CSS | Interactive dashboard, modals, playback, data vault |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express | HTTP server and routing |
| MongoDB | User + file metadata store (source of truth) |
| Mongoose | ORM mapping for models |
| Multer | File upload middleware |
| Passport.js | OAuth (Google/GitHub) login |
| JWT | Short-lived stateless access tokens |
| Redis | Refresh token store with TTL and rotation |
| GraphQL | File query and mutation API |
| EventSource (SSE) | Per-user authenticated push update stream |
| Queue helper | Background job queue (scan/tag/summary) |
| VirusTotal API | Malware scanning |
| OLLAMA/LLaVA (local dev host) | Image tagging |
| OLLAMA/Qwen (local dev host) | Document summarization |

### External APIs
| Provider | Purpose |
|---|---|
| VirusTotal | Malware scanning |
| Google OAuth | User authentication |
| GitHub OAuth | User authentication |

### AI Models
| Model | Purpose |
|---|---|
| OLLAMA LLaVA (self-hosted) | Image tag generation |
| OLLAMA Qwen 2.5 (self-hosted) | Document summarization |

---

## Authentication

CosmicVault uses a two-token authentication architecture combining SSO (OAuth 2.0) with stateless JWT access tokens and rotating refresh tokens.

### SSO Login Flow

```
User clicks "Sign in with Google/GitHub"
        ↓
Browser redirects to Identity Provider (Google / GitHub)
        ↓
User authenticates → Identity Provider redirects to /auth/google/callback or /auth/github/callback
        ↓
Passport.js verifies the OAuth code, finds or creates the user in MongoDB
        ↓
Server issues:
  - Access token  (15 min JWT, embedded with userId + name + avatar)
  - Refresh token (7 day random token, hashed and stored in Redis)
        ↓
Refresh token is set as an HttpOnly cookie (path: /auth/refresh only)
OAuth session (connect.sid) is immediately destroyed — no longer needed
        ↓
Browser is redirected to the frontend with the access token as a query param
React reads it, stores it in JS memory, strips it from the URL
```

### Token Architecture

| Token | Storage | Lifetime | Purpose |
|---|---|---|---|
| Access token | JS memory only | 15 minutes | Authorises API calls via `Authorization: Bearer` header |
| Refresh token | HttpOnly cookie | 7 days | Obtains new access tokens at `/auth/refresh` |

The access token is never stored in localStorage, sessionStorage, or a cookie. It lives exclusively in a JS module variable and is lost on page refresh — intentionally. The refresh token cookie silently restores it.

### Token Refresh Flow

```
Access token expires (or page is refreshed)
        ↓
React calls POST /auth/refresh
Browser automatically sends the HttpOnly refresh token cookie
        ↓
Server validates the refresh token hash in Redis
        ↓
Old refresh token is marked as used and invalidated
New refresh token is issued (rotated) and set as HttpOnly cookie
New access token is returned in the response body
        ↓
React stores new access token in memory — user session continues seamlessly
```

### Refresh Token Rotation and Reuse Detection

Every call to `/auth/refresh` rotates the refresh token — the old token is immediately invalidated and a new one is issued. Tokens are grouped into families (one family per login session). If a refresh token is reused (e.g. because it was stolen and used by an attacker), the server detects this and revokes the entire token family, logging out all sessions.

### Logout Flow

```
User clicks logout
        ↓
Frontend calls POST /auth/logout
Server revokes the entire refresh token family in Redis
Refresh token cookie is cleared
        ↓
Frontend clears access token from JS memory
React re-renders → LoginScreen is shown
```

### API Request Flow

All protected API routes require a valid access token in the `Authorization` header. The frontend `apiClient` handles this automatically — it attaches the token to every request and silently refreshes it if expired.

```
React calls apiFetch('/api/files')
        ↓
apiClient reads access token from tokenManager
Attaches: Authorization: Bearer <accessToken>
        ↓
Server middleware (requireAuth) verifies JWT signature
Attaches req.userId and req.userMeta to the request
        ↓
Route handler executes
```

---

## File Processing Flow

At a high level, uploads move from local preparation into storage, optional security scanning, optional AI processing, and then vault access.

```
upload
  -> quarantine
  -> optional VirusTotal scan
  -> clean storage or rejected
  -> optional image tagging / optional document summarization
  -> available in vault
```

With Shield Scan on:

```
Upload -> storage/quarantine -> VirusTotal scan
  -> clean: move to storage/clean -> optional AI processing -> available in vault
  -> infected/failed: mark failed; infected files are deleted from quarantine
```

With Shield Scan off:

```
Upload -> storage/quarantine -> move directly to storage/clean -> optional AI processing -> available in vault
```

AI processing branches:

```
Images: clean storage -> LLaVA image tagging -> tags completed/failed
TXT/DOCX documents: clean storage -> optional Qwen summarization -> summary completed/failed
```

The flow above is conceptual. In MongoDB, the app does not store a single lifecycle state; it stores independent status fields so upload/storage, scanning, image tagging, document summarization, and deletion can be tracked separately.

| Field | Values | Meaning |
|---|---|---|
| `uploadStatus` | `uploading`, `stored`, `failed`, `deleted` | Tracks whether the file is still being processed, available from clean storage, failed, or deleted. |
| `scanStatus` | `skipped`, `pending`, `clean`, `infected`, `failed` | Tracks VirusTotal scan outcome when Shield Scan is enabled, or `skipped` when scanning is disabled. |
| `imageTaggingStatus` | `not_applicable`, `pending`, `completed`, `failed` | Tracks LLaVA tag generation for image files. |
| `summary.status` | `not_available`, `not_requested`, `pending`, `completed`, `failed` | Tracks document summarization availability and outcome for supported documents. |
| `deletedAt` | timestamp or `null` | Marks records hidden from active file listings after deletion. |

MongoDB is the source of truth for all file metadata. File access and downloads are authenticated and gated by storage/scan status where applicable. Deletion removes the stored file from disk, then marks the MongoDB record as deleted (`deletedAt`, `uploadStatus: deleted`) so it is excluded from active file listings.

---

## Background Processing

All heavy processing runs asynchronously via in-memory job queues, keeping uploads non-blocking.

### VirusTotal Scan Pipeline

```
File saved to quarantine
        ↓
Scan job enqueued
        ↓
File submitted to VirusTotal API
Duplicate submissions are treated as pending (not an error)
        ↓
Result polled → clean or infected
        ↓
Clean: file moved to storage/clean, downstream queues triggered
Infected: file deleted
        ↓
SSE event emitted → frontend updates file state
```

### Image Tagging Pipeline (LLaVA)

```
File reaches clean storage and is an image
        ↓
Tagging job enqueued
        ↓
Image sent to local Ollama LLaVA model
        ↓
Normalized tags stored in MongoDB (with tagging status)
        ↓
SSE event emitted → detail panel auto-populates tags
        ↓
User can manually edit tags after tagging completes or fails
```

### Document Summarization Pipeline (Qwen)

Supported formats: `txt`, `docx`. Triggered manually either on upload or from the detail panel.

```
Summarization job enqueued (with length preset)
        ↓
Document chunked if large
        ↓
Each chunk summarized via Ollama Qwen 2.5 (non-streaming)
Chunks merged into final summary
        ↓
Summary text, status, length preset, and metadata persisted in MongoDB
        ↓
SSE event emitted → summary auto-populates in detail panel
```

**Length presets:**

| Preset | Target length |
|---|---|
| Short | ~20 words |
| Medium | ~100 words |
| Long | ~200 words |

Unsupported file types show a disabled summary state in the UI.

### Startup Recovery

Because processing queues are in-memory, the backend rebuilds recoverable work when the server starts:

- Quarantined scan jobs are re-queued for files still in `storage/quarantine` with scanning enabled and `scanStatus` of `pending` or `failed`.
- Pending image-tagging jobs are re-queued for stored image files with `imageTaggingStatus: pending`.
- Pending document-summary jobs are re-queued for stored TXT/DOCX files with `summary.status: pending`.

### Realtime Updates (SSE)

Each authenticated user gets a dedicated SSE stream at `/api/events`. The stream is scoped per user and supports multiple concurrent sessions (e.g. multiple browser tabs).

Events emitted:

| Event | Trigger |
|---|---|
| `connected` | Initial stream acknowledgement after the SSE connection opens |
| `heartbeat` | Periodic keep-alive event |
| `file.updated` | File state change (scan result, tagging complete, etc.) |
| `queue.updated` | Any tracked queue changes state; payload includes `queueName` and `ts` |

Queue updates use one SSE event name, but the queue snapshot keeps the queues distinct:

| Queue key | Label | Purpose | Typical states shown |
|---|---|---|---|
| `scan` | Virus Scan Queue | Tracks VirusTotal scan jobs for quarantined uploads before they are moved to clean storage or marked infected/failed | `queued`, `running` |
| `imageTagging` | Image Tagging Queue | Tracks LLaVA image tag generation after an image reaches clean storage | `queued`, `running`, failed items with retry/remove controls |
| `textSummarization` | Document Summary Queue | Tracks Qwen summarization jobs for supported TXT/DOCX files | `queued`, `running`, failed items with retry/remove controls |

The frontend subscribes to this stream in `App.jsx`. `file.updated` triggers a selective file re-fetch; `queue.updated` triggers a `/api/queues` re-fetch so the **Live Activity sidebar** can show per-user active jobs and non-persistent session history.

### Live Activity Sidebar

The Live Activity sidebar is more than a passive queue display:

- The `In Progress` tab shows active scan, image-tagging, and document-summary jobs from the current queue snapshot.
- The `History` tab shows a non-persistent activity log for the current browser session.
- Failed image-tagging and document-summary jobs remain visible with `Retry` and `Remove` controls.
- `Retry` re-queues the failed job; `Remove` dismisses the failed state from the UI by updating the file metadata.

### REST API Endpoints

In addition to GraphQL, the backend exposes authenticated REST endpoints for file transfer and queue state. All `/api/*` routes require a valid access token via `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/files/:id/content` | Streams stored file content inline for previews. Video files support byte-range requests for seeking/playback. |
| `GET` | `/api/files/:id/download` | Downloads a stored file as an attachment. |
| `GET` | `/api/queues` | Returns the current user's queue snapshot for scan, image tagging, and document summarization jobs. |

The frontend uses `/api/files/:id/content` for preview rendering, `/api/files/:id/download` for downloads, and `/api/queues` to populate the Live Activity sidebar.

---
## Frontend Features

### Upload Flow

The upload modal performs local preparation before sending the file to the backend:

- Files are analysed client-side to infer category, prepare metadata, and preserve the extension when a user renames the file before upload.
- When Shield Scan is enabled, uploads use a 32 MB limit because VirusTotal's free tier rejects larger files.
- When Shield Scan is disabled, the explicit 32 MB scan limit is not applied and the uploaded file is moved directly to clean storage.
- Upload previews are available in the review modal only when Shield Scan is off; when Shield Scan is on, previews are deferred until the file has been accepted into clean storage.

### File Management

File data is sourced from the GraphQL `userFiles` query as the primary data layer. Users can:

- Rename files before upload (with extension preservation)
- Edit descriptions and tags (AI-generated or manual) from the detail panel
- Download and delete files, with stored content removed from disk and metadata marked as deleted
- Browse by category and search by filename, category, or description; Photos can additionally be filtered by AI-generated/manual tags when AI tag mode is enabled

### Settings and Preferences

The settings panel includes user-facing preferences for the current frontend session:

- AI features can be toggled on or off. When disabled, AI-generated tags, summaries, tag search tools, and AI queue activity are hidden from the UI.
- Accent colour customization changes the application's visual accent.
- The Shield Scan toggle and AI feature toggle are persisted in `localStorage` as `cosmicvault.scanEnabled` and `cosmicvault.aiEnabled`, respectively.

### Space View and Navigation

- `All Files` is a first-class category alongside typed categories
- Category-based entry replaces the previous landing model
- Tag-driven orb UI for the Photos category when AI is enabled: top photo tags are displayed as frequency-scaled orbs; selecting one filters Photos by matching tags and transitions to file view; reset returns to the orb overview
- `Others` fallback category captures uncategorised file types
- Collapsible category controls and clearer return paths throughout

### Preview System

A unified preview component shared between the upload flow and the vault covers:

- Images, video, audio
- Text-like files (`txt`, `md`, `json`, `csv`, `log`, `xml`, `yml`, `yaml`, `crt`) and PDF
- Spreadsheets, DOCX, PPTX (with fallback handling for unsupported Office previews)

Preview availability for vault files is gated by scan status where applicable.

---

## Project Structure

```
/
|-- frontend/                 # React + Vite client
|   |-- src/
|   |   |-- components/
|   |   |   |-- loginScreen/
|   |   |   |   |-- authPanel/
|   |   |   |   `-- ssoButton/
|   |   |   |-- queues/       # Live Activity sidebar
|   |   |   |-- settings/
|   |   |   |-- upload/
|   |   |   `-- vault/
|   |   |       |-- detail/   # file detail panel
|   |   |       |-- preview/  # unified preview system
|   |   |       |-- space/    # blob/orb view + tag exploration
|   |   |       `-- timeline/
|   |   |-- context/          # AuthContext + AuthProvider
|   |   |-- data/
|   |   |-- services/
|   |   `-- utils/            # tokenManager, apiClient, previews
|   |-- public/
|   `-- package.json
|-- backend/                  # Express API server
|   |-- api/                  # REST + GraphQL route handlers
|   |   |-- events.js         # authenticated SSE stream
|   |   |-- files.js          # preview/download endpoints
|   |   |-- fileUpload.js     # upload endpoint
|   |   |-- graphql.js        # file query/mutation API
|   |   |-- index.js          # API router composition
|   |   `-- queues.js         # queue snapshot endpoint
|   |-- auth/                 # OAuth routes + token issuance
|   |-- db/                   # MongoDB connection + models
|   |-- middleware/
|   |   |-- imageTaggingQueue.js
|   |   |-- jwt.js
|   |   |-- passport.js
|   |   |-- requireAuth.js
|   |   |-- scanQueue.js
|   |   `-- textSummarizationQueue.js
|   |-- storage/              # quarantine + clean file directories
|   |-- utils/                # logging, queues, SSE, query helpers
|   `-- server.js             # entry point
|-- package.json              # root scripts with concurrently
`-- README.md
```

---

## Local Development Setup

Use this section when setting up the app on a local machine. Configure environment variables first, start local AI services if needed, then install dependencies and run the app.

### 1. Environment Configuration

Do not commit real `.env` files or secrets. The values below are placeholders only; use your own local MongoDB, Redis, OAuth, JWT/session, VirusTotal, and Ollama credentials.

#### Backend `.env`

The backend loads environment variables from `backend/.env`.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string for users, file metadata, and OAuth session storage |
| `REDIS_URL` | Yes | Redis connection string for refresh-token storage |
| `CLIENT_URL` | Yes | Frontend origin used after OAuth login completes |
| `SESSION_SECRET` | Yes | Secret used by `express-session` during the OAuth handshake |
| `SESSION_TTL_SECONDS` | Yes | MongoDB session-store TTL, in seconds |
| `SESSION_TTL_MS` | Yes | Session cookie lifetime, in milliseconds |
| `JWT_SECRET` | Yes | Secret used to sign and verify access tokens |
| `JWT_EXPIRY` | Yes | JWT expiry string, for example a short duration such as `15m` |
| `JWT_EXPIRY_SECONDS` | Yes | JWT expiry duration in seconds, returned to the frontend |
| `REFRESH_TOKEN_TTL_SECONDS` | Yes | Refresh-token lifetime in Redis and cookie max-age |
| `GOOGLE_CLIENT_ID` | Yes, for Google login | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes, for Google login | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | Yes, for GitHub login | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | Yes, for GitHub login | GitHub OAuth client secret |
| `VIRUSTOTAL_API_KEY` | Yes, for Shield Scan | VirusTotal API key |
| `OLLAMA_CHAT_URL` | Yes, for AI features | Ollama chat API endpoint; see Local LLM setup below |
| `OLLAMA_API_KEY` | Yes, for AI features | Non-empty API key/header value expected by the local Ollama request helper |
| `PORT` | No | Backend port; defaults to `3000` when omitted |
| `STORAGE_DIR` | No | Custom storage root; defaults to `backend/storage` |
| `OLLAMA_REQUEST_TIMEOUT_MS` | No | Ollama request timeout; defaults to `30000` |
| `DEFAULT_QUEUE_CONCURRENCY` | No | Background queue concurrency; defaults to `1` |
| `DEFAULT_QUEUE_INTERVAL` | No | Background queue interval window in milliseconds; defaults to `15000` |
| `DEFAULT_QUEUE_INTERVAL_CAP` | No | Maximum jobs per queue interval; defaults to `1` |
| `LOG_LEVEL` | No | Backend log level: `debug`, `info`, `warn`, or `error` |

Example structure with placeholder values:

```bash
MONGODB_URI=<mongodb-connection-string>
REDIS_URL=<redis-connection-string>
CLIENT_URL=<frontend-origin>

SESSION_SECRET=<random-session-secret>
SESSION_TTL_SECONDS=<session-ttl-seconds>
SESSION_TTL_MS=<session-cookie-ttl-ms>

JWT_SECRET=<random-jwt-secret>
JWT_EXPIRY=<jwt-expiry-string>
JWT_EXPIRY_SECONDS=<jwt-expiry-seconds>
REFRESH_TOKEN_TTL_SECONDS=<refresh-token-ttl-seconds>

GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>

VIRUSTOTAL_API_KEY=<virustotal-api-key>
OLLAMA_CHAT_URL=<ollama-chat-url>
OLLAMA_API_KEY=<ollama-api-key-or-local-placeholder>
```

#### Frontend `.env`

The Vite frontend reads environment variables from `frontend/.env`.

| Variable | Required | Purpose |
|---|---|---|
| `VITE_TOKEN_REFRESH_INTERVAL` | Yes | Interval in milliseconds for proactive access-token refresh |

Example structure with placeholder values:

```bash
VITE_TOKEN_REFRESH_INTERVAL=<refresh-interval-ms>
```

### 2. Local LLM Server (Development)

The app uses a local Ollama server for AI-powered image tagging and document summarization.

1. Install Ollama:
   - Windows/macOS: download and install Ollama from https://ollama.com/download.
   - Linux:
     ```bash
     curl -fsSL https://ollama.com/install.sh | sh
     ```

2. Start Ollama if it is not already running:
   ```bash
   ollama serve
   ```

3. Pull the required local models:
   ```bash
   ollama pull llava
   ollama pull qwen2.5
   ```

4. Point the backend to Ollama's local API endpoint in `backend/.env`:
   ```bash
   OLLAMA_CHAT_URL=http://localhost:11434/api/chat
   OLLAMA_API_KEY=local-dev
   ```

   Ollama's local server listens on `http://localhost:11434` by default. The app posts chat requests to `/api/chat`, so `OLLAMA_CHAT_URL` should include that path.

5. Restart the backend after changing `.env`, then verify Ollama is reachable:
   ```bash
   curl http://localhost:11434/api/tags
   ```

Image tagging uses `llava`; document summarization uses `qwen2.5`. Keep Ollama running before invoking image or document processing features.

### 3. Getting Started

Install dependencies for root, frontend and backend:

```bash
npm run install:all
```

Start both development servers:

```bash
npm run dev
```

Build production frontend:

```bash
npm run build
```

Run production server:

```bash
npm start
```

The `npm run dev` command starts Vite at `http://localhost:5173` and Express at `http://localhost:3000`. API requests are proxied automatically from the frontend to backend in development.
