import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

// GET /api/health
// Confirms the Express server is running and reports whether it can
// currently reach PostgreSQL. This is the Phase 1 milestone check —
// no business logic lives here.
router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(200).json({
      status: "ok",
      database: "disconnected",
      detail: err.message,
    });
  }
});

export default router;
