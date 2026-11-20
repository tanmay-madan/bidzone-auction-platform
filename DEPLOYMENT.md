# Deploying BidZone

This guide deploys BidZone with three free-tier services:

| Part | Service | What it runs |
| :--- | :--- | :--- |
| Database | **Render PostgreSQL** (or Neon) | PostgreSQL 16 |
| Backend | **Render Web Service** | Express API, live events, settlement scheduler |
| Frontend | **Vercel** (or Netlify) | Static React build |

Alternatively, the whole stack runs on any server with Docker (`docker compose up --build -d`).

---

## 1. Before You Deploy

1. Push the latest code to GitHub and confirm the **CI workflow is green**.
2. Generate a JWT secret (keep it private):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

---

## 2. Database and Backend (Render)

### Option A: Blueprint (recommended)

1. Render dashboard → **New → Blueprint** → select this repository.
2. Render reads [`render.yaml`](render.yaml) and creates:
   * `bidzone-db`: PostgreSQL database
   * `bidzone-api`: the backend, with `DATABASE_URL` and a generated `JWT_SECRET` already set
3. When asked for `CORS_ORIGIN`, leave it empty for now; it's set in Step 4.
4. After the first deploy, open `https://<your-api>.onrender.com/api/health`. Expected:
   ```json
   { "status": "ok", "database": "connected" }
   ```
5. Load the demo data once, from your own computer. Copy the database's **External Database URL** from Render (database page → *Connect*), then run:
   ```bash
   cd backend
   npm install
   DATABASE_URL="<external-database-url>" npm run seed
   ```
   On Windows PowerShell, set it first: `$env:DATABASE_URL="<external-database-url>"; npm run seed`

### Option B: Manual setup

1. **New → PostgreSQL** → create a database and copy its **Internal Database URL**.
2. **New → Web Service** → this repository, with:

   | Setting | Value |
   | :--- | :--- |
   | Root Directory | `backend` |
   | Build Command | `npm ci --omit=dev` |
   | Start Command | `npm run migrate && npm start` |
   | Health Check Path | `/api/health` |

3. Environment variables:

   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Internal Database URL from step 1 |
   | `DB_SSL` | `false` (Render internal URL only) |
   | `JWT_SECRET` | The secret generated above |
   | `CORS_ORIGIN` | Set in Step 4 |

> **Using Neon or Supabase instead?** Use the **direct** connection string, not the pooled one (Neon: the host without `-pooler`). Live updates use PostgreSQL `LISTEN/NOTIFY`, which connection poolers in transaction mode do not support. Keep SSL on (don't set `DB_SSL`).

---

## 3. Frontend (Vercel)

1. Vercel → **Add New → Project** → import this repository.
2. Settings:

   | Setting | Value |
   | :--- | :--- |
   | Root Directory | `frontend` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

3. Environment variable:

   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://<your-api>.onrender.com/api` |

4. Deploy. [`frontend/vercel.json`](frontend/vercel.json) makes page refreshes on routes such as `/auctions/3` work.

> **Netlify:** base directory `frontend`, build command `npm run build`, publish directory `frontend/dist`, same `VITE_API_URL`. [`frontend/public/_redirects`](frontend/public/_redirects) handles routing.

`VITE_API_URL` is compiled into the build, so **redeploy the frontend whenever it changes**.

---

## 4. Connect Frontend and Backend

1. Copy your frontend URL (e.g. `https://bidzone.vercel.app`).
2. On Render, set `CORS_ORIGIN` on the backend to that URL. Separate several URLs with commas; no trailing slash.
3. Save. Render redeploys the backend automatically.

---

## 5. Verify the Deployment

| Check | Expected |
| :--- | :--- |
| `/api/health` | `"database": "connected"` |
| Open the frontend | Auctions load; footer shows *API + PostgreSQL online* |
| Log in as `bob@bidzone.local` / `password123` | Login succeeds |
| Open the same auction in two browsers (Bob and Charlie) and bid from one | The other updates instantly with an outbid notification |
| Create an auction ending in 2 minutes and bid on it | Within ~15 seconds of closing, the winner sees the winner banner |

---

## 6. Production Behaviour

With `NODE_ENV=production` the API:

* **Refuses to start** without a `JWT_SECRET` of at least 32 characters.
* **Accepts browser requests only** from origins listed in `CORS_ORIGIN`.
* **Disables the benchmark-only bidding modes** (`?strategy=naive|optimistic`, `?anti_sniping=`), so clients cannot bypass the row lock. Set `ALLOW_TEST_MODES=true` only on a private instance used for benchmarks.
* **Rate-limits** login attempts, sign-ups and bid attempts.
* **Applies the schema on every start** (`npm run migrate`, idempotent) and exits if it fails.

---

## 7. Notes and Limitations

* **Free-tier sleep:** Render's free web services sleep after 15 minutes without traffic. The first request afterwards can take 30–60 seconds, and live connections reconnect automatically once the service is awake. Open the site a minute before a demo.
* **Demo data ages:** Seed auctions are created relative to the time `npm run seed` runs, so they end after a few days. Before a demo, create fresh auctions from the UI.
* **Single API instance:** Rate-limit counters are kept in memory. Settlement and live events already work across several instances (advisory locks and `LISTEN/NOTIFY`), but rate limiting would need a shared store such as Redis.
* **Benchmarks and evidence scripts** are meant for local or CI runs, not against the production deployment.
