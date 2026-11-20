import express from "express";
import cors from "cors";
import config from "./config.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import auctionsRoutes from "./routes/auctions.routes.js";
import liveRoutes from "./routes/live.routes.js";
import { jsonErrorHandler, securityHeaders } from "./middleware/security.js";

const app = express();

app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", 1);

// CORS: allow everything locally; in production only the origins listed
// in CORS_ORIGIN (requests without an Origin header, e.g. curl or
// server-to-server health checks, are always allowed).
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.length === 0) return callback(null, true);
      if (config.corsOrigins.includes(origin.replace(/\/$/, ""))) return callback(null, true);
      return callback(new Error("CORS_NOT_ALLOWED"));
    },
  })
);
app.use(securityHeaders);
app.use(express.json({ limit: "100kb" }));

// All routes are mounted under /api.
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", auctionsRoutes);
app.use("/api", liveRoutes); // SSE stream + notifications

app.get("/", (req, res) => {
  res.json({ message: "BidZone API is running" });
});

// Fallback 404 handler for unmatched routes.
app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
});

// Malformed JSON / unexpected errors → JSON response instead of HTML.
app.use(jsonErrorHandler);

export default app;
