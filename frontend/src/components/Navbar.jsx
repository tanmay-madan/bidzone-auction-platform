import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";
import { Avatar, Icon, Logo } from "./ui";

const navLinks = [
  { to: "/browse", label: "Explore" },
  { to: "/my-bids", label: "My Bids" },
  { to: "/my-auctions", label: "My Auctions" },
];

export function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-mute transition hover:bg-ivory/5 hover:text-ivory ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <Icon.Sun className={`absolute h-[19px] w-[19px] transition duration-500 ${theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Icon.Moon className={`absolute h-[18px] w-[18px] transition duration-500 ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}

export default function Navbar({ onSearch }) {
  const { user, isAuthed, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => setMenu(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <div
        className={`mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 rounded-full pl-4 pr-2 transition-all duration-300 ${
          scrolled ? "glass-strong" : "border border-transparent"
        }`}
      >
        <Link to="/" aria-label="BidZone home" className="shrink-0">
          <Logo size={26} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-1.5 text-sm transition ${isActive ? "bg-ivory/[0.08] text-ivory" : "text-mute hover:text-ivory"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            onClick={onSearch}
            className="hidden items-center gap-2 rounded-full border border-line bg-night-800/40 py-1.5 pl-3 pr-1.5 text-sm text-mute transition hover:border-gold/40 hover:text-ivory md:flex"
          >
            <Icon.Search className="h-4 w-4" />
            <span className="pr-6">Search auctions</span>
            <kbd className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px]">{isMac ? "⌘" : "Ctrl"} K</kbd>
          </button>
          <button onClick={onSearch} className="flex h-10 w-10 items-center justify-center rounded-full text-mute hover:text-ivory md:hidden" aria-label="Search">
            <Icon.Search className="h-[19px] w-[19px]" />
          </button>

          <ThemeToggle />

          {isAuthed ? (
            <>
              <NotificationBell />
              <Link to="/create" className="btn-gold ml-1 hidden rounded-full py-2 sm:inline-flex">
                <Icon.Plus className="h-4 w-4" /> Sell
              </Link>
              <div className="relative ml-1" ref={menuRef}>
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex items-center gap-2 rounded-full p-1 transition hover:bg-ivory/5"
                  aria-label="Account menu"
                  aria-expanded={menu}
                >
                  <Avatar name={user?.name || "?"} src={user?.avatar_url} size={32} />
                </button>
                {menu && (
                  <div className="glass-strong absolute right-0 z-50 mt-3 w-56 animate-rise overflow-hidden rounded-xl p-1.5">
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-medium text-ivory">{user?.name}</p>
                      <p className="truncate text-xs text-mute">{user?.email}</p>
                    </div>
                    <div className="my-1 border-t border-line" />
                    {[
                      ["/profile", "Profile & settings", Icon.User],
                      ["/my-bids", "My bids", Icon.Gavel],
                      ["/my-auctions", "My auctions", Icon.Tag],
                      ["/create", "List an item", Icon.Plus],
                    ].map(([to, label, I]) => (
                      <Link key={to} to={to} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-mute transition hover:bg-ivory/5 hover:text-ivory">
                        <I className="h-4 w-4" /> {label}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-line" />
                    <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-live transition hover:bg-live/10">
                      <Icon.Logout className="h-4 w-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden px-3 text-sm text-mute transition hover:text-ivory sm:inline">
                Log in
              </Link>
              <Link to="/register" className="btn-gold ml-1 rounded-full py-2">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
