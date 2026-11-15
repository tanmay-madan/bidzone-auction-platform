import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Background from "../components/Background";
import BackendStatus from "../components/BackendStatus";
import CommandPalette from "../components/CommandPalette";
import MobileTabBar from "../components/MobileTabBar";
import Toaster from "../components/Toaster";
import { Logo } from "../components/ui";

export default function MainLayout() {
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSearchOpen(false);
  }, [pathname]);

  // Ctrl/⌘ + K opens quick search from anywhere.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Background />
      <Navbar onSearch={() => setSearchOpen(true)} />

      {/* key on pathname = soft fade between pages */}
      <main key={pathname} className="flex-1 animate-rise pb-24 md:pb-0">
        <Outlet />
      </main>

      <footer className="mt-24 hidden px-3 pb-3 sm:px-5 md:block">
        <div className="glass mx-auto max-w-7xl rounded-2xl">
          <div className="grid gap-10 px-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Logo size={24} />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-mute">
                A real-time auction marketplace built on PostgreSQL transactions and row-level locking — so simultaneous bids
                never corrupt the leaderboard.
              </p>
              <div className="mt-5">
                <BackendStatus />
              </div>
            </div>
            <div>
              <p className="eyebrow mb-4">Marketplace</p>
              <ul className="space-y-2.5 text-sm text-mute">
                <li><Link className="hover:text-ivory" to="/browse">Explore auctions</Link></li>
                <li><Link className="hover:text-ivory" to="/create">List an item</Link></li>
                <li><Link className="hover:text-ivory" to="/my-bids">My bids</Link></li>
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-4">Built with</p>
              <ul className="space-y-2.5 text-sm text-mute">
                <li>React · Vite · Tailwind</li>
                <li>Node.js · Express · SSE</li>
                <li>PostgreSQL · JWT · bcrypt</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-2 border-t border-line-soft px-8 py-5 text-xs text-mute-dark sm:flex-row">
            <span>© {new Date().getFullYear()} BidZone</span>
            <span>Full-stack software engineering project</span>
          </div>
        </div>
      </footer>

      <MobileTabBar />
      <Toaster />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
