import { Link } from "react-router-dom";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useNow from "../hooks/useNow";
import { formatINR, formatINRCompact, formatTimeRemaining, hueFor, initials, timeParts } from "../utils/format";

/* ---------------------------------- Logo ---------------------------------- */
// BidZone mark: an auction bidding paddle with a rising arrow, the
// moment a bidder raises their paddle to go higher.
export function LogoMark({ size = 28, className = "" }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={`logo-mark ${className}`}>
      <defs>
        <linearGradient id={`bz-t-${uid}`} x1="8" y1="4" x2="56" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FBD88C" />
          <stop offset="0.55" stopColor="#F2B544" />
          <stop offset="1" stopColor="#D98A1E" />
        </linearGradient>
        <linearGradient id={`bz-g-${uid}`} x1="32" y1="0" x2="32" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#bz-t-${uid})`} />
      <rect x="1" y="1" width="62" height="31" rx="15" fill={`url(#bz-g-${uid})`} opacity=".5" />
      <g className="logo-paddle">
        <g transform="rotate(-12 32 34)">
          <rect x="28" y="33" width="8" height="23" rx="4" fill="#12141B" />
          <rect x="15" y="9" width="34" height="30" rx="15" fill="#12141B" />
          <rect x="18.5" y="12.5" width="27" height="23" rx="11.5" stroke="#F2B544" strokeOpacity=".28" strokeWidth="1.2" />
          <path d="M32 31V17M25.5 23.5L32 17L38.5 23.5" stroke="#F2B544" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      <path className="logo-spark" d="M53 9.5l-2.6 2.6M56 16h-3.6M47 5.5v3.6" stroke="#12141B" strokeWidth="2.4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function Logo({ size = 30 }) {
  return (
    <span className="logo inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display text-[26px] leading-none tracking-tight text-ivory">
        Bid<span className="italic text-gold">Zone</span>
      </span>
    </span>
  );
}

/* ------------------------------ Status badge ------------------------------ */
export function StatusBadge({ status, overlay = false, className = "" }) {
  // `overlay` = sitting on a photo: dark frosted chip with white text, so it
  // stays readable on any image in both light and dark themes.
  const map = overlay
    ? {
        ACTIVE: { text: "Live", cls: "border-white/15 bg-black/45 text-white", dot: "bg-[#FF5C50]", pulse: true },
        UPCOMING: { text: "Upcoming", cls: "border-white/15 bg-black/45 text-white", dot: "bg-[#6EA8FE]" },
        CLOSED: { text: "Ended", cls: "border-white/15 bg-black/45 text-white/85", dot: "bg-white/60" },
      }
    : {
        ACTIVE: { text: "Live", cls: "bg-live/10 text-live border-live/30", dot: "bg-live", pulse: true },
        UPCOMING: { text: "Upcoming", cls: "bg-info/10 text-info border-info/30", dot: "bg-info" },
        CLOSED: { text: "Ended", cls: "bg-mute/10 text-mute border-line-strong", dot: "bg-mute" },
      };
  const s = map[status] || map.ACTIVE;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md ${s.cls} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {s.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${s.dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
      </span>
      {s.text}
    </span>
  );
}

/* ------------------------------ Countdown text ---------------------------- */
export function CountdownText({ endsAt, className = "" }) {
  const now = useNow(1000);
  const { ms, done } = timeParts(endsAt, now);
  const urgent = !done && ms < 2 * 60 * 1000;
  return <span className={`num ${urgent ? "text-live" : ""} ${className}`}>{formatTimeRemaining(endsAt, now)}</span>;
}

/* ------------------------------ Countdown blocks -------------------------- */
export function CountdownBlocks({ endsAt }) {
  const now = useNow(1000);
  const t = timeParts(endsAt, now);
  const urgent = !t.done && t.ms < 2 * 60 * 1000;
  const cells = [
    ["Days", t.days],
    ["Hrs", t.hours],
    ["Min", t.minutes],
    ["Sec", t.seconds],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map(([label, v]) => (
        <div
          key={label}
          className={`rounded border px-2 py-2.5 text-center backdrop-blur transition-colors ${
            urgent ? "border-live/40 bg-live/10" : "border-line bg-night-800/50"
          }`}
        >
          <div key={v} className={`num text-2xl font-semibold ${label === "Sec" ? "animate-tick" : ""} ${urgent ? "text-live" : "text-ivory"}`}>
            {String(v).padStart(2, "0")}
          </div>
          <div className="eyebrow mt-0.5 text-[9.5px]">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------- Animated money / numbers ----------------------- */
// Tweens from the previous value to the new one (e.g. when a live bid lands).
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 700, className = "" }) {
  const [display, setDisplay] = useState(Number(value) || 0);
  const from = useRef(Number(value) || 0);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = from.current;
    if (start === target) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      from.current = target;
      setDisplay(target);
      return;
    }
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

export function Money({ value, compact = false, className = "" }) {
  return <AnimatedNumber value={value} format={compact ? formatINRCompact : formatINR} className={className} />;
}

/* --------------------------------- Reveal --------------------------------- */
// Fades content in as it scrolls into view.
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${shown ? "in" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

/* -------------------------------- Confetti -------------------------------- */
export function Confetti({ count = 90 }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 2.4 + Math.random() * 1.8,
      dx: `${(Math.random() - 0.5) * 240}px`,
      rot: `${(Math.random() - 0.5) * 1080}deg`,
      color: ["#F2B544", "#F8CD78", "#3DDC97", "#6EA8FE", "#EC4899", "#FFFFFF"][i % 6],
    }))
  );
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 4800);
    return () => clearTimeout(t);
  }, []);
  if (done) return null;
  // Portal to <body> so it always covers the viewport, whatever its parent.
  return createPortal(
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            "--dx": p.dx,
            "--rot": p.rot,
          }}
        />
      ))}
    </div>,
    document.body
  );
}

