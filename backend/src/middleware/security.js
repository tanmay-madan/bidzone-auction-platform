// Small, dependency-free hardening helpers.

// Basic security headers for a JSON API.
export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}

// Fixed-window, in-memory rate limiter. Good enough for a single API
// instance; behind several instances use a shared store (e.g. Redis).
export function rateLimit({ windowMs, max, keyFn = (req) => req.ip, message }) {
  const hits = new Map();

  // Drop expired windows so the map can't grow forever.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({
        error: "RATE_LIMITED",
        message: message || "Too many requests. Please try again later.",
      });
    }
    next();
  };
}

// Route params named :id must be positive integers. Anything else would
// reach PostgreSQL as NaN and surface as a 500.
export function validateIdParam(req, res, next, value) {
  if (!/^\d{1,9}$/.test(String(value)) || Number(value) <= 0) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Not found." });
  }
  next();
}

// Final error handler: malformed JSON, oversized bodies and any
// unexpected error always come back as JSON, never an HTML stack trace.
// eslint-disable-next-line no-unused-vars
export function jsonErrorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "INVALID_JSON", message: "Request body is not valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Request body is too large." });
  }
  if (err.message === "CORS_NOT_ALLOWED") {
    return res.status(403).json({ error: "CORS_NOT_ALLOWED", message: "This origin is not allowed." });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "SERVER_ERROR", message: "Something went wrong." });
}
