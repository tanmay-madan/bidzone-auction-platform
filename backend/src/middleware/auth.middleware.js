import { verifyToken } from "../utils/jwt.js";

// Protects routes: expects "Authorization: Bearer <token>".
// On success attaches { id, email } to req.user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ error: "UNAUTHENTICATED", message: "Login required." });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "INVALID_TOKEN", message: "Session expired or invalid." });
  }
}

// Best-effort auth: if a valid token is present, attaches req.user;
// otherwise proceeds unauthenticated. Useful for endpoints like
// GET /auctions/:id that behave the same for everyone but want to
// know who's asking (e.g. to flag "you are winning").
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme === "Bearer" && token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore invalid token, treat as anonymous
    }
  }
  next();
}
