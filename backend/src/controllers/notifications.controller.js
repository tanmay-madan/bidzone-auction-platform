import pool from "../db/pool.js";

// Every query is scoped by req.user.id, so a user can never read or
// mark another user's notifications (no IDOR).

export async function listNotifications(req, res) {
  try {
    const [list, unread] = await Promise.all([
      pool.query(
        `SELECT n.id, n.auction_id, n.type, n.title, n.body, n.is_read, n.created_at
         FROM notifications n
         WHERE n.user_id = $1
         ORDER BY n.created_at DESC
         LIMIT 30`,
        [req.user.id]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false",
        [req.user.id]
      ),
    ]);
    res.json({ notifications: list.rows, unread: unread.rows[0].count });
  } catch (err) {
    console.error("listNotifications error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load notifications." });
  }
}

export async function markRead(req, res) {
  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id",
      [Number(req.params.id), req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Notification not found." });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("markRead error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not update notification." });
  }
}

export async function markAllRead(req, res) {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("markAllRead error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not update notifications." });
  }
}
