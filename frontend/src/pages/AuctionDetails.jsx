import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatINR, formatTimeRemaining, timeAgo } from "../utils/format";

export default function AuctionDetails() {
  const { id } = useParams();
  const { user, isAuthed } = useAuth();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [auctionRes, bidsRes] = await Promise.all([
      api.get(`/auctions/${id}`),
      api.get(`/auctions/${id}/bids`),
    ]);
    setAuction(auctionRes.data.auction);
    setBids(bidsRes.data.bids);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Every submitted bid goes straight to the backend, which is the
  // only place the invariant is actually enforced. The frontend never
  // decides whether a bid is valid — it just reports what the server
  // said, including the specific error code. A fresh Idempotency-Key
  // per attempt means a dropped connection + retry can't ever create
  // a second bid — the backend just replays the first result.
  async function handleBid(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    const idemKey =
      window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    try {
      const res = await api.post(
        `/auctions/${id}/bids`,
        { amount: Number(amount) },
        { headers: { "Idempotency-Key": idemKey } }
      );
      setSuccess(res.data.message);
      setAmount("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not place bid.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-6 py-16 text-slate">Loading auction...</div>;
  }
  if (!auction) {
    return <div className="mx-auto max-w-4xl px-6 py-16 text-slate">Auction not found.</div>;
  }

  const minNextBid = Number(auction.current_highest_bid) + Number(auction.min_increment);
  const isClosed = auction.status === "CLOSED";
  const isUpcoming = auction.status === "UPCOMING";
  const isOwnAuction = user && user.id === auction.seller_id;
  const isWinning = user && user.id === auction.current_highest_bidder_id;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 grid md:grid-cols-2 gap-10">
      <div>
        <img
          src={auction.image_url || "https://picsum.photos/seed/bidzone-fallback/700/525"}
          alt={auction.title}
          className="w-full aspect-[4/3] object-cover rounded-lg border border-border"
        />
      </div>

      <div>
        <h1 className="font-display text-3xl text-ink">{auction.title}</h1>
        <p className="mt-2 text-slate">{auction.description}</p>
        <p className="mt-3 text-sm text-slate">Seller: {auction.seller_name}</p>

        <div className="mt-6 rounded-lg border border-border p-5 bg-white">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate">Current Bid</p>
              <p className="font-display text-3xl text-navy">
                {formatINR(auction.current_highest_bid)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate">
                {isClosed ? "Ended" : isUpcoming ? "Starts soon" : "Ends in"}
              </p>
              <p className="text-sm font-medium text-brass-dark">
                {isClosed ? "Auction closed" : formatTimeRemaining(auction.ends_at)}
              </p>
            </div>
          </div>

          {isWinning && !isClosed && (
            <p className="mt-3 text-sm text-success font-medium">You are currently winning.</p>
          )}
          {isClosed && auction.current_highest_bidder_id && (
            <p className="mt-3 text-sm text-ink">
              Winner: {isWinning ? "You" : "another bidder"} — final bid{" "}
              {formatINR(auction.current_highest_bid)}
            </p>
          )}

          {!isClosed && !isUpcoming && (
            <>
              <p className="mt-4 text-xs text-slate">
                Next minimum bid: {formatINR(minNextBid)}
              </p>

              {!isAuthed ? (
                <Link
                  to="/login"
                  className="mt-3 block text-center w-full rounded bg-navy text-paper py-2.5 font-medium hover:bg-navy-light transition-colors"
                >
                  Log in to bid
                </Link>
              ) : isOwnAuction ? (
                <p className="mt-3 text-sm text-slate">You can't bid on your own auction.</p>
              ) : (
                <form onSubmit={handleBid} className="mt-3 flex gap-2">
                  <input
                    type="number"
                    required
                    min={minNextBid}
                    step="1"
                    placeholder={minNextBid}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 rounded border border-border px-3 py-2 focus:border-navy outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded bg-navy text-paper px-5 font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
                  >
                    {submitting ? "Placing..." : "Place Bid"}
                  </button>
                </form>
              )}

              {error && <p className="mt-2 text-sm text-[#B4463F]">{error}</p>}
              {success && <p className="mt-2 text-sm text-success">{success}</p>}
            </>
          )}
        </div>

        <div className="mt-8">
          <h2 className="font-display text-xl text-ink mb-3">Bid History</h2>
          {bids.length === 0 ? (
            <p className="text-sm text-slate">No bids yet. Be the first.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-white">
              {bids.map((bid) => (
                <li key={bid.id} className="flex justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-ink">{formatINR(bid.amount)}</span>
                  <span className="text-slate">{bid.bidder_name}</span>
                  <span className="text-slate">{timeAgo(bid.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
