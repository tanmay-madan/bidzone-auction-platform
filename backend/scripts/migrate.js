import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../src/db/pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../../database/schema.sql");

async function runMigration() {
  console.log("Applying database schema to PostgreSQL...");
  const sql = fs.readFileSync(schemaPath, "utf8");
  try {
    await pool.query(sql);
    console.log("✓ Schema applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
