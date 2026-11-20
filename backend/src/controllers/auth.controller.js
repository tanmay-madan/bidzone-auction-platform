import bcrypt from "bcrypt";
import pool from "../db/pool.js";
import { signToken } from "../utils/jwt.js";

const SALT_ROUNDS = 10;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

export async function register(req, res) {
  const { name, email, password } = req.body || {};

  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim() || !password) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "name, email and password are all required.",
    });
  }
  if (name.trim().length < 2 || name.trim().length > 120) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Name must be between 2 and 120 characters.", field: "name" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || email.length > 255) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Enter a valid email address.", field: "email" });
  }
  // bcrypt only uses the first 72 bytes of a password.
  if (password.length < 6 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Password must be between 6 and 72 characters.",
      field: "password",
    });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.trim().toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "EMAIL_TAKEN",
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    console.error("register error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not register." });
  }
}

export async function login(req, res) {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "email and password are required.",
    });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email.trim().toLowerCase(),
    ]);
    const user = result.rows[0];

    if (!user) {
      return res
        .status(401)
        .json({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    }

    const token = signToken(user);
    res.json({ user: publicUser(user), token });
  } catch (err) {
    console.error("login error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not log in." });
  }
}

export async function me(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, name, email, bio, location, phone, avatar_url, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "NOT_FOUND", message: "User not found." });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("me error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load profile." });
  }
}
