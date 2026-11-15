import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon } from "./ui";

// App-style bottom navigation on phones.
export default function MobileTabBar() {
  const { isAuthed } = useAuth();
  const tabs = [
    { to: "/", label: "Home", icon: Icon.Home, end: true },
    { to: "/browse", label: "Explore", icon: Icon.Compass },
    { to: "/create", label: "Sell", icon: Icon.Plus, primary: true },
    { to: "/my-bids", label: "Bids", icon: Icon.Gavel },
    { to: isAuthed ? "/profile" : "/login", label: isAuthed ? "Profile" : "Log in", icon: Icon.User },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden" aria-label="Primary">
      <div className="glass-strong flex items-center justify-around rounded-2xl px-2 py-1.5">
        {tabs.map((t) =>
          t.primary ? (
            <NavLink key={t.to} to={t.to} className="-mt-6 flex flex-col items-center" aria-label={t.label}>
              <span className="btn-gold h-12 w-12 rounded-2xl p-0">
                <t.icon className="h-5 w-5" />
              </span>
              <span className="mt-1 text-[10px] font-medium text-mute">{t.label}</span>
            </NavLink>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${
                  isActive ? "text-gold" : "text-mute"
                }`
              }
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
