import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const defaultStart = toDatetimeLocal(new Date(Date.now() + 5 * 60 * 1000));
const defaultEnd = toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

export default function CreateAuction() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    image_url: "",
    starting_price: "",
    min_increment: "",
    starts_at: defaultStart,
    ends_at: defaultEnd,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
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

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-display text-3xl text-ink mb-6">Create Auction</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Item title">
          <input
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
          />
        </Field>

        <Field label="Image URL" hint="Optional — a placeholder is used if left blank.">
          <input
            value={form.image_url}
            onChange={(e) => update("image_url", e.target.value)}
            placeholder="https://..."
            className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Starting price (₹)">
            <input
              type="number"
              required
              min="0"
              value={form.starting_price}
              onChange={(e) => update("starting_price", e.target.value)}
              className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
            />
          </Field>
          <Field label="Minimum increment (₹)">
            <input
              type="number"
              required
              min="1"
              value={form.min_increment}
              onChange={(e) => update("min_increment", e.target.value)}
              className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time">
            <input
              type="datetime-local"
              required
              value={form.starts_at}
              onChange={(e) => update("starts_at", e.target.value)}
              className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
            />
          </Field>
          <Field label="End time">
            <input
              type="datetime-local"
              required
              value={form.ends_at}
              onChange={(e) => update("ends_at", e.target.value)}
              className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
            />
          </Field>
        </div>

        {error && <p className="text-sm text-[#B4463F]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-navy text-paper rounded py-2.5 font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create Auction"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm text-slate mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate mt-1">{hint}</p>}
    </div>
  );
}
