import { Router } from "express";
import { register, login, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getProfile, updateProfile, changePassword } from "../controllers/profile.controller.js";

const router = Router();

router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", requireAuth, me);

// Profile: view + edit own details, change password
router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, updateProfile);
router.put("/profile/password", requireAuth, changePassword);

export default router;
