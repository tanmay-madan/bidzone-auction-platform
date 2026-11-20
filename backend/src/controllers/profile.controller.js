import bcrypt from "bcrypt";
import pool from "../db/pool.js";
import { signToken } from "../utils/jwt.js";

const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s\d]{6,30}$/;

const PROFILE_COLUMNS = "id, name, email, bio, location, phone, avatar_url, created_at, updated_at";

function bad(res, message, field) {
  return res.status(400).json({ error: "VALIDATION_ERROR", message, field });
}

// GET /api/profile — the logged-in user's details plus activity stats.
export async function getProfile(req, res) {
  const userId = req.user.id;
  try {
    const [userRes, statsRes] = await Promise.all([
      pool.query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1`, [userId]),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM auctions WHERE seller_id = $1)::int AS auctions_listed,
           (SELECT COUNT(*) FROM auctions
              WHERE seller_id = $1 AND status <> 'CLOSED' AND now() < ends_at)::int AS auctions_live,
           (SELECT COUNT(*) FROM bids WHERE bidder_id = $1 AND status = 'ACCEPTED')::int AS bids_placed,
           (SELECT COUNT(DISTINCT auction_id) FROM bids
              WHERE bidder_id = $1 AND status = 'ACCEPTED')::int AS auctions_joined,
           (SELECT COUNT(*) FROM auctions
              WHERE current_highest_bidder_id = $1 AND (status = 'CLOSED' OR now() >= ends_at))::int AS auctions_won,
           (SELECT COALESCE(SUM(current_highest_bid), 0) FROM auctions
              WHERE current_highest_bidder_id = $1 AND (status = 'CLOSED' OR now() >= ends_at)) AS total_won_value,
           (SELECT COALESCE(SUM(current_highest_bid), 0) FROM auctions
              WHERE seller_id = $1 AND current_highest_bidder_id IS NOT NULL
                AND (status = 'CLOSED' OR now() >= ends_at)) AS total_sold_value`,
        [userId]
      ),
    ]);
    if (!userRes.rows[0]) {
      return res.status(404).json({ error: "NOT_FOUND", message: "User not found." });
    }
    res.json({ user: userRes.rows[0], stats: statsRes.rows[0] });
  } catch (err) {
    console.error("getProfile error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load profile." });
  }
}

// PATCH /api/profile — update any subset of the editable fields.
export async function updateProfile(req, res) {
  const userId = req.user.id;
  const body = req.body || {};
  const updates = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 120) return bad(res, "Name must be between 2 and 120 characters.", "name");
    updates.name = name;
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 255) return bad(res, "Enter a valid email address.", "email");
    updates.email = email;
  }
  if (body.bio !== undefined) {
    const bio = String(body.bio).trim();
    if (bio.length > 280) return bad(res, "Bio can be at most 280 characters.", "bio");
    updates.bio = bio;
  }
  if (body.location !== undefined) {
    const location = String(body.location).trim();
    if (location.length > 120) return bad(res, "Location can be at most 120 characters.", "location");
    updates.location = location;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone && !PHONE_RE.test(phone)) return bad(res, "Enter a valid phone number.", "phone");
    updates.phone = phone;
  }
  if (body.avatar_url !== undefined) {
    const url = String(body.avatar_url).trim();
    if (url && (!/^https?:\/\//i.test(url) || url.length > 500)) {
      return bad(res, "Photo URL must start with http:// or https://", "avatar_url");
    }
    updates.avatar_url = url;
  }

  const fields = Object.keys(updates);
  if (fields.length === 0) return bad(res, "Nothing to update.");

  try {
    if (updates.email) {
      const taken = await pool.query("SELECT 1 FROM users WHERE email = $1 AND id <> $2", [updates.email, userId]);
      if (taken.rowCount > 0) {
        return res.status(409).json({ error: "EMAIL_TAKEN", message: "Another account already uses this email.", field: "email" });
      }
    }

    // Column names come from the fixed whitelist above, never from user input.
    const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const result = await pool.query(
      `UPDATE users SET ${sets}, updated_at = now() WHERE id = $${fields.length + 1} RETURNING ${PROFILE_COLUMNS}`,
      [...fields.map((f) => updates[f]), userId]
    );
    const user = result.rows[0];
    // Fresh token so the email inside it matches the new one.
    res.json({ user, token: signToken(user), message: "Profile updated." });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "EMAIL_TAKEN", message: "Another account already uses this email.", field: "email" });
    }
    console.error("updateProfile error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not update profile." });
  }
}

// PUT /api/profile/password — requires the current password.
export async function changePassword(req, res) {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return bad(res, "Current and new password are both required.");
  }
  if (String(new_password).length < 6 || Buffer.byteLength(String(new_password)) > 72) {
    return bad(res, "New password must be between 6 and 72 characters.", "new_password");
  }
  if (current_password === new_password) {
    return bad(res, "New password must be different from the current one.", "new_password");
  }

  try {
    const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "User not found." });

    const ok = await bcrypt.compare(String(current_password), result.rows[0].password_hash);
    if (!ok) {
      // 400, not 401: the session is valid, only the typed password is wrong.
      // (A 401 would make the frontend treat it as an expired login.)
      return res.status(400).json({ error: "WRONG_PASSWORD", message: "Current password is incorrect.", field: "current_password" });
    }

    const hash = await bcrypt.hash(String(new_password), SALT_ROUNDS);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [hash, req.user.id]);
    res.json({ success: true, message: "Password changed." });
  } catch (err) {
    console.error("changePassword error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not change password." });
  }
}
