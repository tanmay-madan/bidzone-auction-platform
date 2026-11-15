import { Icon } from "./ui";

// Split-screen wrapper shared by Login and Register.
export default function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="container-x grid min-h-[calc(100vh-4rem)] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="relative hidden h-full max-h-[640px] overflow-hidden rounded-2xl border border-line lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/25 via-night-800 to-night" />
        <div className="grid-bg absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <p className="eyebrow text-gold">BidZone · Live auction house</p>
          <div>
            <p className="font-display text-6xl leading-[0.95] text-ivory">
              The price on screen is <span className="italic text-gold">the price that counts.</span>
            </p>
            <ul className="mt-10 space-y-4 text-sm text-mute">
              {[
                [Icon.Lock, "Row-level locking on every bid"],
                [Icon.Shield, "bcrypt-hashed passwords · JWT sessions"],
                [Icon.Key, "Duplicate-safe submissions with idempotency keys"],
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
