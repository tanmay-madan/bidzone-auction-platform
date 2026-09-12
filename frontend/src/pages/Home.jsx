import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import AuctionCard from "../components/AuctionCard";
import BackendStatus from "../components/BackendStatus";
import { formatINR, formatTimeRemaining } from "../utils/format";

export default function Home() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auctions", { params: { status: "ACTIVE", sort: "ending" } })
      .then((res) => setAuctions(res.data.auctions.slice(0, 6)))
      .finally(() => setLoading(false));
  }, []);

  const featured = auctions[0];

  return (
    <div>
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="font-display text-5xl leading-[1.1] text-ink">
            Bid. Compete. Win.
          </h1>
          <p className="mt-5 text-slate text-lg max-w-md">
            A live auction marketplace where every bid is validated the
            instant it lands, so the price on screen is always the price
            that counts.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <Link
              to="/browse"
              className="bg-navy text-paper px-6 py-3 rounded font-medium hover:bg-navy-light transition-colors"
            >
              Browse Auctions
            </Link>
            <BackendStatus />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-6 shadow-[0_4px_24px_rgba(27,42,74,0.06)] min-h-[220px]">
          {featured ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate">Featured lot</p>
                <span className="text-xs text-brass-dark font-medium">
                  Ends in {formatTimeRemaining(featured.ends_at)}
                </span>
              </div>
              <h2 className="font-display text-2xl mt-2 text-ink">{featured.title}</h2>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate">Current bid</p>
                  <p className="font-display text-4xl text-navy tabular-nums">
                    {formatINR(featured.current_highest_bid)}
                  </p>
                </div>
                <Link
                  to={`/auctions/${featured.id}`}
                  className="rounded border border-navy text-navy px-4 py-2 text-sm font-medium hover:bg-navy hover:text-paper transition-colors"
                >
                  Bid Now
                </Link>
              </div>
            </>
          ) : (
            <p className="text-slate">
              {loading ? "Loading auctions..." : "No live auctions yet — create the first one."}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-2xl text-ink">Live Auctions</h2>
          <Link to="/browse" className="text-sm text-navy hover:text-navy-light">
            View all
          </Link>
        </div>
        {loading ? (
          <p className="text-slate">Loading...</p>
        ) : auctions.length === 0 ? (
          <p className="text-slate">
            No live auctions right now.{" "}
            <Link to="/create" className="text-navy hover:text-navy-light">
              Create one
            </Link>
            .
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
