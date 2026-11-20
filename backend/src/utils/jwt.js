import jwt from "jsonwebtoken";
import config from "../config.js";

// Validated in config.js — production refuses to start without a strong secret.
const SECRET = config.jwtSecret;
const EXPIRES_IN = "7d";

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, {
    expiresIn: EXPIRES_IN,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
