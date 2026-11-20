import { Link } from "react-router-dom";
import useNow from "../hooks/useNow";
import { AuctionImage, CountdownText, Icon, Money, StatusBadge } from "./ui";

export default function AuctionCard({ auction, index = 0 }) {
  const { id, title, image_url, current_highest_bid, starting_price, bid_count, ends_at, starts_at, status, seller_name, _flash } =
    auction;
  const now = useNow(1000);
  const ended = status === "CLOSED" || new Date(ends_at).getTime() <= now;
  const isUpcoming = !ended && status === "UPCOMING";
  const bids = Number(bid_count) || 0;
  const msLeft = new Date(ends_at).getTime() - now;
  const endingSoon = !ended && !isUpcoming && msLeft < 60 * 60 * 1000;
  const popular = !ended && bids >= 3;

  return (
    <Link
      to={`/auctions/${id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className={`spotlight group panel relative block overflow-hidden animate-rise transition duration-300 hover:-translate-y-1.5 hover:shadow-glow ${
        _flash ? "ring-1 ring-gold/60" : ""
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl">
        <AuctionImage src={image_url} title={title} className="h-full w-full transition-transform duration-700 group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <StatusBadge overlay status={ended ? "CLOSED" : status} />
          {endingSoon && (
            <span className="chip-glass inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#FFB4A8]">
              <Icon.Clock className="h-3 w-3" /> Ending soon
            </span>
          )}
          {popular && !endingSoon && (
            <span className="chip-glass inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#F8CD78]">
              <Icon.Flame className="h-3 w-3" /> Popular
            </span>
          )}
        </div>
        <div className="chip-glass absolute right-3 top-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]">
          <Icon.Gavel className="h-3.5 w-3.5 text-gold-light" />
          <span key={bids} className="num animate-pop">{bids}</span> {bids === 1 ? "bid" : "bids"}
        </div>
        <h3 className="absolute bottom-3 left-4 right-4 font-display text-[26px] leading-[1.05] text-white line-clamp-2">{title}</h3>
      </div>

      <div className="relative z-[2] flex items-end justify-between gap-3 p-4 pt-3.5">
        <div>
          <p className="eyebrow">{ended ? "Final price" : bids ? "Current bid" : "Starting at"}</p>
          <p key={_flash || "p"} className={`num mt-1 text-xl font-semibold text-gold ${_flash ? "-mx-1 rounded px-1 animate-flash" : ""}`}>
            <Money value={bids ? current_highest_bid : starting_price ?? current_highest_bid} />
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">{ended ? "Status" : isUpcoming ? "Starts in" : "Ends in"}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-ivory">
            <Icon.Clock className="h-3.5 w-3.5 text-mute" />
            {ended ? <span className="text-mute">Closed</span> : <CountdownText endsAt={isUpcoming ? starts_at : ends_at} />}
          </p>
        </div>
      </div>
      {seller_name && (
        <div className="relative z-[2] flex items-center justify-between border-t border-line-soft px-4 py-2.5 text-xs text-mute">
          <span>by {seller_name}</span>
          <span className="inline-flex translate-x-[-4px] items-center gap-1 font-medium text-gold opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">
            {ended ? "View result" : "Place bid"} <Icon.Arrow className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
    </Link>
  );
}
