import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLive } from "../context/LiveContext";
import { timeAgo } from "../utils/format";

export const TYPE_STYLE = {
  OUTBID: { dot: "bg-[#B4463F]", label: "Outbid" },
  NEW_BID: { dot: "bg-navy-light", label: "New bid" },
  AUCTION_WON: { dot: "bg-success", label: "Won" },
  AUCTION_SOLD: { dot: "bg-brass", label: "Sold" },
  AUCTION_UNSOLD: { dot: "bg-slate-light", label: "Ended" },
  AUCTION_LOST: { dot: "bg-slate-light", label: "Ended" },
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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
        className="relative p-2 rounded text-slate hover:text-ink hover:bg-[#F1EFEA] transition-colors"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 003.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B4463F] text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-white shadow-[0_12px_40px_rgba(27,42,74,0.14)] overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <p className="font-display text-lg text-ink">Notifications</p>
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-slate-light"}`}
                title={connected ? "Live" : "Reconnecting…"}
              />
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-navy hover:text-navy-light font-medium">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate">
              No notifications yet. You'll hear here when you're outbid or win.
            </p>
          ) : (
            <ul className="max-h-[400px] overflow-y-auto divide-y divide-border">
              {notifications.map((n) => {
                const style = TYPE_STYLE[n.type] || TYPE_STYLE.NEW_BID;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotification(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-paper transition-colors ${
                        n.is_read ? "" : "bg-[#F6F3EC]"
                      }`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm leading-snug ${n.is_read ? "text-slate" : "text-ink font-medium"}`}>
                          {n.title}
                        </span>
                        {n.body && <span className="block text-xs text-slate mt-0.5">{n.body}</span>}
                        <span className="block text-[11px] text-slate-light mt-1">
                          {style.label} · {timeAgo(n.created_at)}
                        </span>
                      </span>
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
