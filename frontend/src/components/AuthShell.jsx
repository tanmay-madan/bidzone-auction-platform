import { useEffect, useState } from "react";
import { Icon, LogoMark } from "./ui";
import { formatINR } from "../utils/format";

const NAMES = ["Rahul", "Aman", "Priya", "Karan", "Neha", "Arjun"];

// Decorative, clearly labelled example of a bidding war: a new, higher
// bid slides in every couple of seconds. It does not use real data.
function BidLadderDemo() {
  const [bids, setBids] = useState(() => [
    { id: 3, name: "Priya", amount: 13000 },
    { id: 2, name: "Aman", amount: 12000 },
    { id: 1, name: "Rahul", amount: 11000 },
  ]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setBids((list) => {
        const top = list[0];
        const next = {
          id: top.id + 1,
          name: NAMES[(top.id + 1) % NAMES.length],
          amount: top.amount >= 24000 ? 11000 : top.amount + 1000,
        };
        return [next, ...list].slice(0, 3);
      });
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs text-mute">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" /> Example bidding war
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mute-dark">Min +₹1,000</span>
      </div>
      <ul className="space-y-2">
        {bids.map((b, i) => (
          <li
            key={b.id}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors duration-500 ${
              i === 0 ? "animate-slide-in bg-gold/10 ring-1 ring-gold/30" : "bg-night-800/40"
            }`}
          >
            <span className="flex items-center gap-2.5 text-sm">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${i === 0 ? "bg-gold text-ongold" : "bg-ivory/10 text-mute"}`}>
                {b.name[0]}
              </span>
              <span className={i === 0 ? "font-medium text-ivory" : "text-mute"}>{b.name}</span>
              {i === 0 && <span className="rounded-full bg-win/15 px-2 py-0.5 text-[10px] font-semibold text-win">Leading</span>}
            </span>
            <span className={`num text-sm font-semibold ${i === 0 ? "text-gold" : "text-mute"}`}>{formatINR(b.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Split-screen wrapper shared by Login and Register.
export default function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="container-x grid min-h-[calc(100vh-4rem)] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-2xl border border-line lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/25 via-night-800 to-night" />
        <div className="grid-bg absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between gap-8 p-10">
          <div className="flex items-center gap-3">
            <LogoMark size={34} />
            <p className="eyebrow text-gold">Live auction house</p>
          </div>

          <BidLadderDemo />

          <div>
            <p className="font-display text-5xl leading-[0.98] text-ivory">
              The price on screen is <span className="italic text-gold">the price that counts.</span>
            </p>
            <ul className="mt-8 space-y-3.5 text-sm text-mute">
              {[
                [Icon.Lock, "Every bid is locked and checked in the database"],
                [Icon.Bolt, "Outbid alerts and prices update instantly"],
                [Icon.Shield, "Secure accounts with hashed passwords"],
              ].map(([I, t]) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
                    <I className="h-4 w-4" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md animate-rise">
        <p className="eyebrow text-gold">{eyebrow}</p>
        <h1 className="mt-2 font-display text-5xl leading-none text-ivory">{title}</h1>
        <p className="mt-3 text-mute">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 text-sm text-mute">{footer}</div>
      </div>
    </div>
  );
}
