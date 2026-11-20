import { Router } from "express";
import { register, login, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/security.js";
import config from "../config.js";
import { getProfile, updateProfile, changePassword } from "../controllers/profile.controller.js";

const router = Router();

// Brute-force protection: 10 login attempts per email per IP every 15 min.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `login:${req.ip}:${String(req.body?.email || "").toLowerCase()}`,
  message: "Too many login attempts. Please wait 15 minutes and try again.",
});

// Sign-up spam protection in production. Test suites register many users
// from one machine, so it's off in development.
const registerLimiter = config.isProd
  ? rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: "Too many accounts created. Please try again later." })
  : (req, res, next) => next();

router.post("/auth/register", registerLimiter, register);
router.post("/auth/login", loginLimiter, login);
router.get("/auth/me", requireAuth, me);

// Profile: view + edit own details, change password
router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, updateProfile);
router.put("/profile/password", requireAuth, changePassword);

export default router;
