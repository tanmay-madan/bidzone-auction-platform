import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatINR, formatTimeRemaining } from "../utils/format";

export default function MyAuctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/my-auctions")
      .then((res) => setAuctions(res.data.auctions))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-ink">My Auctions</h1>
        <Link
          to="/create"
          className="rounded bg-navy text-paper px-4 py-2 text-sm font-medium hover:bg-navy-light transition-colors"
        >
          Create Auction
        </Link>
      </div>

      {loading ? (
        <p className="text-slate">Loading...</p>
      ) : auctions.length === 0 ? (
        <p className="text-slate">You haven't created any auctions yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-white divide-y divide-border">
          {auctions.map((a) => (
            <Link
              key={a.id}
              to={`/auctions/${a.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAF9] transition-colors"
            >
              <div>
                <p className="font-medium text-ink">{a.title}</p>
                <p className="text-xs text-slate mt-0.5">
                  {a.bid_count} bids · {a.status === "CLOSED" ? "Ended" : `Ends in ${formatTimeRemaining(a.ends_at)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-navy">{formatINR(a.current_highest_bid)}</p>
                <span className="text-xs text-slate">{a.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
