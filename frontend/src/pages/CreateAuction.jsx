import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Alert, AuctionImage, Icon, StatusBadge } from "../components/ui";
import { formatINR, formatTimeRemaining } from "../utils/format";

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const DURATIONS = [
  ["1 hour", 1],
  ["1 day", 24],
  ["3 days", 72],
  ["7 days", 168],
];

export default function CreateAuction() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    title: "",
    description: "",
    image_url: "",
    starting_price: "",
    min_increment: "",
    starts_at: toDatetimeLocal(new Date(Date.now() + 5 * 60 * 1000)),
    ends_at: toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  }));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setDuration(hours) {
    const start = new Date(form.starts_at);
    const base = Number.isNaN(start.getTime()) ? new Date() : start;
    update("ends_at", toDatetimeLocal(new Date(base.getTime() + hours * 3600 * 1000)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      setError("End time must be after the start time.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/auctions", {
        ...form,
        starting_price: Number(form.starting_price),
        min_increment: Number(form.min_increment),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
      });
      navigate(`/auctions/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create auction.");
    } finally {
      setSubmitting(false);
    }
  }

  const durationMs = new Date(form.ends_at) - new Date(form.starts_at);

  return (
    <div className="container-x py-12">
      <p className="eyebrow text-gold">New listing</p>
      <h1 className="mt-2 font-display text-6xl leading-none text-ivory">List an item</h1>
      <p className="mt-3 max-w-lg text-mute">Set the rules once. BidZone enforces them on every single bid.</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Section n="01" title="The item">
            <Field label="Title">
              <input required maxLength={200} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Vintage Leica M6, black chrome" className="input" />
            </Field>
            <Field label="Description">
              <textarea rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Condition, provenance, what's in the box…" className="input resize-none" />
            </Field>
            <Field label="Image URL" hint="Optional. A cover is generated if you leave this blank.">
              <input value={form.image_url} onChange={(e) => update("image_url", e.target.value)} placeholder="https://…" className="input" />
            </Field>
          </Section>

          <Section n="02" title="Pricing">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starting price">
                <Money value={form.starting_price} onChange={(v) => update("starting_price", v)} min="0" />
              </Field>
              <Field label="Minimum increment">
                <Money value={form.min_increment} onChange={(v) => update("min_increment", v)} min="1" />
              </Field>
            </div>
          </Section>

          <Section n="03" title="Schedule">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts">
                <input type="datetime-local" required value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} className="input" />
              </Field>
              <Field label="Ends">
                <input type="datetime-local" required value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} className="input" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-mute">Quick duration:</span>
              {DURATIONS.map(([label, h]) => (
                <button key={label} type="button" onClick={() => setDuration(h)} className="rounded-full border border-line px-3 py-1 text-xs text-mute transition hover:border-gold/50 hover:text-gold">
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {error && <Alert>{error}</Alert>}

          <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 text-[15px]">
            {submitting ? "Publishing…" : (<><Icon.Gavel className="h-4 w-4" /> Publish auction</>)}
          </button>
        </form>

        {/* Live preview */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow mb-3">Live preview</p>
          <div className="panel overflow-hidden">
            <div className="relative aspect-[4/3]">
              <AuctionImage key={form.image_url} src={form.image_url || null} title={form.title || "New Lot"} className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute left-3 top-3">
                <StatusBadge overlay status="UPCOMING" />
              </div>
              <h3 className="absolute bottom-3 left-4 right-4 font-display text-3xl leading-none text-white">
                {form.title || "Your item title"}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 p-5">
              <div>
                <p className="eyebrow">Opening bid</p>
                <p className="num mt-1 text-xl font-semibold text-gold">{formatINR(form.starting_price || 0)}</p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Increment</p>
                <p className="num mt-1 text-xl font-semibold text-ivory">{formatINR(form.min_increment || 0)}</p>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-line-soft pt-3 text-sm">
                <span className="text-mute">Duration</span>
                <span className="num text-ivory">
                  {durationMs > 0 ? formatTimeRemaining(durationMs, 0) : "Not set"}
                </span>
              </div>
              <div className="col-span-2 flex items-center justify-between text-sm">
                <span className="text-mute">Seller</span>
                <span className="text-ivory">{user?.name}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ n, title, children }) {
  return (
    <fieldset className="panel space-y-4 p-6">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-3">
        <span className="num text-xs text-gold">{n}</span>
        <h2 className="font-semibold text-ivory">{title}</h2>
      </div>
      {children}
    </fieldset>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-mute-dark">{hint}</p>}
    </div>
  );
}

function Money({ value, onChange, min }) {
  return (
    <div className="relative">
      <span className="num pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute">₹</span>
      <input type="number" required min={min} value={value} onChange={(e) => onChange(e.target.value)} className="input num pl-8" />
    </div>
  );
}
