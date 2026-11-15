import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import AuctionCard from "../components/AuctionCard";
import { applyLiveEvent, useLive, useLiveEvents } from "../context/LiveContext";
import {
  AnimatedNumber,
  AuctionImage,
  CardSkeleton,
  CountdownBlocks,
  EmptyState,
  Icon,
  Money,
  Reveal,
  StatusBadge,
} from "../components/ui";
import { formatINR, timeAgo } from "../utils/format";
import useNow from "../hooks/useNow";

const STEPS = [
  {
    icon: Icon.Lock,
    code: "BEGIN; SELECT … FOR UPDATE",
    title: "Lock the auction row",
    text: "Every bid opens a transaction and takes a row-level lock. Competing bids on the same lot queue up instead of racing.",
  },
  {
    icon: Icon.Clock,
    code: "starts_at <= now() < ends_at",
    title: "Validate on the DB clock",
    text: "Open/closed is decided by PostgreSQL's clock, never the browser's — and the minimum increment is checked against fresh state.",
  },
  {
    icon: Icon.Db,
    code: "INSERT bid · UPDATE auction",
    title: "Write atomically",
    text: "The bid history row and the new highest bid commit together. They can never disagree.",
  },
  {
    icon: Icon.Bolt,
    code: "pg_notify → Server-Sent Events",
    title: "Broadcast on commit",
    text: "Only committed bids are pushed live to every open browser — a rolled-back bid is never shown to anyone.",
  },
];

