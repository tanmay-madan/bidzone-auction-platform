import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// A single shared pool for the whole app. Every query and every
// transaction (BEGIN / SELECT ... FOR UPDATE / COMMIT) in later
// phases goes through this pool so connection handling stays in one
// place.
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "bidzone",
  max: Number(process.env.DB_POOL_MAX) || 25,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  // A background/idle client error should never crash the whole
  // server — log it and let the pool recover.
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

export default pool;
