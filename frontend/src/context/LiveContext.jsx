import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";

// One Server-Sent Events connection for the whole app. Pages subscribe
// to "bid" / "closed" events; private "notification" events feed the
// bell and pop-up toasts. The backend fills this stream from PostgreSQL
// LISTEN/NOTIFY, so only committed bids are ever broadcast.
const LiveContext = createContext(null);

export function LiveProvider({ children }) {
  const { token, isAuthed } = useAuth();
  const listeners = useRef(new Set());
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.toastId !== id));
  }, []);

  const pushToast = useCallback(
    (n) => {
      const toastId = `${n.id}-${Date.now()}`;
      setToasts((t) => [...t.slice(-2), { ...n, toastId }]);
      setTimeout(() => dismissToast(toastId), 6000);
    },
    [dismissToast]
  );

  const loadNotifications = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications);
      setUnread(res.data.unread);
    } catch {
      // non-critical
    }
  }, [isAuthed]);

  // Reset / load notifications whenever the logged-in user changes.
  useEffect(() => {
    if (!isAuthed) {
      setNotifications([]);
      setUnread(0);
      return;
    }
    loadNotifications();
  }, [isAuthed, loadNotifications]);

  // (Re)open the stream when the token changes.
  useEffect(() => {
    const base = api.defaults.baseURL.replace(/\/$/, "");
    const url = token ? `${base}/stream?token=${encodeURIComponent(token)}` : `${base}/stream`;
    const es = new EventSource(url);

    const dispatch = (kind) => (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (kind === "notification") {
        const n = data.notification;
        setNotifications((list) => [n, ...list.filter((x) => x.id !== n.id)].slice(0, 30));
        setUnread((u) => u + 1);
        pushToast(n);
      }
      listeners.current.forEach((fn) => fn(kind, data));
    };

    es.addEventListener("ready", () => setConnected(true));
    es.addEventListener("bid", dispatch("bid"));
    es.addEventListener("closed", dispatch("closed"));
    es.addEventListener("notification", dispatch("notification"));
    es.onerror = () => setConnected(false); // EventSource retries on its own

    return () => {
      es.close();
      setConnected(false);
    };
  }, [token, pushToast]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  async function markAllRead() {
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    try {
      await api.post("/notifications/read-all");
    } catch {
      loadNotifications();
    }
  }

  async function markRead(id) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      loadNotifications();
    }
  }

  return (
    <LiveContext.Provider
      value={{ connected, subscribe, notifications, unread, markAllRead, markRead, toasts, dismissToast }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  return useContext(LiveContext);
}

// Calls handler(kind, data) for every live auction event. The latest
// handler is always used, so callers don't need to memoise it.
export function useLiveEvents(handler) {
  const { subscribe } = useLive();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => subscribe((kind, data) => ref.current(kind, data)), [subscribe]);
}

// Patches a list of auctions in place from live events (Browse, Home).
export function applyLiveEvent(list, kind, data) {
  return list.map((a) => {
    if (a.id !== data.auction_id) return a;
    if (kind === "bid") {
      return {
        ...a,
        current_highest_bid: data.amount,
        current_highest_bidder_id: data.bidder_id,
        bid_count: Number(a.bid_count || 0) + 1,
        ends_at: data.ends_at || a.ends_at,
        _flash: Date.now(),
      };
    }
    if (kind === "closed") return { ...a, status: "CLOSED" };
    return a;
  });
}
