import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import auctionsRoutes from "./routes/auctions.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// All routes are mounted under /api.
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", auctionsRoutes);

app.get("/", (req, res) => {
  res.json({ message: "BidZone API is running" });
});

// Fallback 404 handler for unmatched routes.
app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
});

export default app;
