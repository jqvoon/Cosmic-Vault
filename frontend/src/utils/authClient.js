import axios from "axios";

// ─── Auth Client ──────────────────────────────────────────────────────────────

// Separate axios instance for auth routes only.
// withCredentials: true so the HttpOnly refreshToken cookie is sent on /auth/refresh.
const authClient = axios.create({
  baseURL: "/auth",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  // POST /auth/refresh — used internally by refreshAccessToken() and AuthContext
  refresh: () => authClient.post("/refresh"),
  // POST /auth/logout — revokes refresh token family in Redis
  logout: () => authClient.post("/logout"),
};
