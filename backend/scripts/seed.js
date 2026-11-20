import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../src/db/pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, "../../database/seed.sql");

async function runSeed() {
  console.log("Applying initial seed data to PostgreSQL...");
  const sql = fs.readFileSync(seedPath, "utf8");
  try {
    await pool.query(sql);
    console.log("✓ Seed data inserted successfully!");
  } catch (err) {
    console.error("Seed failed:", err.message);
    // Non-zero exit so deploy pipelines (and `npm run migrate && npm start`)
    // stop instead of starting the API against a broken database.
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runSeed();
