import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { verifyToken } from "../utils/jwt.js";
import { addClient } from "../services/events.js";
import { listNotifications, markRead, markAllRead } from "../controllers/notifications.controller.js";

const router = Router();

// GET /api/stream — Server-Sent Events.
// Browsers' EventSource can't set an Authorization header, so the JWT is
// passed as ?token=. Without a valid token the stream still works, but
// only carries public auction activity (no private notifications).
router.get("/stream", (req, res) => {
  let userId = null;
  if (req.query.token) {
    try {
      userId = verifyToken(String(req.query.token)).id;
    } catch {
      // invalid/expired token -> anonymous stream
    }
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // stop nginx from buffering the stream
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");

  const remove = addClient(res, userId);
  req.on("close", remove);
});

router.get("/notifications", requireAuth, listNotifications);
router.post("/notifications/read-all", requireAuth, markAllRead);
router.post("/notifications/:id/read", requireAuth, markRead);

export default router;
