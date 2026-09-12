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

const router = Router();

router.get("/auctions", listAuctions);
router.get("/my-auctions", requireAuth, myAuctions);
router.get("/my-bids", requireAuth, myBids);
router.get("/auctions/:id", getAuction);
router.post("/auctions", requireAuth, createAuction);
router.put("/auctions/:id", requireAuth, updateAuction);
router.delete("/auctions/:id", requireAuth, deleteAuction);

router.post("/auctions/:id/bids", requireAuth, placeBid);
router.get("/auctions/:id/bids", bidHistory);

export default router;
