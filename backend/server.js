// dotenv and path setup must come before any imports that use process.env
import dotenv from "dotenv";
// Imports
import cookieParser from "cookie-parser";
import express from "express";
import session from "express-session";
import path from "path";
import { createClient } from "redis";
import { fileURLToPath } from "url";
import { createLogger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const logger = createLogger("server");

// these use process.env on load, so dynamic
const { default: authRouter } = await import("./auth/auth.js");
const { default: passport } = await import("./middleware/passport.js");
const { recoverQuarantinedFiles } = await import("./middleware/scanQueue.js");
const { recoverPendingImageTagging } =
  await import("./middleware/imageTaggingQueue.js");
const { recoverPendingTextSummaries } =
  await import("./middleware/textSummarizationQueue.js");
const { connectDB } = await import("./db/connectDB.js");
const { default: apiRouter } = await import("./api/index.js");
const { default: MongoStore } = await import("connect-mongo");
const { requireAuth } = await import("./middleware/requireAuth.js");

// Load DB
await connectDB();

// ─── Redis ───────────────────────────────────────────────────────────────────
// Used exclusively for refresh token storage.
// Attached to app.locals so auth routes can access it without a separate import.
//

const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => {
  logger.error("Redis error", err);
});
await redis.connect();
logger.info("Redis connected");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// ─── Session ─────────────────────────────────────────────────────────────────
//
// express-session is ONLY used during the OAuth handshake (storing state/nonce).
// Once the callback completes, the session is destroyed and connect.sid is cleared.
// The session store still needs to persist across the redirect round-trip, so we
// keep MongoStore — but the TTL can be very short (5 minutes is plenty).
//
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    rolling: true,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: parseInt(process.env.SESSION_TTL_SECONDS),
      autoRemove: "native", // MongoDB TTL index auto-removes expired sessions
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: parseInt(process.env.SESSION_TTL_MS),
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.locals.redis = redis;
app.use("/auth", authRouter);
app.use("/api", requireAuth, apiRouter);

// Production only: serve Vite build + SPA fallback
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);

  recoverQuarantinedFiles();
  recoverPendingImageTagging();
  recoverPendingTextSummaries();
});
