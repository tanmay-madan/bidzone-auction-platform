import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLive, useLiveEvents } from "../context/LiveContext";
import useNow from "../hooks/useNow";
import { formatINR, formatTimeRemaining, timeAgo } from "../utils/format";

export default function AuctionDetails() {
  const { id } = useParams();
  const { user, isAuthed } = useAuth();
  const { connected } = useLive();
  const now = useNow(1000);

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveNote, setLiveNote] = useState("");
  const reloadedAtEnd = useRef(false);

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
    reloadedAtEnd.current = false;
    load();
  }, [load]);

  // Live updates: someone else's bid, an anti-sniping extension, or the
  // auction being settled all refresh this page instantly (no polling).
  useLiveEvents((kind, data) => {
    if (data.auction_id !== Number(id)) return;
    if (kind === "bid" && data.bidder_id !== user?.id) {
      setLiveNote(
        `New bid: ${formatINR(data.amount)}${data.extended ? " — closing time extended by 2 minutes" : ""}`
      );
      setTimeout(() => setLiveNote(""), 5000);
    }
    load();
  });

  // When the countdown reaches zero, refresh once so the page shows the
  // closed state (the backend's settlement then confirms the winner).
  const endsAtMs = auction ? new Date(auction.ends_at).getTime() : null;
  useEffect(() => {
    if (!auction || auction.status === "CLOSED" || reloadedAtEnd.current) return;
    if (now >= endsAtMs) {
      reloadedAtEnd.current = true;
      load();
    }
  }, [now, endsAtMs, auction, load]);

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
  const timeUp = now >= endsAtMs;
  const isClosed = auction.status === "CLOSED" || timeUp;
  const isUpcoming = auction.status === "UPCOMING" && !timeUp;
  const isOwnAuction = user && user.id === auction.seller_id;
  const isWinning = user && user.id === auction.current_highest_bidder_id;
  const hasWinner = Boolean(auction.current_highest_bidder_id);
  const urgent = !isClosed && !isUpcoming && endsAtMs - now < 2 * 60 * 1000;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Winner banner once the auction has ended */}
      {isClosed && (
        <WinnerBanner
          auction={auction}
          isWinning={isWinning}
          isOwnAuction={isOwnAuction}
          winnerName={bids[0]?.bidder_name}
          hasWinner={hasWinner}
        />
      )}

      <div className="grid md:grid-cols-2 gap-10">
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
                <p className="text-xs text-slate">{isClosed ? "Final Bid" : "Current Bid"}</p>
                <p
                  key={auction.current_highest_bid}
                  className="price-flash font-display text-3xl text-navy tabular-nums -mx-1 px-1"
                >
                  {formatINR(auction.current_highest_bid)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate">
                  {isClosed ? "Ended" : isUpcoming ? "Starts in" : "Ends in"}
                </p>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    urgent ? "text-[#B4463F]" : "text-brass-dark"
                  }`}
                >
                  {isClosed
                    ? "Auction closed"
                    : formatTimeRemaining(isUpcoming ? auction.starts_at : auction.ends_at, now)}
                </p>
              </div>
            </div>

            {liveNote && (
              <p className="toast-in mt-3 rounded bg-[#F6F3EC] border border-brass/40 px-3 py-2 text-sm text-ink">
                {liveNote}
              </p>
            )}

            {isWinning && !isClosed && (
              <p className="mt-3 text-sm text-success font-medium">You are currently winning.</p>
            )}

            {!isClosed && !isUpcoming && (
              <>
                <p className="mt-4 text-xs text-slate">
                  Next minimum bid: {formatINR(minNextBid)}
                </p>

                {!isAuthed ? (
                  <Link
                    to="/login"
                    state={{ from: { pathname: `/auctions/${id}` } }}
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl text-ink">Bid History</h2>
              {!isClosed && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate">
                  <span
                    className={`h-2 w-2 rounded-full ${connected ? "bg-success live-pulse" : "bg-slate-light"}`}
                  />
                  {connected ? "Live" : "Reconnecting…"}
                </span>
              )}
            </div>
            {bids.length === 0 ? (
              <p className="text-sm text-slate">No bids yet. Be the first.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-white">
                {bids.map((bid, i) => (
                  <li
                    key={bid.id}
                    className={`flex justify-between px-4 py-3 text-sm ${i === 0 ? "bg-[#F6F3EC]" : ""}`}
                  >
                    <span className={`font-medium ${i === 0 ? "text-navy" : "text-ink"}`}>
                      {formatINR(bid.amount)}
                    </span>
                    <span className="text-slate">
                      {bid.bidder_name}
                      {i === 0 && isClosed && (
                        <span className="ml-1.5 text-xs font-medium text-brass-dark">Winner</span>
                      )}
                    </span>
                    <span className="text-slate">{timeAgo(bid.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WinnerBanner({ auction, isWinning, isOwnAuction, winnerName, hasWinner }) {
  const price = formatINR(auction.current_highest_bid);

  let title;
  let text;
  let tone = "border-border bg-white";
  if (!hasWinner) {
    title = "Auction ended without bids";
    text = isOwnAuction ? "No one bid on this item. You can list it again anytime." : "This item did not sell.";
  } else if (isWinning) {
    title = "Congratulations — you won this auction!";
    text = `Your winning bid was ${price}.`;
    tone = "border-success/40 bg-[#EEF6F1]";
  } else if (isOwnAuction) {
    title = `Your item sold for ${price}`;
    text = winnerName ? `Winning bidder: ${winnerName}.` : "The auction has a winning bidder.";
    tone = "border-brass/50 bg-[#F6F3EC]";
  } else {
    title = "This auction has ended";
    text = `Sold for ${price}${winnerName ? ` to ${winnerName}` : ""}.`;
  }

  return (
    <div className={`toast-in mb-8 flex items-center gap-4 rounded-lg border p-5 ${tone}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-brass-light">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
          <path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" />
        </svg>
      </div>
      <div>
        <p className="font-display text-xl text-ink">{title}</p>
        <p className="text-sm text-slate mt-0.5">{text}</p>
      </div>
    </div>
  );
}
