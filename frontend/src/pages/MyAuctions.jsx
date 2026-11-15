import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatINR } from "../utils/format";
import { AuctionImage, CountdownText, EmptyState, Icon, Money, StatusBadge } from "../components/ui";
import { applyLiveEvent, useLiveEvents } from "../context/LiveContext";

export default function MyAuctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/my-auctions")
      .then((res) => setAuctions(res.data.auctions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // New bids on my listings and closings update this dashboard live.
  useLiveEvents((kind, data) => setAuctions((list) => applyLiveEvent(list, kind, data)));

  const live = auctions.filter((a) => a.status === "ACTIVE").length;
  const bids = auctions.reduce((s, a) => s + Number(a.bid_count || 0), 0);
  const value = auctions.reduce((s, a) => s + (Number(a.bid_count) > 0 ? Number(a.current_highest_bid) : 0), 0);

  return (
    <div className="container-x py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-gold">Seller dashboard</p>
          <h1 className="mt-2 font-display text-6xl leading-none text-ivory">My auctions</h1>
        </div>
        <Link to="/create" className="btn-gold">
          <Icon.Plus className="h-4 w-4" /> List an item
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Listings" value={auctions.length} icon={Icon.Gavel} />
        <Stat label="Live now" value={live} icon={Icon.Bolt} />
        <Stat label="Bids received" value={bids} icon={Icon.Users} />
        <Stat label="Value bid" value={<Money value={value} />} icon={Icon.Chart} />
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        ) : auctions.length === 0 ? (
          <EmptyState title="No listings yet" text="Put something on the floor and watch the bids roll in." action="List your first item" to="/create" />
        ) : (
          <div className="panel divide-y divide-line-soft overflow-hidden">
            {auctions.map((a) => (
              <Link key={a.id} to={`/auctions/${a.id}`} className="group flex items-center gap-4 p-4 transition hover:bg-ivory/[0.04]">
                <AuctionImage src={a.image_url} title={a.title} className="h-16 w-20 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-ivory group-hover:text-gold">{a.title}</p>
                    <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                  </div>
                  <p className="mt-1 text-xs text-mute">
                    {a.bid_count} bids ·{" "}
                    {a.status === "CLOSED" ? "Ended" : <>Ends in <CountdownText endsAt={a.ends_at} /></>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="eyebrow text-[10px]">{a.status === "CLOSED" ? "Final" : "Current"}</p>
                  <p className="num mt-1 font-semibold text-gold"><Money value={a.current_highest_bid} /></p>
                </div>
                <Icon.Arrow className="hidden h-4 w-4 text-mute-dark transition group-hover:translate-x-1 group-hover:text-gold sm:block" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Stat({ label, value, icon: I, tone = "text-ivory" }) {
  return (
    <div className="panel spotlight flex items-center justify-between p-5">
      <div>
        <p className="eyebrow text-[10px]">{label}</p>
        <p className={`num mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      </div>
      {I && (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-night-900/60 text-gold">
          <I className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}
