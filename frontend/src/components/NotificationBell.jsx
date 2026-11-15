import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLive } from "../context/LiveContext";
import { timeAgo } from "../utils/format";
import { Icon } from "./ui";

export const TYPE_STYLE = {
  OUTBID: { dot: "bg-live", label: "Outbid", icon: Icon.Alert, tone: "text-live bg-live/15" },
  NEW_BID: { dot: "bg-info", label: "New bid", icon: Icon.Gavel, tone: "text-info bg-info/15" },
  AUCTION_WON: { dot: "bg-win", label: "Won", icon: Icon.Trophy, tone: "text-win bg-win/15" },
  AUCTION_SOLD: { dot: "bg-gold", label: "Sold", icon: Icon.Tag, tone: "text-gold bg-gold/15" },
  AUCTION_UNSOLD: { dot: "bg-mute", label: "Ended", icon: Icon.Clock, tone: "text-mute bg-mute/15" },
  AUCTION_LOST: { dot: "bg-mute", label: "Ended", icon: Icon.Clock, tone: "text-mute bg-mute/15" },
};

export default function NotificationBell() {
  const { notifications, unread, markAllRead, markRead, connected } = useLive();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function openNotification(n) {
    markRead(n.id);
    setOpen(false);
    if (n.auction_id) navigate(`/auctions/${n.auction_id}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-mute transition hover:bg-ivory/5 hover:text-ivory"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
      >
        <Icon.Bell className={`h-[19px] w-[19px] ${unread ? "text-ivory" : ""}`} />
        {unread > 0 && (
          <span key={unread} className="absolute right-1 top-1 flex h-[17px] min-w-[17px] animate-pop items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-white ring-2 ring-night">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-strong absolute right-0 z-50 mt-3 w-[360px] max-w-[calc(100vw-1.5rem)] origin-top-right animate-rise overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-display text-xl text-ivory">Notifications</p>
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-win" : "bg-mute"}`} title={connected ? "Live" : "Reconnecting…"} />
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-gold hover:text-gold-light">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Icon.Bell className="mx-auto h-8 w-8 text-mute-dark" />
              <p className="mt-3 text-sm text-mute">You're all caught up. We'll tell you here when you're outbid or win.</p>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">
              {notifications.map((n) => {
                const s = TYPE_STYLE[n.type] || TYPE_STYLE.NEW_BID;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotification(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-ivory/5 ${n.is_read ? "" : "bg-gold/[0.06]"}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.tone}`}>
                        <s.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm leading-snug ${n.is_read ? "text-mute" : "font-medium text-ivory"}`}>{n.title}</span>
                        {n.body && <span className="mt-0.5 block text-xs text-mute">{n.body}</span>}
                        <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-mute-dark">
                          {s.label} · {timeAgo(n.created_at)}
                        </span>
                      </span>
                      {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
