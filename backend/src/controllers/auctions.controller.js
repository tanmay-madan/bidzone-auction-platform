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

export async function createAuction(req, res) {
  const {
    title,
    description,
    image_url,
    starting_price,
    min_increment,
    starts_at,
    ends_at,
  } = req.body || {};

  if (!title || starting_price == null || min_increment == null || !starts_at || !ends_at) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "title, starting_price, min_increment, starts_at and ends_at are required.",
    });
  }
  const startingPrice = Number(starting_price);
  const minIncrement = Number(min_increment);
  const startsAt = new Date(starts_at);
  const endsAt = new Date(ends_at);

  if (Number.isNaN(startingPrice) || startingPrice < 0) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "starting_price must be a non-negative number." });
  }
  if (Number.isNaN(minIncrement) || minIncrement <= 0) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "min_increment must be a positive number." });
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "ends_at must be after starts_at." });
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
        title,
        description || "",
        image_url || null,
        startingPrice,
        minIncrement,
        startsAt.toISOString(),
        endsAt.toISOString(),
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error("createAuction error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not create auction." });
  }
}

export async function updateAuction(req, res) {
  const { id } = req.params;
  try {
    const existing = await pool.query("SELECT * FROM auctions WHERE id = $1", [id]);
    const auction = existing.rows[0];
    if (!auction) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Auction not found." });
    }
    if (auction.seller_id !== req.user.id) {
      return res.status(403).json({ error: "FORBIDDEN", message: "You do not own this auction." });
    }

    const bidCheck = await pool.query(
      "SELECT COUNT(*) FROM bids WHERE auction_id = $1 AND status = 'ACCEPTED'",
      [id]
    );
    if (Number(bidCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: "AUCTION_HAS_BIDS",
        message: "This auction already has bids and can no longer be edited.",
      });
    }

    const {
      title = auction.title,
      description = auction.description,
      image_url = auction.image_url,
      starting_price = auction.starting_price,
      min_increment = auction.min_increment,
      starts_at = auction.starts_at,
      ends_at = auction.ends_at,
    } = req.body || {};

    await pool.query(
      `UPDATE auctions
       SET title = $1, description = $2, image_url = $3,
           starting_price = $4, current_highest_bid = $4, min_increment = $5,
           starts_at = $6, ends_at = $7, updated_at = now()
       WHERE id = $8`,
      [title, description, image_url, starting_price, min_increment, starts_at, ends_at, id]
    );
    res.json({ message: "Auction updated." });
  } catch (err) {
    console.error("updateAuction error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not update auction." });
  }
}

export async function deleteAuction(req, res) {
  const { id } = req.params;
  try {
    const existing = await pool.query("SELECT * FROM auctions WHERE id = $1", [id]);
    const auction = existing.rows[0];
    if (!auction) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Auction not found." });
    }
    if (auction.seller_id !== req.user.id) {
      return res.status(403).json({ error: "FORBIDDEN", message: "You do not own this auction." });
    }

    const bidCheck = await pool.query(
      "SELECT COUNT(*) FROM bids WHERE auction_id = $1 AND status = 'ACCEPTED'",
      [id]
    );
    if (Number(bidCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: "AUCTION_HAS_BIDS",
        message: "This auction already has bids and can no longer be deleted.",
      });
    }

    await pool.query("DELETE FROM auctions WHERE id = $1", [id]);
    res.json({ message: "Auction deleted." });
  } catch (err) {
    console.error("deleteAuction error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not delete auction." });
  }
}
