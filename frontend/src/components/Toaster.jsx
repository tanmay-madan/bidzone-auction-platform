import { Link } from "react-router-dom";
import { useLive } from "../context/LiveContext";
import { TYPE_STYLE } from "./NotificationBell";
import { Icon } from "./ui";

// Frosted pop-up alerts for notifications that arrive live.
export default function Toaster() {
  const { toasts, dismissToast } = useLive();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3 md:bottom-6 md:right-6">
      {toasts.map((t) => {
        const s = TYPE_STYLE[t.type] || TYPE_STYLE.NEW_BID;
        return (
          <div key={t.toastId} role="status" className="glass-strong relative animate-slide-in overflow-hidden rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.tone}`}>
                <s.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ivory">{t.title}</p>
                {t.body && <p className="mt-1 text-xs text-mute">{t.body}</p>}
                {t.auction_id && (
                  <Link
                    to={`/auctions/${t.auction_id}`}
                    onClick={() => dismissToast(t.toastId)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light"
                  >
                    {t.type === "OUTBID" ? "Bid again" : "View auction"} <Icon.Arrow className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              <button onClick={() => dismissToast(t.toastId)} className="text-mute hover:text-ivory" aria-label="Dismiss">
                <Icon.X className="h-4 w-4" />
              </button>
            </div>
            {/* time-left bar */}
            <span className={`absolute bottom-0 left-0 h-[2px] w-full origin-left ${s.dot}`} style={{ animation: "toast-timer 6s linear forwards" }} />
          </div>
        );
      })}
      <style>{`@keyframes toast-timer { from { transform: scaleX(1) } to { transform: scaleX(0) } }`}</style>
    </div>
  );
}
