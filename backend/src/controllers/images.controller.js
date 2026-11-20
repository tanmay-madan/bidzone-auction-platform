import pool from "../db/pool.js";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB after client-side compression

// Identify the real file type from its first bytes instead of trusting the
// Content-Type header. Only JPEG, PNG and WebP are accepted; SVG and other
// formats are rejected because they can carry scripts.
function sniffImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// Absolute URL, so the frontend can show the image even when it is hosted
// on a different domain from the API (e.g. Vercel + Render). PUBLIC_API_URL
// overrides the detected address if a proxy reports it incorrectly.
function publicUrl(req, id) {
  const base = process.env.PUBLIC_API_URL
    ? process.env.PUBLIC_API_URL.replace(/\/$/, "")
    : `${req.protocol}://${req.get("host")}/api`;
  return `${base}/images/${id}`;
}

// POST /api/images — raw image bytes in the request body.
export async function uploadImage(req, res) {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Upload a JPEG, PNG or WebP image.",
    });
  }
  if (body.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Image must be 3 MB or smaller." });
  }
  const mime = sniffImageType(body);
  if (!mime) {
    return res.status(400).json({
      error: "UNSUPPORTED_IMAGE",
      message: "Only JPEG, PNG and WebP images are supported.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO images (uploader_id, mime_type, size_bytes, data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [req.user.id, mime, body.length, body]
    );
    const id = result.rows[0].id;
    res.status(201).json({ id, url: publicUrl(req, id), mime_type: mime, size_bytes: body.length });
  } catch (err) {
    console.error("uploadImage error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not save the image." });
  }
}

// GET /api/images/:id — images never change, so browsers may cache them forever.
export async function getImage(req, res) {
  try {
    const result = await pool.query("SELECT mime_type, data FROM images WHERE id = $1", [Number(req.params.id)]);
    const image = result.rows[0];
    if (!image) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Image not found." });
    }
    res.set({
      "Content-Type": image.mime_type,
      "Content-Length": String(image.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    });
    res.end(image.data);
  } catch (err) {
    console.error("getImage error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load the image." });
  }
}
