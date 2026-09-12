import { useEffect, useState } from "react";
import api from "../services/api";
import AuctionCard from "../components/AuctionCard";

export default function Browse() {
  const [auctions, setAuctions] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("ending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (sort) params.sort = sort;

    api
      .get("/auctions", { params })
      .then((res) => setAuctions(res.data.auctions))
      .finally(() => setLoading(false));
  }, [search, sort]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl text-ink mb-6">Browse Auctions</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded border border-border px-3 py-2 focus:border-navy outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded border border-border px-3 py-2 focus:border-navy outline-none"
        >
          <option value="ending">Ending soon</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {loading ? (
        <p className="text-slate">Loading auctions...</p>
      ) : auctions.length === 0 ? (
        <p className="text-slate">No auctions match your search yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}
