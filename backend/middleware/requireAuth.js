import { verifyAccessToken } from "../middleware/jwt.js";

// Protects API routes.
// Expects: Authorization: Bearer <accessToken> OR ?token=<accessToken>
// Attaches req.userId and req.userMeta for use in route handlers.
export const requireAuth = (req, res, next) => {
  // EventSource doesn't support custom headers, so also accept token as query parameter
  const authHeader = req.headers["authorization"];
  const queryToken = req.query.token;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : queryToken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userMeta = { name: payload.name, avatar: payload.avatar };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
