import pool from "../db/pool.js";

// Derives UPCOMING / ACTIVE / CLOSED from timestamps rather than
// trusting the stored `status` column alone, since `status` is only
// authoritatively flipped to CLOSED by the bidding transaction when a
// bid is attempted after ends_at. Listing/detail views should still
// show a closed auction as CLOSED even if no one has bid on it since
// it ended.
const STATUS_EXPR = `
  CASE
    WHEN status = 'CLOSED' OR now() >= ends_at THEN 'CLOSED'
    WHEN now() < starts_at THEN 'UPCOMING'
    ELSE 'ACTIVE'
  END
`;

const AUCTION_COLUMNS = `
  a.id, a.title, a.description, a.image_url, a.starting_price,
  a.current_highest_bid, a.current_highest_bidder_id, a.min_increment,
  a.starts_at, a.ends_at, a.seller_id, a.created_at,
  ${STATUS_EXPR} AS status,
  u.name AS seller_name,
  (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id AND b.status = 'ACCEPTED') AS bid_count
`;

export async function listAuctions(req, res) {
  const { search, sort, status } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`a.title ILIKE $${params.length}`);
  }
  if (status) {
    // Filter on the derived status so "ACTIVE" excludes auctions that
    // have simply timed out but were never explicitly closed.
    params.push(status.toUpperCase());
    conditions.push(`(${STATUS_EXPR}) = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy =
    sort === "newest" ? "a.created_at DESC" : "a.ends_at ASC";

  try {
    const result = await pool.query(
      `SELECT ${AUCTION_COLUMNS}
       FROM auctions a
       JOIN users u ON u.id = a.seller_id
       ${where}
       ORDER BY ${orderBy}`,
      params
    );
    res.json({ auctions: result.rows });
  } catch (err) {
    console.error("listAuctions error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load auctions." });
  }
}

export async function getAuction(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT ${AUCTION_COLUMNS}
       FROM auctions a
       JOIN users u ON u.id = a.seller_id
       WHERE a.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Auction not found." });
    }
    res.json({ auction: result.rows[0] });
  } catch (err) {
    console.error("getAuction error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load auction." });
  }
}

export async function myAuctions(req, res) {
  try {
    const result = await pool.query(
      `SELECT ${AUCTION_COLUMNS}
       FROM auctions a
       JOIN users u ON u.id = a.seller_id
       WHERE a.seller_id = $1
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ auctions: result.rows });
  } catch (err) {
    console.error("myAuctions error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load your auctions." });
  }
}

// ---------------------------------------------------------------------------
// Input validation shared by create and update. Returns { error } or
// { values } with clean, typed values. Limits mirror the database columns
// so bad input becomes a 400 instead of a database error (500).
// ---------------------------------------------------------------------------
const MAX_MONEY = 9999999999.99; // NUMERIC(12,2)

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return null; // max 2 decimals
  return n;
}

function validateAuctionInput(body, existing = null) {
  const pick = (key) => (body[key] !== undefined ? body[key] : existing?.[key]);

  const title = typeof pick("title") === "string" ? pick("title").trim() : "";
  if (!title) return { error: "title is required." };
  if (title.length > 200) return { error: "title can be at most 200 characters." };

  const description = pick("description") == null ? "" : String(pick("description"));
  if (description.length > 5000) return { error: "description can be at most 5000 characters." };

  const rawImage = pick("image_url");
  const imageUrl = rawImage == null || String(rawImage).trim() === "" ? null : String(rawImage).trim();
  if (imageUrl && (!/^https?:\/\//i.test(imageUrl) || imageUrl.length > 1000)) {
    return { error: "image_url must be an http(s) link." };
  }

  if (pick("starting_price") == null || pick("min_increment") == null) {
    return { error: "starting_price and min_increment are required." };
  }
  const startingPrice = money(pick("starting_price"));
  if (startingPrice === null || startingPrice < 0 || startingPrice > MAX_MONEY) {
    return { error: "starting_price must be a non-negative amount with at most 2 decimals." };
  }
  const minIncrement = money(pick("min_increment"));
  if (minIncrement === null || minIncrement <= 0 || minIncrement > MAX_MONEY) {
    return { error: "min_increment must be a positive amount with at most 2 decimals." };
  }
  if (startingPrice + minIncrement > MAX_MONEY) {
    return { error: "starting_price is too large." };
  }

  if (!pick("starts_at") || !pick("ends_at")) return { error: "starts_at and ends_at are required." };
  const startsAt = new Date(pick("starts_at"));
  const endsAt = new Date(pick("ends_at"));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: "starts_at and ends_at must be valid dates." };
  }
  if (endsAt <= startsAt) return { error: "ends_at must be after starts_at." };
  if (endsAt.getTime() <= Date.now()) return { error: "ends_at must be in the future." };

  return {
    values: { title, description, imageUrl, startingPrice, minIncrement, startsAt, endsAt },
  };
}

