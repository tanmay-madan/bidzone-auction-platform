import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLive, useLiveEvents } from "../context/LiveContext";
import useNow from "../hooks/useNow";
import { formatINR, timeAgo } from "../utils/format";
import { Alert, AuctionImage, Avatar, Confetti, CountdownBlocks, Icon, Money, StatusBadge } from "../components/ui";

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
  const [notFound, setNotFound] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [liveNote, setLiveNote] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastPrice = useRef(null);
  const reloadedAtEnd = useRef(false);

  const load = useCallback(async () => {
    try {
      const [auctionRes, bidsRes] = await Promise.all([api.get(`/auctions/${id}`), api.get(`/auctions/${id}/bids`)]);
      const a = auctionRes.data.auction;
      if (lastPrice.current !== null && lastPrice.current !== a.current_highest_bid) setFlashKey((k) => k + 1);
      lastPrice.current = a.current_highest_bid;
      setAuction(a);
      setBids(bidsRes.data.bids);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reloadedAtEnd.current = false;
    lastPrice.current = null;
    load();
  }, [load]);

  // Live: other people's bids, anti-sniping extensions and settlement all
  // refresh the page instantly via the SSE stream.
  useLiveEvents((kind, data) => {
    if (data.auction_id !== Number(id)) return;
    if (kind === "bid" && data.bidder_id !== user?.id) {
      setLiveNote({ name: data.bidder_name, amount: data.amount, extended: data.extended, key: Date.now() });
      setTimeout(() => setLiveNote(null), 5000);
    }
    if (kind === "closed" && user && data.winner_id === user.id) setCelebrate(true);
    load();
  });

  // Fallback if the live stream is down: light polling.
  useEffect(() => {
    if (connected || !auction || auction.status === "CLOSED") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [connected, auction, load]);

  // When the countdown hits zero, refresh once to show the closed state.
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
    const idemKey = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    try {
      const res = await api.post(`/auctions/${id}/bids`, { amount: Number(amount) }, { headers: { "Idempotency-Key": idemKey } });
      setSuccess(res.data.message);
      setAmount("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not place bid.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: auction.title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // user cancelled
    }
  }

  if (loading) {
    return (
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="skeleton aspect-[4/3] rounded-xl" />
        <div className="space-y-4">
          <div className="skeleton h-12 w-3/4 rounded" />
          <div className="skeleton h-5 w-1/2 rounded" />
          <div className="skeleton h-72 rounded-xl" />
        </div>
      </div>
    );
  }
  if (notFound || !auction) {
    return (
      <div className="container-x py-24 text-center">
        <p className="font-display text-6xl">Lot not found</p>
        <p className="mt-3 text-mute">This auction may have been removed.</p>
        <Link to="/browse" className="btn-gold mt-8">
          Back to auctions
        </Link>
      </div>
    );
  }

  const inc = Number(auction.min_increment);
  const minNextBid = Number(auction.current_highest_bid) + inc;
  const timeUp = now >= endsAtMs;
  const isClosed = auction.status === "CLOSED" || timeUp;
  const isUpcoming = !timeUp && auction.status === "UPCOMING";
  const isOwnAuction = user && user.id === auction.seller_id;
  const isWinning = user && user.id === auction.current_highest_bidder_id;
  const hasBids = Number(auction.bid_count) > 0;
  const quick = [minNextBid, minNextBid + inc, minNextBid + inc * 4];
  const lift =
    Number(auction.starting_price) > 0
      ? ((Number(auction.current_highest_bid) - Number(auction.starting_price)) / Number(auction.starting_price)) * 100
      : 0;
  const maxBid = Math.max(...bids.map((b) => Number(b.amount)), 1);

  return (
    <div className="container-x py-8">
      {celebrate && <Confetti />}

      <nav className="mb-6 flex items-center justify-between gap-4 text-sm text-mute">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/browse" className="hover:text-ivory">
            Explore
          </Link>
          <span className="text-mute-dark">/</span>
          <span className="truncate text-ivory">{auction.title}</span>
        </div>
        <button onClick={share} className="glass inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-mute transition hover:text-ivory">
          {copied ? <Icon.Check className="h-3.5 w-3.5 text-win" /> : <Icon.Arrow className="h-3.5 w-3.5 -rotate-45" />}
          {copied ? "Link copied" : "Share"}
        </button>
      </nav>

      {isClosed && (
        <WinnerBanner
          auction={auction}
          isWinning={isWinning}
          isOwnAuction={isOwnAuction}
          winnerName={bids[0]?.bidder_name}
          onCelebrate={() => setCelebrate(true)}
        />
      )}

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        {/* ------------------------------ LEFT ------------------------------ */}
        <div className="space-y-8">
          <div className="panel relative overflow-hidden">
            <AuctionImage src={auction.image_url} title={auction.title} className="aspect-[4/3] w-full" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
            <div className="absolute left-4 top-4 flex gap-2">
              <StatusBadge status={isClosed ? "CLOSED" : auction.status} />
              <span className="chip-glass px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em]">
                Lot #{String(auction.id).padStart(4, "0")}
              </span>
            </div>
          </div>

          <div>
            <h1 className="font-display text-5xl leading-[1] text-ivory sm:text-6xl">{auction.title}</h1>
            <div className="mt-4 flex items-center gap-3 text-sm text-mute">
              <Avatar name={auction.seller_name} size={28} />
              <span>
                Listed by <span className="text-ivory">{auction.seller_name}</span>
              </span>
            </div>
            {auction.description && <p className="mt-6 max-w-2xl whitespace-pre-line leading-relaxed text-mute">{auction.description}</p>}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Starting price", formatINR(auction.starting_price)],
              ["Min increment", formatINR(auction.min_increment)],
              ["Total bids", auction.bid_count],
              ["Price lift", `${lift >= 0 ? "+" : ""}${lift.toFixed(1)}%`],
            ].map(([k, v]) => (
              <div key={k} className="glass spotlight rounded-lg px-4 py-3.5">
                <dt className="eyebrow text-[10px]">{k}</dt>
                <dd className="num mt-1.5 text-lg font-semibold text-ivory">{v}</dd>
              </div>
            ))}
          </dl>

          {/* Bid history with relative bars */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-3xl text-ivory">Bid history</h2>
              {!isClosed && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-win" : "bg-mute"}`} />
                  {connected ? "Live" : "Reconnecting…"}
                </span>
              )}
            </div>
            {bids.length === 0 ? (
              <div className="glass rounded-xl px-6 py-10 text-center text-mute">No bids yet. The opening bid could be yours.</div>
            ) : (
              <ol className="panel divide-y divide-line-soft overflow-hidden">
                {bids.map((bid, i) => (
                  <li key={bid.id} className={`relative flex items-center gap-4 px-5 py-3.5 ${i === 0 ? "animate-feed-in" : ""}`}>
                    <span
                      className={`absolute inset-y-0 left-0 ${i === 0 ? "bg-gold/[0.09]" : "bg-ivory/[0.025]"}`}
                      style={{ width: `${(Number(bid.amount) / maxBid) * 100}%` }}
                    />
                    <span className={`num relative w-6 text-sm ${i === 0 ? "text-gold" : "text-mute-dark"}`}>
                      {i === 0 ? <Icon.Trophy className="h-4 w-4" /> : `#${i + 1}`}
                    </span>
                    <span className="relative">
                      <Avatar name={bid.bidder_name} size={32} ring={i === 0} />
                    </span>
                    <div className="relative min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ivory">
                        {bid.bidder_name}
                        {user && bid.bidder_name === user.name && <span className="ml-2 text-xs text-gold">(you)</span>}
                        {i === 0 && isClosed && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">Winner</span>}
                      </p>
                      <p className="text-xs text-mute">{timeAgo(bid.created_at)}</p>
                    </div>
                    <span className={`num relative text-base font-semibold ${i === 0 ? "text-gold" : "text-ivory"}`}>{formatINR(bid.amount)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* ------------------------------ RIGHT ----------------------------- */}
        <aside className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong spotlight overflow-hidden rounded-xl">
            <div className="relative z-[2] border-b border-line p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{isClosed ? "Final price" : hasBids ? "Current highest bid" : "Opening price"}</p>
                  <p key={flashKey} className={`num -mx-1 mt-2 rounded px-1 text-5xl font-semibold text-gold ${flashKey ? "animate-flash" : ""}`}>
                    <Money value={auction.current_highest_bid} />
                  </p>
                </div>
                {isWinning && !isClosed && (
                  <span className="inline-flex shrink-0 animate-pop items-center gap-1.5 rounded-full border border-win/30 bg-win/10 px-3 py-1 text-xs font-semibold text-win">
                    <Icon.Trophy className="h-3.5 w-3.5" /> You're winning
                  </span>
                )}
              </div>
              {liveNote && (
                <div key={liveNote.key} className="mt-4 flex animate-slide-in items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm">
                  <Icon.Bolt className="h-4 w-4 shrink-0 text-gold" />
                  <span className="text-ivory">
                    <b className="font-semibold">{liveNote.name}</b> just bid <span className="num text-gold">{formatINR(liveNote.amount)}</span>
                    {liveNote.extended && <span className="text-mute"> · closing extended 2 min</span>}
                  </span>
                </div>
              )}
            </div>

            <div className="relative z-[2] space-y-5 p-6">
              {isClosed ? (
                <div className="rounded-lg border border-line bg-night-800/40 p-5 text-center">
                  <Icon.Trophy className="mx-auto h-8 w-8 text-gold" />
                  <p className="mt-3 font-display text-3xl">
                    {auction.current_highest_bidder_id ? (isWinning ? "You won this lot!" : "Auction closed") : "Closed without bids"}
                  </p>
                  {auction.current_highest_bidder_id && (
                    <p className="mt-1 text-sm text-mute">
                      Sold for <span className="num text-gold">{formatINR(auction.current_highest_bid)}</span>
                      {bids[0] && !isWinning && <> to {bids[0].bidder_name}</>}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <p className="eyebrow mb-2">{isUpcoming ? "Opens in" : "Closes in"}</p>
                    <CountdownBlocks endsAt={isUpcoming ? auction.starts_at : auction.ends_at} />
                    <p className="mt-2 text-xs text-mute">
                      {new Date(isUpcoming ? auction.starts_at : auction.ends_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>

                  {isUpcoming ? (
                    <div className="rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">Bidding opens when the countdown ends.</div>
                  ) : !isAuthed ? (
                    <Link to="/login" state={{ from: { pathname: `/auctions/${id}` } }} className="btn-gold w-full py-3 text-[15px]">
                      Log in to place a bid
                    </Link>
                  ) : isOwnAuction ? (
                    <div className="rounded-lg border border-line bg-night-800/40 px-4 py-3 text-sm text-mute">
                      This is your listing — sellers can't bid on their own auctions.
                    </div>
                  ) : (
                    <form onSubmit={handleBid} className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <label htmlFor="bid" className="text-mute">
                          Your bid
                        </label>
                        <span className="text-mute">
                          Min <span className="num text-ivory">{formatINR(minNextBid)}</span>
                        </span>
                      </div>
                      <div className="relative">
                        <span className="num pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-mute">₹</span>
                        <input
                          id="bid"
                          type="number"
                          required
                          min={minNextBid}
                          step="1"
                          placeholder={String(minNextBid)}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="input num py-3.5 pl-10 text-xl font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {quick.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setAmount(String(q))}
                            className={`num rounded border px-2 py-2 text-xs transition ${
                              Number(amount) === q ? "border-gold bg-gold/15 text-gold" : "border-line text-mute hover:border-gold/50 hover:text-ivory"
                            }`}
                          >
                            {formatINR(q)}
                          </button>
                        ))}
                      </div>
                      <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 text-[15px]">
                        {submitting ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Securing your bid…
                          </>
                        ) : (
                          <>
                            <Icon.Gavel className="h-4 w-4" /> Place bid
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {error && <Alert kind="error">{error}</Alert>}
                  {success && <Alert kind="success">{success}</Alert>}
                </>
              )}
            </div>

            <div className="relative z-[2] grid grid-cols-3 divide-x divide-line border-t border-line text-center">
              {[
                [Icon.Lock, "Row-locked"],
                [Icon.Key, "Idempotent"],
                [Icon.Shield, "Server-validated"],
              ].map(([I, t]) => (
                <div key={t} className="flex flex-col items-center gap-1 px-2 py-3 text-[11px] text-mute">
                  <I className="h-4 w-4 text-gold" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WinnerBanner({ auction, isWinning, isOwnAuction, winnerName, onCelebrate }) {
  const price = formatINR(auction.current_highest_bid);
  const hasWinner = Boolean(auction.current_highest_bidder_id);

  // Celebrate once when a winner opens their won auction.
  useEffect(() => {
    if (isWinning) onCelebrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWinning]);

  let title, text, tone;
  if (!hasWinner) {
    title = "Auction ended without bids";
    text = isOwnAuction ? "No one bid on this item. You can list it again anytime." : "This item did not sell.";
    tone = "from-mute/20";
  } else if (isWinning) {
    title = "Congratulations — you won this auction!";
    text = `Your winning bid was ${price}.`;
    tone = "from-win/25";
  } else if (isOwnAuction) {
    title = `Your item sold for ${price}`;
    text = winnerName ? `Winning bidder: ${winnerName}.` : "The auction has a winning bidder.";
    tone = "from-gold/25";
  } else {
    title = "This auction has ended";
    text = `Sold for ${price}${winnerName ? ` to ${winnerName}` : ""}.`;
    tone = "from-gold/15";
  }

  return (
    <div className={`glass mb-8 flex animate-rise items-center gap-4 overflow-hidden rounded-xl bg-gradient-to-r ${tone} to-transparent p-5`}>
      <div className="flex h-12 w-12 shrink-0 animate-pop items-center justify-center rounded-full btn-gold p-0">
        <Icon.Trophy className="h-6 w-6" />
      </div>
      <div>
        <p className="font-display text-2xl text-ivory">{title}</p>
        <p className="mt-0.5 text-sm text-mute">{text}</p>
      </div>
    </div>
  );
}
