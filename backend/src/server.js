import dotenv from "dotenv";
import app from "./app.js";
import pool from "./db/pool.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`BidZone API listening on http://localhost:${PORT}`);
});

// Graceful shutdown handling for clean container termination and connection draining
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("HTTP server closed. Closing database connection pool...");
    try {
      await pool.end();
      console.log("Database connection pool closed successfully.");
      process.exit(0);
    } catch (err) {
      console.error("Error during pool termination:", err.message);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if connections hang
  setTimeout(() => {
    console.error("Forcefully shutting down due to timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default server;