export async function createAuction(req, res) {
  const { error, values } = validateAuctionInput(req.body || {});
  if (error) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: error });
  }

  try {
    const result = await pool.query(
      `INSERT INTO auctions
        (seller_id, title, description, image_url, starting_price,
         current_highest_bid, min_increment, starts_at, ends_at, status)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, 'ACTIVE')
       RETURNING id`,
      [
        req.user.id,
        values.title,
        values.description,
        values.imageUrl,
        values.startingPrice,
        values.minIncrement,
        values.startsAt.toISOString(),
        values.endsAt.toISOString(),
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error("createAuction error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not create auction." });
  }
}

// Edit and delete lock the auction row (SELECT ... FOR UPDATE) before
// checking "no bids yet". Bids take the same lock, so a bid can never
// slip in between the check and the change — without the lock, an edit
// could reset the price over a just-accepted bid, or a delete could
// erase it.
async function lockOwnedAuctionWithoutBids(client, auctionId, userId, action) {
  const existing = await client.query("SELECT * FROM auctions WHERE id = $1 FOR UPDATE", [auctionId]);
  const auction = existing.rows[0];
  if (!auction) {
    return { status: 404, body: { error: "NOT_FOUND", message: "Auction not found." } };
  }
  if (auction.seller_id !== userId) {
    return { status: 403, body: { error: "FORBIDDEN", message: "You do not own this auction." } };
  }
  const bidCheck = await client.query(
    "SELECT COUNT(*) FROM bids WHERE auction_id = $1 AND status = 'ACCEPTED'",
    [auctionId]
  );
  if (Number(bidCheck.rows[0].count) > 0) {
    return {
      status: 409,
      body: {
        error: "AUCTION_HAS_BIDS",
        message: `This auction already has bids and can no longer be ${action}.`,
      },
    };
  }
  return { auction };
}

export async function updateAuction(req, res) {
  const auctionId = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const check = await lockOwnedAuctionWithoutBids(client, auctionId, req.user.id, "edited");
    if (!check.auction) {
      await client.query("ROLLBACK");
      return res.status(check.status).json(check.body);
    }

    const { error, values } = validateAuctionInput(req.body || {}, check.auction);
    if (error) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "VALIDATION_ERROR", message: error });
    }

    await client.query(
      `UPDATE auctions
       SET title = $1, description = $2, image_url = $3,
           starting_price = $4, current_highest_bid = $4, min_increment = $5,
           starts_at = $6, ends_at = $7, updated_at = now()
       WHERE id = $8`,
      [
        values.title,
        values.description,
        values.imageUrl,
        values.startingPrice,
        values.minIncrement,
        values.startsAt.toISOString(),
        values.endsAt.toISOString(),
        auctionId,
      ]
    );
    await client.query("COMMIT");
    res.json({ message: "Auction updated." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("updateAuction error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not update auction." });
  } finally {
    client.release();
  }
}

export async function deleteAuction(req, res) {
  const auctionId = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const check = await lockOwnedAuctionWithoutBids(client, auctionId, req.user.id, "deleted");
    if (!check.auction) {
      await client.query("ROLLBACK");
      return res.status(check.status).json(check.body);
    }
    await client.query("DELETE FROM auctions WHERE id = $1", [auctionId]);
    await client.query("COMMIT");
    res.json({ message: "Auction deleted." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("deleteAuction error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not delete auction." });
  } finally {
    client.release();
  }
}