// Featured lot card that tilts gently toward the cursor.
function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  function onMove(e) {
    const el = ref.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(0)`;
  }
  function reset() {
    if (ref.current) ref.current.style.transform = "";
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={`transition-transform duration-300 ease-out ${className}`}>
      {children}
    </div>
  );
}

function ActivityFeed() {
  const { activity, connected } = useLive();
  useNow(15000); // refresh "x min ago"
  return (
    <div className="panel spotlight overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon.Activity className="h-4 w-4 text-gold" />
          <p className="font-semibold text-ivory">Live activity</p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mute">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-win" : "bg-mute"}`} />
          {connected ? "Streaming" : "Connecting"}
        </span>
      </div>
      {activity.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-mute">Waiting for the next bid…</p>
          <p className="mt-1 text-xs text-mute-dark">New bids appear here the instant they commit.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {activity.map((a) => (
            <li key={a.key} className="animate-feed-in overflow-hidden">
              <Link to={`/auctions/${a.auction_id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-ivory/[0.04]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Icon.Gavel className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-ivory">{a.bidder_name}</span>
                  <span className="text-mute"> bid on </span>
                  <span className="truncate text-ivory">{a.title}</span>
                  <span className="block text-xs text-mute-dark">{timeAgo(new Date(a.at).toISOString())}</span>
                </span>
                <span className="num text-sm font-semibold text-gold">{formatINR(a.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [auctions, setAuctions] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/auctions", { params: { status: "ACTIVE", sort: "ending" } }), api.get("/auctions")])
      .then(([live, everything]) => {
        setAuctions(live.data.auctions);
        setAll(everything.data.auctions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useLiveEvents((kind, data) => {
    setAuctions((list) => applyLiveEvent(list, kind, data));
    setAll((list) => applyLiveEvent(list, kind, data));
  });

  const featured = [...auctions].sort((a, b) => Number(b.current_highest_bid) - Number(a.current_highest_bid))[0];
  const totalBids = all.reduce((s, a) => s + Number(a.bid_count || 0), 0);
  const liveValue = auctions.reduce((s, a) => s + Number(a.current_highest_bid || 0), 0);

  return (
    <div>
      {/* ---------------------------------- HERO --------------------------------- */}
      <section className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="container-x relative grid items-center gap-12 pb-16 pt-12 lg:grid-cols-[1.15fr_1fr] lg:pt-16">
          <div className="animate-rise">
            <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-mute">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-live opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-live" />
              </span>
              {loading ? "Connecting…" : `${auctions.length} live ${auctions.length === 1 ? "auction" : "auctions"} right now`}
            </div>

            <h1 className="mt-6 font-display text-[54px] leading-[0.95] tracking-tight text-ivory sm:text-[76px] lg:text-[88px]">
              Every bid lands.
              <br />
              <span className="text-gradient italic">Exactly once.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-mute">
              BidZone is a live auction house engineered for the moment ten people hit “Bid” in the same millisecond —
              transactional, lock-protected, and streamed to every screen in real time.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/browse" className="btn-gold px-6 py-3 text-[15px]">
                Explore live auctions <Icon.Arrow className="h-4 w-4" />
              </Link>
              <Link to="/create" className="btn-ghost px-6 py-3 text-[15px]">
                List an item
              </Link>
            </div>

            <dl className="glass mt-12 grid max-w-lg grid-cols-3 divide-x divide-line rounded-xl">
              {[
                ["Live lots", <AnimatedNumber key="a" value={auctions.length} />],
                ["Bids placed", <AnimatedNumber key="b" value={totalBids} />],
                ["Live value", <Money key="c" value={liveValue} />],
              ].map(([k, v]) => (
                <div key={k} className="px-4 py-4">
                  <dt className="eyebrow text-[10px]">{k}</dt>
                  <dd className="num mt-1.5 truncate text-lg font-semibold text-ivory sm:text-xl">{loading ? "—" : v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured lot */}
          <div className="relative animate-rise [animation-delay:150ms]">
            <div className="absolute -inset-8 rounded-[48px] bg-gold/15 blur-3xl" />
            {featured ? (
              <TiltCard>
                <Link to={`/auctions/${featured.id}`} className="spotlight panel group relative block overflow-hidden">
                  <div className="relative aspect-[5/4] overflow-hidden rounded-t-xl">
                    <AuctionImage src={featured.image_url} title={featured.title} className="h-full w-full transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute left-4 top-4 flex gap-2">
                      <StatusBadge status="ACTIVE" />
                      <span className="chip-glass px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gold-light">
                        Featured lot
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-5 right-5">
                      <h2 className="font-display text-4xl leading-none text-white">{featured.title}</h2>
                      <p className="mt-2 text-sm text-white/70">
                        by {featured.seller_name} · {featured.bid_count} bids
                      </p>
                    </div>
                  </div>
                  <div className="relative z-[2] space-y-4 p-5">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="eyebrow">Current bid</p>
                        <p className="num mt-1 text-4xl font-semibold text-gold">
                          <Money value={featured.current_highest_bid} />
                        </p>
                      </div>
                      <span className="btn-gold">
                        Bid now <Icon.Arrow className="h-4 w-4" />
                      </span>
                    </div>
                    <CountdownBlocks endsAt={featured.ends_at} />
                  </div>
                </Link>
              </TiltCard>
            ) : (
              <div className="panel relative flex aspect-[5/5.2] flex-col items-center justify-center p-10 text-center">
                {loading ? (
                  <div className="skeleton h-full w-full rounded-lg" />
                ) : (
                  <>
                    <Icon.Gavel className="h-10 w-10 text-gold" />
                    <p className="mt-4 font-display text-3xl">The floor is quiet.</p>
                    <p className="mt-2 text-sm text-mute">Be the first to list an item.</p>
                    <Link to="/create" className="btn-gold mt-6">
                      List an item
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ticker */}
        {all.length > 0 && (
          <div className="glass relative overflow-hidden border-x-0 py-3">
            <div className="flex w-max animate-marquee gap-10 whitespace-nowrap hover:[animation-play-state:paused]">
              {[...all, ...all].map((a, i) => (
                <Link key={i} to={`/auctions/${a.id}`} className="inline-flex items-center gap-3 text-sm text-mute hover:text-ivory">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.status === "ACTIVE" ? "bg-live" : a.status === "UPCOMING" ? "bg-info" : "bg-mute-dark"}`} />
                  <span className="text-ivory">{a.title}</span>
                  <span className="num text-gold">{formatINR(a.current_highest_bid)}</span>
                  <span className="text-mute-dark">/</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ------------------------- LIVE AUCTIONS + ACTIVITY ------------------------ */}
      <section className="container-x pt-20">
        <Reveal className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-gold">On the floor</p>
            <h2 className="mt-2 font-display text-5xl text-ivory">Closing soonest</h2>
          </div>
          <Link to="/browse" className="hidden items-center gap-1.5 text-sm text-mute hover:text-gold sm:inline-flex">
            View all auctions <Icon.Arrow className="h-4 w-4" />
          </Link>
        </Reveal>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div>
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
              </div>
            ) : auctions.length === 0 ? (
              <EmptyState title="No live auctions" text="Nothing is open for bidding right now." action="Create the first one" to="/create" />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {auctions.slice(0, 4).map((a, i) => (
                  <AuctionCard key={a.id} auction={a} index={i} />
                ))}
              </div>
            )}
          </div>
          <Reveal delay={120} className="xl:sticky xl:top-24 xl:self-start">
            <ActivityFeed />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------ ENGINEERING ------------------------------- */}
      <section className="container-x pt-28">
        <Reveal className="panel relative overflow-hidden p-8 sm:p-12">
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow text-gold">Under the hood</p>
              <h2 className="mt-3 font-display text-5xl leading-[1] text-ivory">
                Built for the <span className="text-gradient italic">same-millisecond</span> bid.
              </h2>
              <p className="mt-5 leading-relaxed text-mute">
                Naive auction sites read the highest bid, compare, then write — and two bidders can both “win”. BidZone serialises
                bids per auction inside PostgreSQL, so the leaderboard and the bid history are always in agreement.
              </p>
              <div className="mt-8 rounded-lg border border-line bg-[#0B0D12]/90 p-4 font-mono text-[12.5px] leading-6 text-white/90">
                <div className="text-white/40">-- 3 bids of ₹11,000 arrive together</div>
                <div><span className="text-[#3DDC97]">✓</span> Rahul <span className="text-white/50">→ 201 ACCEPTED</span></div>
                <div><span className="text-[#FF5C50]">✕</span> Aman <span className="text-white/50">→ 409 BID_TOO_LOW</span></div>
                <div><span className="text-[#FF5C50]">✕</span> Priya <span className="text-white/50">→ 409 BID_TOO_LOW</span></div>
                <div className="mt-1 text-[#F2B544]">highest_bid = 11000 · accepted_rows = 1</div>
              </div>
            </div>

            <ol className="grid gap-4 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <Reveal as="li" delay={i * 90} key={s.title} className="spotlight glass rounded-xl p-5 transition hover:-translate-y-1">
                  <div className="relative z-[2]">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
                        <s.icon className="h-5 w-5" />
                      </span>
                      <span className="num text-xs text-mute-dark">0{i + 1}</span>
                    </div>
                    <h3 className="mt-4 font-semibold text-ivory">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.text}</p>
                    <code className="mt-4 block truncate rounded border border-line-soft bg-[#0B0D12]/90 px-2.5 py-1.5 font-mono text-[11.5px] text-[#F8CD78]">
                      {s.code}
                    </code>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>

      {/* ---------------------------------- CTA ---------------------------------- */}
      <section className="container-x pt-20">
        <Reveal className="glass relative overflow-hidden rounded-2xl px-8 py-14 text-center">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-info/20 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-5xl text-ivory sm:text-6xl">
              Have something worth <span className="text-gradient italic">fighting for?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-mute">
              Set a starting price, a minimum increment and a closing time. Let the room decide the rest.
            </p>
            <Link to="/create" className="btn-gold mt-8 px-7 py-3 text-[15px]">
              <Icon.Plus className="h-4 w-4" /> Start an auction
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
