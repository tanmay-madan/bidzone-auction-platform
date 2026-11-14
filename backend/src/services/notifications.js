import { publishEvent } from "./events.js";

export function inr(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

// Inserts a notification and queues a live push for its owner. Pass the
// transaction's client so the notification commits (or rolls back)
// together with the bid / settlement that caused it.
export async function createNotification(db, { userId, auctionId = null, type, title, body = "" }) {
  const result = await db.query(
    `INSERT INTO notifications (user_id, auction_id, type, title, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, auction_id, type, title, body, is_read, created_at`,
    [userId, auctionId, type, title, body]
  );
  const notification = result.rows[0];
  await publishEvent(db, { kind: "notification", user_id: userId, notification });
  return notification;
}
