import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not register.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl text-ink">Create your account</h1>
      <p className="mt-2 text-slate">Join BidZone to bid or list your own auctions.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm text-slate mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate mb-1">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
          />
          <p className="text-xs text-slate mt-1">At least 6 characters.</p>
        </div>

        {error && <p className="text-sm text-[#B4463F]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-navy text-paper rounded py-2.5 font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate">
        Already have an account?{" "}
        <Link to="/login" className="text-navy hover:text-navy-light">
          Log in
        </Link>
      </p>
    </div>
  );
}
