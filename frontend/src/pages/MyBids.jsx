import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatINR } from "../utils/format";
import { CountdownText, EmptyState, Icon, StatusBadge } from "../components/ui";
import { useLiveEvents } from "../context/LiveContext";
import { Stat } from "./MyAuctions";

function outcome(b) {
  const closed = b.status === "CLOSED";
  if (b.is_winning) return closed ? ["Won", "border-win/30 bg-win/10 text-win"] : ["Winning", "border-win/30 bg-win/10 text-win"];
  return closed ? ["Lost", "border-line-strong bg-ivory/5 text-mute"] : ["Outbid", "border-live/30 bg-live/10 text-live"];
}

export default function MyBids() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    return api
      .get("/my-bids")
      .then((res) => setBids(res.data.bids))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Winning / Outbid / Won flips live when any auction I'm in changes.
  useLiveEvents((kind, data) => {
    if (bids.some((b) => b.auction_id === data.auction_id)) load();
  });

  const winning = bids.filter((b) => b.is_winning && b.status !== "CLOSED").length;
  const outbid = bids.filter((b) => !b.is_winning && b.status !== "CLOSED").length;
  const won = bids.filter((b) => b.is_winning && b.status === "CLOSED").length;

  return (
    <div className="container-x py-12">
      <p className="eyebrow text-gold">Bidder dashboard</p>
      <h1 className="mt-2 font-display text-6xl leading-none text-ivory">My bids</h1>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Auctions joined" value={bids.length} icon={Icon.Gavel} />
        <Stat label="Winning" value={winning} icon={Icon.Trophy} tone="text-win" />
        <Stat label="Outbid" value={outbid} icon={Icon.Alert} tone="text-live" />
        <Stat label="Won" value={won} icon={Icon.Check} tone="text-gold" />
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
        ) : bids.length === 0 ? (
          <EmptyState title="No bids yet" text="Find something you love and make your first offer." action="Explore auctions" to="/browse" />
        ) : (
          <div className="panel overflow-hidden">
            <div className="hidden grid-cols-[1fr_140px_140px_120px] gap-4 border-b border-line px-5 py-3 sm:grid">
              {["Auction", "Your bid", "Highest", "Status"].map((h) => (
                <span key={h} className="eyebrow text-[10px] last:text-right">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-line-soft">
              {bids.map((b) => {
                const [label, cls] = outcome(b);
                return (
                  <Link key={b.auction_id} to={`/auctions/${b.auction_id}`} className="group grid grid-cols-2 items-center gap-4 px-5 py-4 transition hover:bg-ivory/[0.04] sm:grid-cols-[1fr_140px_140px_120px]">
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-ivory group-hover:text-gold">{b.title}</p>
                        <StatusBadge status={b.status} className="hidden md:inline-flex" />
                      </div>
                      <p className="mt-1 text-xs text-mute">
                        {b.status === "CLOSED" ? "Auction ended" : <>Ends in <CountdownText endsAt={b.ends_at} /></>}
                      </p>
                    </div>
                    <span className="num text-sm text-ivory">{formatINR(b.my_latest_bid)}</span>
                    <span className="num text-sm font-semibold text-gold">{formatINR(b.current_highest_bid)}</span>
                    <span className="col-span-2 sm:col-span-1 sm:text-right">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