/* -------------------------- Image with fallback art ----------------------- */
// Curated, low-saturation cover palettes for items without a photo.
const COVERS = [
  ["#4A3517", "#140F08", "#F2B544"],
  ["#232A4D", "#0B0D18", "#8FA8FF"],
  ["#43202F", "#120A0E", "#F28AA8"],
  ["#173B37", "#081211", "#6FD6C3"],
  ["#2E3240", "#0C0D12", "#C9CEDC"],
  ["#3D2A1E", "#100B08", "#E8A776"],
];

export function AuctionImage({ src, title = "", className = "" }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  if (failed) {
    const [from, to, accent] = COVERS[hueFor(title) % COVERS.length];
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${className}`}
        style={{ background: `radial-gradient(130% 100% at 15% 0%, ${from} 0%, ${to} 70%)` }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          }}
        />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl" style={{ background: accent, opacity: 0.12 }} />
        <div className="relative flex flex-col items-center gap-2">
          <span className="font-display text-5xl italic" style={{ color: accent, opacity: 0.9 }}>
            {initials(title)}
          </span>
          <span className="h-px w-10" style={{ background: accent, opacity: 0.4 }} />
        </div>
      </div>
    );
  }
  return <img src={src} alt={title} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

/* --------------------------------- Avatar -------------------------------- */
export function Avatar({ name, src, size = 32, ring = false }) {
  const hue = hueFor(name);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ${ring ? "ring-2 ring-gold ring-offset-2 ring-offset-transparent" : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? "ring-2 ring-gold ring-offset-2 ring-offset-transparent" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 60% 50%), hsl(${(hue + 50) % 360} 60% 32%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------- Empty state ------------------------------ */
export function EmptyState({ title, text, action, to }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
        <Icon.Gavel className="h-6 w-6 text-gold" />
      </div>
      <h3 className="font-display text-3xl text-ivory">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-sm text-mute">{text}</p>}
      {action && to && (
        <Link to={to} className="btn-gold mt-6">
          {action}
        </Link>
      )}
    </div>
  );
}

/* ------------------------------ Card skeleton ----------------------------- */
export function CardSkeleton() {
  return (
    <div className="panel overflow-hidden">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-10 w-full rounded" />
      </div>
    </div>
  );
}

/* --------------------------------- Alerts -------------------------------- */
export function Alert({ kind = "error", children }) {
  const cls = kind === "error" ? "border-live/30 bg-live/10 text-live" : "border-win/30 bg-win/10 text-win";
  return (
    <div className={`flex items-start gap-2 rounded border px-3.5 py-2.5 text-sm backdrop-blur animate-rise ${cls}`}>
      {kind === "error" ? <Icon.Alert className="mt-0.5 h-4 w-4 shrink-0" /> : <Icon.Check className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

/* ---------------------------------- Icons --------------------------------- */
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
export const Icon = {
  Gavel: (p) => (<svg {...base} {...p}><path d="M14 13l-7.5 7.5a2.1 2.1 0 01-3-3L11 10" /><path d="M16 16l6-6" /><path d="M8 8l6-6" /><path d="M9 7l8 8" /><path d="M21 11l-8-8" /></svg>),
  Search: (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>),
  Clock: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  Lock: (p) => (<svg {...base} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>),
  Shield: (p) => (<svg {...base} {...p}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>),
  Bolt: (p) => (<svg {...base} {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>),
  Key: (p) => (<svg {...base} {...p}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3M17 6l3 3M15 8l2 2" /></svg>),
  Db: (p) => (<svg {...base} {...p}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>),
  Arrow: (p) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>),
  Plus: (p) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>),
  Check: (p) => (<svg {...base} {...p}><path d="M5 12l5 5L20 7" /></svg>),
  Alert: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>),
  Trophy: (p) => (<svg {...base} {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" /><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /></svg>),
  Users: (p) => (<svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.5a3.5 3.5 0 010 7M21.5 20a6.5 6.5 0 00-4-6" /></svg>),
  Menu: (p) => (<svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>),
  X: (p) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>),
  Chart: (p) => (<svg {...base} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>),
  Logout: (p) => (<svg {...base} {...p}><path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l-5-5 5-5M5 12h11" /></svg>),
  Bell: (p) => (<svg {...base} {...p}><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 003.4 0" /></svg>),
  Sun: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>),
  Moon: (p) => (<svg {...base} {...p}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>),
  Home: (p) => (<svg {...base} {...p}><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" /></svg>),
  Compass: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" /></svg>),
  Tag: (p) => (<svg {...base} {...p}><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>),
  User: (p) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>),
  Settings: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>),
  Mail: (p) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>),
  Phone: (p) => (<svg {...base} {...p}><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" /></svg>),
  Pin: (p) => (<svg {...base} {...p}><path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>),
  Eye: (p) => (<svg {...base} {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>),
  EyeOff: (p) => (<svg {...base} {...p}><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17.5 17.5 0 01-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a10 10 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2" /></svg>),
  Calendar: (p) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>),
  Flame: (p) => (<svg {...base} {...p}><path d="M12 22c4 0 7-2.8 7-6.8 0-3.4-2.2-5.6-3.6-7.2-.4 1.8-1.4 3-2.6 3.6.2-3.2-1.2-6.4-4.3-8.6.3 3.5-1.7 5.6-3 7.3C4.3 12 4 13.4 4 15.2 4 19.2 7.6 22 12 22z" /></svg>),
  Upload: (p) => (<svg {...base} {...p}><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /></svg>),
  Activity: (p) => (<svg {...base} {...p}><path d="M22 12h-4l-3 8L9 4l-3 8H2" /></svg>),
};
