import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { to: "/browse", label: "Browse Auctions" },
  { to: "/my-auctions", label: "My Auctions" },
  { to: "/my-bids", label: "My Bids" },
  { to: "/create", label: "Create Auction" },
];

export default function Navbar() {
  const { user, isAuthed, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="border-b border-border bg-paper/90 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <HammerMark />
          <span className="font-display text-xl tracking-tight text-navy">
            BidZone
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-[15px] transition-colors ${
                  isActive ? "text-navy font-medium" : "text-slate hover:text-ink"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthed ? (
            <>
              <span className="text-sm text-slate hidden sm:inline">
                {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-[15px] text-slate hover:text-ink transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-[15px] text-slate hover:text-ink transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="text-[15px] bg-navy text-paper px-4 py-2 rounded hover:bg-navy-light transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function HammerMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="17" width="9" height="3" rx="1" fill="#B08D57" />
      <rect x="10.5" y="3.5" width="5" height="10" rx="1" transform="rotate(45 10.5 3.5)" fill="#1B2A4A" />
      <rect x="6.8" y="9.4" width="9" height="3.4" rx="1" transform="rotate(45 6.8 9.4)" fill="#28406E" />
    </svg>
  );
}
