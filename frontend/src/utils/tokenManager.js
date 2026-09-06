// tokenManager.js
//
// Stores the access token in JS module memory — not localStorage, not a cookie.
// This means:
//   XSS cannot read it (no persistent storage)
//   Not auto-sent by browser (no CSRF risk)
//   Lost on page refresh — intentionally, /auth/refresh silently restores it
//
// The token payload contains { userId, name, avatar } so the app never needs
// a separate /me call after bootstrap.

import { authApi, } from "./authClient";

let _accessToken = null;
let _expiresAt   = null;
let _user        = null;    // { userId, name, avatar } decoded from token
let _refreshing  = null;    // in-flight Promise — deduplicates concurrent refresh calls

// ─── JWT decode (no verification — server already verified on issue) ──────────

const decodePayload = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const setAccessToken = (token, expiresIn) => {
  _accessToken = token;
  // Subtract 30s so we refresh before the token actually expires
  _expiresAt   = Date.now() + expiresIn * 1000 - 30_000;

  const payload = decodePayload(token);
  if (payload) {
    _user = { userId: payload.userId, name: payload.name, avatar: payload.avatar };
  }
}

export const clearAccessToken = () => {
  _accessToken = null;
  _expiresAt   = null;
  _user        = null;
  _refreshing  = null;
}

export const getUser = () => {
  return _user;
}

/**
 * Returns a valid access token, silently refreshing if expired.
 * Throws if the refresh token is also invalid (forces logout).
 */
export const getValidAccessToken = async() => {
  if (_accessToken && Date.now() < _expiresAt) return _accessToken;

  // Deduplicate: if a refresh is already in flight, wait for it
  if (!_refreshing) {
    _refreshing = authApi
      .refresh()
      .then(({ data }) => {
        setAccessToken(data.accessToken, data.expiresIn);
        return data.accessToken;
      })
      .catch(() => {
        clearAccessToken();
        throw new Error("Session expired");
      })
      .finally(() => {
        _refreshing = null;
      });
  }

  return _refreshing;
}
