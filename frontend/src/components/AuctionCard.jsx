import { Link } from "react-router-dom";
import { formatINR, formatTimeRemaining } from "../utils/format";
import useNow from "../hooks/useNow";

export default function AuctionCard({ auction }) {
  const {
    id,
    title,
    image_url,
    current_highest_bid,
    bid_count,
    ends_at,
    status,
    _flash,
  } = auction;
  const now = useNow(1000); // live countdown
  const ended = status === "CLOSED" || new Date(ends_at).getTime() <= now;

  return (
    <article className="group rounded-lg border border-border bg-white overflow-hidden hover:shadow-[0_4px_20px_rgba(27,42,74,0.08)] transition-shadow">
      <div className="aspect-[4/3] overflow-hidden bg-[#F1EFEA]">
        <img
          src={image_url || "https://picsum.photos/seed/bidzone-fallback/600/450"}
          alt={title}
          className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg text-ink leading-snug">{title}</h3>
          {ended && (
            <span className="text-xs text-slate border border-border rounded px-2 py-0.5 shrink-0">
              Closed
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-xs text-slate">Current bid</p>
            <p key={_flash || "static"} className={`text-lg font-semibold text-navy tabular-nums ${_flash ? "price-flash -mx-1 px-1" : ""}`}>
              {formatINR(current_highest_bid)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate">{bid_count} bids</p>
            <p className="text-sm text-brass-dark font-medium tabular-nums">
              {ended ? "Ended" : `Ends in ${formatTimeRemaining(ends_at, now)}`}
            </p>
          </div>
        </div>

        <Link
          to={`/auctions/${id}`}
          className="mt-4 block text-center w-full rounded border border-navy text-navy text-sm font-medium py-2 hover:bg-navy hover:text-paper transition-colors"
        >
          {ended ? "View Result" : "Bid Now"}
        </Link>
      </div>
    </article>
  );
}
