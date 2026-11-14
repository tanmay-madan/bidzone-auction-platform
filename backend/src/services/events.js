// =============================================================================
// Live events: PostgreSQL LISTEN/NOTIFY  ->  Server-Sent Events (SSE)
//
// Writers call publishEvent(client, payload) INSIDE their transaction.
// PostgreSQL only delivers a NOTIFY when that transaction COMMITs, so a
// rolled-back bid is never broadcast. One dedicated connection LISTENs
// and fans each event out to the browsers connected to GET /api/stream.
// Because the hub is fed by the database (not by in-process memory),
// this keeps working if several backend instances run side by side.
// =============================================================================
import pg from "pg";
import { dbConfig } from "../db/pool.js";

export const CHANNEL = "bidzone_events";

const clients = new Set(); // { res, userId }
let listener = null;
let heartbeat = null;
let stopped = false;

// Queue an event; delivered to listeners only if/when the caller commits.
export async function publishEvent(db, payload) {
  await db.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(payload)]);
}

function send(res, kind, data) {
  res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(payload) {
  for (const c of clients) {
    // Private notifications go only to their owner; everything else
    // (bids, closings) is public auction activity.
    if (payload.kind === "notification" && c.userId !== payload.user_id) continue;
    try {
      send(c.res, payload.kind, payload);
    } catch {
      clients.delete(c);
    }
  }
}

export function addClient(res, userId = null) {
  const client = { res, userId };
  clients.add(client);
  send(res, "ready", { connected: true, authenticated: Boolean(userId) });
  return () => clients.delete(client);
}

export function clientCount() {
  return clients.size;
}

export async function startEventListener() {
  stopped = false;
  const connect = async () => {
    listener = new pg.Client(dbConfig);
    listener.on("notification", (msg) => {
      try {
        broadcast(JSON.parse(msg.payload));
      } catch (err) {
        console.error("live event parse error:", err.message);
      }
    });
    listener.on("error", (err) => {
      console.error("live listener error:", err.message);
      reconnect();
    });
    await listener.connect();
    await listener.query(`LISTEN ${CHANNEL}`);
    console.log("Live events: listening on PostgreSQL channel", CHANNEL);
  };

  const reconnect = () => {
    if (stopped) return;
    try {
      listener?.end();
    } catch {}
    setTimeout(() => connect().catch(reconnect), 3000);
  };

  // Comment lines keep proxies from closing idle SSE connections.
  heartbeat = setInterval(() => {
    for (const c of clients) {
      try {
        c.res.write(": ping\n\n");
      } catch {
        clients.delete(c);
      }
    }
  }, 25000);

  await connect().catch((err) => {
    console.error("live listener failed to start:", err.message);
    reconnect();
  });
}

export async function stopEventListener() {
  stopped = true;
  clearInterval(heartbeat);
  for (const c of clients) {
    try {
      c.res.end();
    } catch {}
  }
  clients.clear();
  try {
    await listener?.end();
  } catch {}
}
