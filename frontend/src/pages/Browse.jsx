import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import AuctionCard from "../components/AuctionCard";
import { applyLiveEvent, useLive, useLiveEvents } from "../context/LiveContext";
import { CardSkeleton, EmptyState, Icon } from "../components/ui";

const FILTERS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Live" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "CLOSED", label: "Ended" },
];

export default function Browse() {
  // Filters live in the URL, so a filtered view can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const sort = params.get("sort") || "ending";
  const [query, setQuery] = useState(params.get("q") || "");
  const [search, setSearch] = useState(query.trim());
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { connected } = useLive();

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setParam("q", query.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    setLoading(true);
    const p = { sort };
    if (search) p.search = search;
    if (status) p.status = status;
    api
      .get("/auctions", { params: p })
      .then((res) => setAuctions(res.data.auctions))
      .catch(() => setAuctions([]))
      .finally(() => setLoading(false));
  }, [search, sort, status]);

  // Prices, bid counts and closings update live without refreshing.
  useLiveEvents((kind, data) => setAuctions((list) => applyLiveEvent(list, kind, data)));

  return (
    <div className="container-x py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-gold">Marketplace</p>
          <h1 className="mt-2 font-display text-5xl leading-none text-ivory sm:text-6xl">Explore auctions</h1>
          <p className="mt-3 text-mute">
            {loading ? "Loading lots…" : `${auctions.length} ${auctions.length === 1 ? "lot" : "lots"} found`}
          </p>
        </div>
        <span className="glass inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mute sm:self-auto">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-win" : "bg-mute"}`} />
          {connected ? "Prices update live" : "Connecting…"}
        </span>
      </div>

      <div className="glass-strong sticky top-[76px] z-20 mt-8 rounded-xl p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Icon.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            <input
              type="text"
              placeholder="Search watches, GPUs, collectibles…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-10"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ivory" aria-label="Clear search">
                <Icon.X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto rounded border border-line bg-night-800/40 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setParam("status", f.value)}
                className={`whitespace-nowrap rounded-[8px] px-3.5 py-1.5 text-sm transition ${
                  status === f.value ? "btn-gold px-3.5 py-1.5" : "text-mute hover:text-ivory"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setParam("sort", e.target.value === "ending" ? "" : e.target.value)} className="input md:w-44">
            <option value="ending">Ending soonest</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : auctions.length === 0 ? (
          <EmptyState title="No lots match" text="Try a different search term or filter." action="List an item" to="/create" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a, i) => (
              <AuctionCard key={a.id} auction={a} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
