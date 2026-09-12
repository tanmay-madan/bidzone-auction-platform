import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatINR, formatTimeRemaining } from "../utils/format";

export default function MyBids() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/my-bids")
      .then((res) => setBids(res.data.bids))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl text-ink mb-6">My Bids</h1>

      {loading ? (
        <p className="text-slate">Loading...</p>
      ) : bids.length === 0 ? (
        <p className="text-slate">You haven't placed any bids yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-white divide-y divide-border">
          {bids.map((b) => (
            <Link
              key={b.auction_id}
              to={`/auctions/${b.auction_id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAF9] transition-colors"
            >
              <div>
                <p className="font-medium text-ink">{b.title}</p>
                <p className="text-xs text-slate mt-0.5">
                  Your bid: {formatINR(b.my_latest_bid)} ·{" "}
                  {b.status === "CLOSED" ? "Ended" : `Ends in ${formatTimeRemaining(b.ends_at)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-navy">{formatINR(b.current_highest_bid)}</p>
                <span
                  className={`text-xs font-medium ${
                    b.is_winning ? "text-success" : "text-slate"
                  }`}
                >
                  {b.is_winning
                    ? b.status === "CLOSED"
                      ? "You won"
                      : "You're winning"
                    : b.status === "CLOSED"
                    ? "You lost"
                    : "Outbid"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
