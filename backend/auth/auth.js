import { Router } from 'express';
import passport from 'passport';
import {   
  generateAccessToken,
  issueRefreshToken,
  consumeRefreshToken,
  revokeFamily,
  isFamilyRevoked,
  setRefreshCookie, 
} from '../middleware/jwt.js';

const router = Router();
const client_url = process.env.CLIENT_URL

// ─── Shared post-SSO handler ─────────────────────────────────────────────────
//
// After passport verifies the user via Google/GitHub
//  1. Issue an access token (short-lived JWT, goes to frontend JS memory)
//  2. Issue a refresh token (long-lived, stored as HttpOnly cookie)
//  3. Destroy the OAuth session — it was only needed for the handshake
//  4. Redirect to /auth/complete with the access token in the URL (one-time)
//
const handleAuthCallback = (req, res, next) => {
  const user = req.user;
 
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.logIn(user, async (err) => {
      if (err) return next(err);
 
      try {
        // Embed name + avatar in the JWT so the frontend doesn't need a /me call
        const userMeta = { name: user.name, avatar: user.avatar };
        const accessToken = generateAccessToken(String(user._id), userMeta);
 
        const { token: refreshToken } = await issueRefreshToken(
          req.app.locals.redis,
          String(user._id)
        );
 
        setRefreshCookie(res, refreshToken);
 
        // Destroy the OAuth session now — its only job was the handshake
        req.session.destroy((err) => {
          if (err) return next(err);
          res.clearCookie('connect.sid');
 
          // Hand the access token to the frontend via redirect query param.
          // It's one-time and short-lived in the URL — React reads it immediately
          // and clears it from the address bar.
          const params = new URLSearchParams({
            token: accessToken,
            expiresIn: process.env.JWT_EXPIRY_SECONDS || '900',
          });
          res.redirect(`${client_url}?${params}`);
        });
      } catch (err) {
        next(err);
      }
    });
  });
};

// Route to initiate Google login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Google redirects back here
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: client_url }),
  handleAuthCallback
);

// Route to initiate Github login
router.get('/github', passport.authenticate('github', {
  scope: ['user:email']
}));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: client_url }),
  handleAuthCallback
);

// ─── Logout ──────────────────────────────────────────────────────────────────
 
router.post('/logout', async (req, res) => {
  const incoming = req.cookies?.refreshToken;
 
  if (incoming) {
    try {
      const stored = await consumeRefreshToken(req.app.locals.redis, incoming);
      if (stored) {
        // Revoke the whole family so all devices/tabs are logged out
        await revokeFamily(req.app.locals.redis, stored.family);
      }
    } catch (_) {
      // Best-effort — continue with logout even if Redis call fails
    }
  }
 
  res.clearCookie('refreshToken', { path: '/auth/refresh' });
  return res.json({ message: 'Logged out' });
});

// ─── Token Refresh ───────────────────────────────────────────────────────────
//
// The refreshToken cookie is scoped to path: '/auth/refresh', so it is ONLY
// sent by the browser on requests to exactly this endpoint.
//
router.post('/refresh', async (req, res) => {
  const incoming = req.cookies?.refreshToken;
  if (!incoming) return res.status(401).json({ message: 'No refresh token' });
 
  try {
    const stored = await consumeRefreshToken(req.app.locals.redis, incoming);
 
    if (!stored) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
 
    // Reuse detected — token was already consumed.
    // This means the token was stolen and used by someone else, OR there's a
    // bug causing double-submission. Either way, revoke the entire family.
    if (stored.used) {
      await revokeFamily(req.app.locals.redis, stored.family);
      res.clearCookie('refreshToken', { path: '/auth/refresh' });
      return res.status(401).json({ message: 'Token reuse detected. Please log in again.' });
    }
 
    // Check if the whole family has been revoked (e.g. from a previous reuse event)
    if (await isFamilyRevoked(req.app.locals.redis, stored.family)) {
      res.clearCookie('refreshToken', { path: '/auth/refresh' });
      return res.status(401).json({ message: 'Session revoked. Please log in again.' });
    }
 
    // Fetch fresh user details for the new access token
    // (name/avatar may have changed since last login)
    const { Users } = await import('../db/models/index.js');
    const user = await Users.findById(stored.userId).lean();
    if (!user) return res.status(401).json({ message: 'User not found' });
 
    // Issue rotated refresh token (same family, new token)
    const { token: newRefreshToken } = await issueRefreshToken(
      req.app.locals.redis,
      stored.userId,
      stored.family
    );
 
    const userMeta = { name: user.name, avatar: user.avatar };
    const newAccessToken = generateAccessToken(stored.userId, userMeta);
 
    setRefreshCookie(res, newRefreshToken);
 
    return res.json({
      accessToken: newAccessToken,
      expiresIn: parseInt(process.env.JWT_EXPIRY_SECONDS),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Token refresh failed' });
  }
});

export default router;
