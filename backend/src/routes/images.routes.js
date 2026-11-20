import express, { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { rateLimit, validateIdParam } from "../middleware/security.js";
import { getImage, uploadImage, MAX_IMAGE_BYTES } from "../controllers/images.controller.js";

const router = Router();
router.param("id", validateIdParam);

// 30 uploads per user per hour is plenty for listing items.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyFn: (req) => `upload:${req.user?.id ?? req.ip}`,
  message: "Too many uploads. Please try again later.",
});

router.post(
  "/images",
  requireAuth,
  uploadLimiter,
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_IMAGE_BYTES }),
  uploadImage
);
router.get("/images/:id", getImage);

export default router;
