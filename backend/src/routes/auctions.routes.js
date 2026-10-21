import { Router } from "express";
import {
  listAuctions,
  getAuction,
  myAuctions,
  createAuction,
  updateAuction,
  deleteAuction,
} from "../controllers/auctions.controller.js";
import { placeBid, bidHistory, myBids } from "../controllers/bids.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { settleAuction, settleAllExpiredAuctions } from "../workers/settlement.worker.js";

const router = Router();

router.get("/auctions", listAuctions);
router.get("/my-auctions", requireAuth, myAuctions);
router.get("/auctions/mine", requireAuth, myAuctions); // alias per spec
router.get("/my-bids", requireAuth, myBids);
router.get("/bids/mine", requireAuth, myBids); // alias per spec
router.get("/auctions/:id", getAuction);
router.post("/auctions", requireAuth, createAuction);
router.put("/auctions/:id", requireAuth, updateAuction);
router.delete("/auctions/:id", requireAuth, deleteAuction);

router.post("/auctions/:id/bids", requireAuth, placeBid);
router.get("/auctions/:id/bids", bidHistory);

// Settlement routes with advisory locking protection
router.post("/auctions/:id/settle", async (req, res) => {
  try {
    const outcome = await settleAuction(Number(req.params.id), req.query.workerId || "manual-trigger");
    res.json(outcome);
  } catch (err) {
    console.error("settle error:", err.message);
    res.status(500).json({ error: "SETTLEMENT_ERROR", message: err.message });
  }
});

router.post("/auctions/settle-expired", async (req, res) => {
  try {
    const outcomes = await settleAllExpiredAuctions(req.query.workerId || "cron-sweep");
    res.json({ totalProcessed: outcomes.length, outcomes });
  } catch (err) {
    console.error("sweep error:", err.message);
    res.status(500).json({ error: "SETTLEMENT_ERROR", message: err.message });
  }
});

export default router;
