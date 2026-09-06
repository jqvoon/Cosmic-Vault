import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ─── Access Token ────────────────────────────────────────────────────────────
 
export const generateAccessToken = (userId, userMeta = {}) => {
  // Embed lightweight user details so the frontend can read them from the token
  // without an extra /me round-trip. Keep this small — it's in every request.
  return jwt.sign(
    { userId, ...userMeta },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY } // '15m'
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};


// ─── Refresh Token ───────────────────────────────────────────────────────────

const REFRESH_TTL_SECONDS = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS);

/**
 * Issues a new refresh token and stores its hash in Redis.
 * Optionally accepts an existing family ID (for rotation).
 * A "family" is the chain of refresh tokens for one login session —
 * if any token in the family is reused, the whole family is revoked.
 */
export const issueRefreshToken = async (redisClient, userId, existingFamily = null) => {
  const token  = crypto.randomBytes(40).toString('hex');
  const hash   = crypto.createHash('sha256').update(token).digest('hex');
  const family = existingFamily ?? crypto.randomUUID();
 
  await redisClient.set(
    `refresh:${hash}`,
    JSON.stringify({ userId, family, used: false }),
    { EX: REFRESH_TTL_SECONDS }
  );
 
  return { token, family };
};
 
/**
 * Marks a refresh token as used and returns its stored record.
 * Returns null if not found (expired or never existed).
 */
export const consumeRefreshToken = async (redisClient, token) => {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const raw  = await redisClient.get(`refresh:${hash}`);
  if (!raw) return null;
 
  const stored = JSON.parse(raw);
 
  // Mark used — keep key alive for 60s so a racing duplicate request gets caught
  await redisClient.set(
    `refresh:${hash}`,
    JSON.stringify({ ...stored, used: true }),
    { EX: 60 }
  );
 
  return stored; // { userId, family, used }
};
 
/**
 * Revokes all refresh tokens in a family by setting a revocation flag.
 * On every /auth/refresh, we check this flag before issuing new tokens.
 */
export const revokeFamily = async (redisClient, family) => {
  await redisClient.set(
    `family-revoked:${family}`,
    '1',
    { EX: REFRESH_TTL_SECONDS }
  );
};
 
export const isFamilyRevoked = async (redisClient, family) => {
  return await redisClient.get(`family-revoked:${family}`);
};
 
// ─── Cookie helper ───────────────────────────────────────────────────────────
 
export const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth/refresh', // cookie is ONLY sent to this endpoint
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
};
