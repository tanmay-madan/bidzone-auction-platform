import { Link } from "react-router-dom";
import { useLive } from "../context/LiveContext";
import { TYPE_STYLE } from "./NotificationBell";

// Pop-up alerts for notifications that arrive live (outbid, won, sold…).
export default function Toaster() {
  const { toasts, dismissToast } = useLive();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-[340px] max-w-[calc(100vw-2.5rem)]">
      {toasts.map((t) => {
        const style = TYPE_STYLE[t.type] || TYPE_STYLE.NEW_BID;
        const accent =
          t.type === "OUTBID" ? "border-l-[#B4463F]" : t.type === "AUCTION_WON" ? "border-l-success" : "border-l-brass";
        return (
          <div
            key={t.toastId}
            role="status"
            className={`toast-in rounded-lg border border-border border-l-4 ${accent} bg-white shadow-[0_12px_40px_rgba(27,42,74,0.16)] p-4`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink leading-snug">{t.title}</p>
                {t.body && <p className="text-xs text-slate mt-1">{t.body}</p>}
                {t.auction_id && (
                  <Link
                    to={`/auctions/${t.auction_id}`}
                    onClick={() => dismissToast(t.toastId)}
                    className="inline-block mt-2 text-xs font-medium text-navy hover:text-navy-light"
                  >
                    {t.type === "OUTBID" ? "Bid again →" : "View auction →"}
                  </Link>
                )}
              </div>
              <button
                onClick={() => dismissToast(t.toastId)}
                className="text-slate-light hover:text-ink text-lg leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
