import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { formatINR } from "../utils/format";
import { AuctionImage, Icon, StatusBadge } from "./ui";

const QUICK = [
  { label: "Explore live auctions", to: "/browse", icon: Icon.Compass },
  { label: "List an item", to: "/create", icon: Icon.Plus },
  { label: "My bids", to: "/my-bids", icon: Icon.Gavel },
  { label: "My auctions", to: "/my-auctions", icon: Icon.Tag },
];

// Ctrl/⌘ + K quick search: jump to any auction or page from anywhere.
export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api
        .get("/auctions", { params: q.trim() ? { search: q.trim() } : { status: "ACTIVE", sort: "ending" } })
        .then((res) => setResults(res.data.auctions.slice(0, 6)))
        .catch(() => setResults([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const items = [
    ...results.map((a) => ({ kind: "auction", a, to: `/auctions/${a.id}` })),
    ...(q.trim() ? [] : QUICK.map((x) => ({ kind: "page", ...x }))),
  ];

  function go(item) {
    onClose();
    navigate(item.to);
  }

  function onKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && items[active]) {
      go(items[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm animate-rise" onMouseDown={onClose}>
      <div className="glass-strong w-full max-w-xl overflow-hidden rounded-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon.Search className="h-5 w-5 text-mute" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Search auctions or jump to a page…"
            className="h-14 flex-1 bg-transparent text-[15px] text-ivory outline-none placeholder:text-mute-dark"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-mute">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length > 0 && <p className="eyebrow px-3 pb-1 pt-2 text-[10px]">{q.trim() ? "Auctions" : "Closing soon"}</p>}
          {items.length === 0 && <p className="px-3 py-10 text-center text-sm text-mute">No auctions match “{q}”.</p>}
          {items.map((item, i) =>
            item.kind === "auction" ? (
              <button
                key={item.to}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${active === i ? "bg-gold/10" : ""}`}
              >
                <AuctionImage src={item.a.image_url} title={item.a.title} className="h-10 w-12 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ivory">{item.a.title}</span>
                  <span className="num text-xs text-gold">{formatINR(item.a.current_highest_bid)}</span>
                </span>
                <StatusBadge status={item.a.status} />
              </button>
            ) : (
              <button
                key={item.to}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active === i ? "bg-gold/10 text-ivory" : "text-mute"}`}
              >
                {i === results.length && <span className="sr-only">Pages</span>}
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line">
                  <item.icon className="h-4 w-4" />
                </span>
                {item.label}
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 font-mono text-[10.5px] text-mute-dark">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">BidZone search</span>
        </div>
      </div>
    </div>
  );
}
