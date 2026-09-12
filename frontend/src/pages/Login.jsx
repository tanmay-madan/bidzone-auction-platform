import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not log in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-2 text-slate">Log in to bid and manage your auctions.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded border border-border px-3 py-2 focus:border-navy outline-none"
          />
        </div>

        {error && <p className="text-sm text-[#B4463F]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-navy text-paper rounded py-2.5 font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate">
        No account?{" "}
        <Link to="/register" className="text-navy hover:text-navy-light">
          Register
        </Link>
      </p>
    </div>
  );
}
