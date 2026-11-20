// Central configuration. Imported first by server.js so environment
// variables are loaded and validated before anything else runs.
import dotenv from "dotenv";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";
const DEV_JWT_SECRET = "dev_secret_change_me";

function list(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET || DEV_JWT_SECRET,

  // Comma-separated list of allowed browser origins, e.g.
  // "https://bidzone.vercel.app,https://www.bidzone.app".
  // Empty = allow any origin (fine for local development only).
  corsOrigins: list(process.env.CORS_ORIGIN),

  // Benchmark/test switches (?strategy=naive|optimistic, ?anti_sniping=)
  // let a caller bypass the row lock. They are needed by the evidence and
  // CI scripts, so they stay on in development and are OFF in production
  // unless explicitly enabled.
  allowTestModes: process.env.ALLOW_TEST_MODES
    ? process.env.ALLOW_TEST_MODES === "true"
    : !isProd,

  // Behind a hosting proxy (Render, Railway, Nginx) so req.ip is the
  // real client address — needed for rate limiting.
  trustProxy: process.env.TRUST_PROXY ? process.env.TRUST_PROXY === "true" : isProd,
};

// Refuse to start a production server with a missing or weak JWT secret:
// anyone who knows the secret can forge a login for any user.
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error("FATAL: JWT_SECRET must be set to a random string of at least 32 characters in production.");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.warn("Warning: JWT_SECRET is not set. Using an insecure development secret.");
}
if (isProd && config.corsOrigins.length === 0) {
  console.warn("Warning: CORS_ORIGIN is not set. The API will accept requests from any website.");
}

export default config;
