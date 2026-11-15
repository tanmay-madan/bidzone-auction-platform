import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Alert, AnimatedNumber, Avatar, Icon, Money, Reveal } from "../components/ui";

const TABS = [
  { id: "details", label: "Edit profile", icon: Icon.User },
  { id: "security", label: "Security", icon: Icon.Lock },
  { id: "preferences", label: "Preferences", icon: Icon.Settings },
];

const EMPTY = { name: "", email: "", phone: "", location: "", bio: "", avatar_url: "" };

export default function Profile() {
  const { updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "details";

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api.get("/profile");
    setProfile(res.data.user);
    setStats(res.data.stats);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container-x space-y-6 py-10">
        <div className="skeleton h-56 rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (!profile) {
    return <div className="container-x py-24 text-center text-mute">Could not load your profile.</div>;
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="container-x py-8">
      {/* ------------------------------- HEADER ------------------------------- */}
      <section className="panel relative overflow-hidden">
        <div className="relative h-32 overflow-hidden sm:h-40">
          <div className="absolute inset-0 bg-gradient-to-r from-gold/40 via-info/25 to-[rgb(var(--blob-c)/0.35)]" />
          <div className="grid-bg absolute inset-0" />
        </div>
        <div className="relative px-6 pb-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
            <div className="-mt-14 w-fit self-start rounded-full bg-night p-1.5 ring-1 ring-line sm:-mt-16">
              <Avatar name={profile.name} src={profile.avatar_url} size={112} />
            </div>
            <div className="min-w-0 flex-1 sm:pb-1 sm:pt-4">
              <h1 className="font-display text-4xl leading-none text-ivory sm:text-5xl">{profile.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mute">
                <span className="inline-flex items-center gap-1.5">
                  <Icon.Mail className="h-4 w-4" /> {profile.email}
                </span>
                {profile.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon.Pin className="h-4 w-4" /> {profile.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Icon.Calendar className="h-4 w-4" /> Member since {memberSince}
                </span>
              </div>
            </div>
            <div className="flex gap-2 sm:pb-2">
              <Link to="/my-bids" className="btn-ghost py-2">
                <Icon.Gavel className="h-4 w-4" /> My bids
              </Link>
              <Link to="/my-auctions" className="btn-ghost py-2">
                <Icon.Tag className="h-4 w-4" /> My auctions
              </Link>
            </div>
          </div>
          {profile.bio ? (
            <p className="mt-5 max-w-2xl leading-relaxed text-mute">{profile.bio}</p>
          ) : (
            <button onClick={() => setParams({ tab: "details" })} className="mt-5 text-sm text-gold hover:text-gold-light">
              + Add a short bio
            </button>
          )}
        </div>
      </section>

      {/* -------------------------------- STATS ------------------------------- */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Listed", <AnimatedNumber key="1" value={stats.auctions_listed} />, Icon.Tag],
          ["Live listings", <AnimatedNumber key="2" value={stats.auctions_live} />, Icon.Bolt],
          ["Bids placed", <AnimatedNumber key="3" value={stats.bids_placed} />, Icon.Gavel],
          ["Auctions won", <AnimatedNumber key="4" value={stats.auctions_won} />, Icon.Trophy],
          ["Won value", <Money key="5" value={stats.total_won_value} />, Icon.Chart],
          ["Sold value", <Money key="6" value={stats.total_sold_value} />, Icon.Chart],
        ].map(([label, value, I], i) => (
          <Reveal key={label} delay={i * 50} className="panel spotlight p-4">
            <div className="relative z-[2] flex items-center justify-between">
              <p className="eyebrow text-[10px]">{label}</p>
              <I className="h-4 w-4 text-gold" />
            </div>
            <p className="num relative z-[2] mt-2 truncate text-xl font-semibold text-ivory">{value}</p>
          </Reveal>
        ))}
      </div>

      {/* --------------------------------- TABS ------------------------------- */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="panel flex gap-1 overflow-x-auto p-1.5 lg:flex-col lg:self-start">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm transition ${
                tab === t.id ? "bg-gold/15 font-semibold text-gold" : "text-mute hover:bg-ivory/5 hover:text-ivory"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
          <div className="hidden border-t border-line lg:my-1 lg:block" />
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm text-live transition hover:bg-live/10"
          >
            <Icon.Logout className="h-4 w-4" /> Log out
          </button>
        </nav>

        <div key={tab} className="animate-rise">
          {tab === "details" && (
            <DetailsForm
              profile={profile}
              onSaved={(user, token) => {
                setProfile(user);
                updateUser(user, token);
              }}
            />
          )}
          {tab === "security" && <SecurityForm />}
          {tab === "preferences" && <Preferences />}
        </div>
      </div>
    </div>
  );
}

/* ================================ EDIT DETAILS ================================ */
function DetailsForm({ profile, onSaved }) {
  const initial = useMemo(() => {
    const f = { ...EMPTY };
    Object.keys(EMPTY).forEach((k) => (f[k] = profile[k] ?? ""));
    return f;
  }, [profile]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState("");

  useEffect(() => setForm(initial), [initial]);

  const changed = Object.keys(EMPTY).filter((k) => (form[k] ?? "").trim() !== (initial[k] ?? "").trim());
  const dirty = changed.length > 0;

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved("");
    if (error?.field === k) setError(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError(null);
    setSaved("");
    try {
      const patch = Object.fromEntries(changed.map((k) => [k, form[k]]));
      const res = await api.patch("/profile", patch);
      onSaved(res.data.user, res.data.token);
      setSaved("Your profile has been updated.");
    } catch (err) {
      setError({
        message: err.response?.data?.message || "Could not save your changes.",
        field: err.response?.data?.field,
      });
    } finally {
      setSaving(false);
    }
  }

  const fieldErr = (k) => (error?.field === k ? error.message : null);

  return (
    <form onSubmit={submit} className="panel p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-3xl text-ivory">Edit profile</h2>
          <p className="mt-1 text-sm text-mute">This is how buyers and sellers see you on BidZone.</p>
        </div>
        {dirty && <span className="text-xs font-medium text-gold">{changed.length} unsaved change{changed.length > 1 ? "s" : ""}</span>}
      </div>

      {/* Photo */}
      <div className="mt-8 flex flex-col gap-5 rounded-xl border border-line bg-night-800/30 p-5 sm:flex-row sm:items-center">
        <Avatar name={form.name || profile.name} src={form.avatar_url.trim()} size={72} />
        <div className="flex-1">
          <Field label="Profile photo URL" hint="Paste a link to an image. Leave empty to use your initials." error={fieldErr("avatar_url")}>
            <input value={form.avatar_url} onChange={(e) => set("avatar_url", e.target.value)} placeholder="https://…" className="input" />
          </Field>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={fieldErr("name")}>
          <IconInput icon={Icon.User}>
            <input required minLength={2} maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} className="input pl-10" />
          </IconInput>
        </Field>
        <Field label="Email" error={fieldErr("email")}>
          <IconInput icon={Icon.Mail}>
            <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className="input pl-10" />
          </IconInput>
        </Field>
        <Field label="Phone" hint="Optional" error={fieldErr("phone")}>
          <IconInput icon={Icon.Phone}>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" className="input pl-10" />
          </IconInput>
        </Field>
        <Field label="Location" hint="Optional" error={fieldErr("location")}>
          <IconInput icon={Icon.Pin}>
            <input maxLength={120} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Delhi, India" className="input pl-10" />
          </IconInput>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Bio" error={fieldErr("bio")}>
            <textarea
              rows={4}
              maxLength={280}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Collector of vintage watches. Fast shipping, honest descriptions."
              className="input resize-none"
            />
            <p className={`mt-1.5 text-right text-xs ${form.bio.length > 260 ? "text-gold" : "text-mute-dark"}`}>{form.bio.length}/280</p>
          </Field>
        </div>
      </div>

      <div className="mt-2 space-y-3">
        {error && !error.field && <Alert kind="error">{error.message}</Alert>}
        {saved && <Alert kind="success">{saved}</Alert>}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
        <button type="button" disabled={!dirty || saving} onClick={() => setForm(initial)} className="btn-ghost">
          Discard changes
        </button>
        <button type="submit" disabled={!dirty || saving} className="btn-gold min-w-[150px]">
          {saving ? "Saving…" : (
            <>
              <Icon.Check className="h-4 w-4" /> Save changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/* ================================== SECURITY ================================== */
function strength(pw) {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function SecurityForm() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState("");

  const s = strength(form.next);
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong"];
  const colors = ["bg-line-strong", "bg-live", "bg-gold", "bg-gold-light", "bg-win"];
  const mismatch = form.confirm && form.next !== form.confirm;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setDone("");
    if (form.next !== form.confirm) {
      setError({ message: "New passwords don't match.", field: "confirm" });
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/profile/password", { current_password: form.current, new_password: form.next });
      setDone(res.data.message || "Password changed.");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setError({ message: err.response?.data?.message || "Could not change password.", field: err.response?.data?.field });
    } finally {
      setSaving(false);
    }
  }

  const type = show ? "text" : "password";

  return (
    <form onSubmit={submit} className="panel p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-ivory">Change password</h2>
          <p className="mt-1 text-sm text-mute">You'll need your current password. Passwords are stored as bcrypt hashes.</p>
        </div>
        <button type="button" onClick={() => setShow((v) => !v)} className="btn-ghost shrink-0 py-2 text-xs">
          {show ? <Icon.EyeOff className="h-4 w-4" /> : <Icon.Eye className="h-4 w-4" />} {show ? "Hide" : "Show"}
        </button>
      </div>

      <div className="mt-8 max-w-md space-y-5">
        <Field label="Current password" error={error?.field === "current_password" ? error.message : null}>
          <input type={type} required autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} className="input" />
        </Field>
        <Field label="New password" error={error?.field === "new_password" ? error.message : null}>
          <input type={type} required minLength={6} autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} className="input" />
          {form.next && (
            <div className="mt-2 flex items-center gap-3">
              <div className="grid flex-1 grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1 rounded-full transition-colors ${s >= i ? colors[s] : "bg-line"}`} />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-mute">{labels[s]}</span>
            </div>
          )}
        </Field>
        <Field label="Confirm new password" error={mismatch ? "Passwords don't match." : error?.field === "confirm" ? error.message : null}>
          <input type={type} required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="input" />
        </Field>

        {error && !["current_password", "new_password", "confirm"].includes(error.field) && <Alert kind="error">{error.message}</Alert>}
        {done && <Alert kind="success">{done}</Alert>}

        <button type="submit" disabled={saving || mismatch} className="btn-gold w-full sm:w-auto">
          <Icon.Lock className="h-4 w-4" /> {saving ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}

/* ================================= PREFERENCES ================================= */
function Preferences() {
  const { theme, toggle } = useTheme();
  const options = [
    { id: "dark", label: "Dark", icon: Icon.Moon, preview: "from-[#0B0D12] to-[#1E2330]" },
    { id: "light", label: "Light", icon: Icon.Sun, preview: "from-[#F3F1EC] to-white" },
  ];
  return (
    <div className="panel p-6 sm:p-8">
      <h2 className="font-display text-3xl text-ivory">Preferences</h2>
      <p className="mt-1 text-sm text-mute">Saved on this device.</p>

      <p className="label mt-8">Appearance</p>
      <div className="grid max-w-md grid-cols-2 gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => theme !== o.id && toggle()}
            className={`overflow-hidden rounded-xl border text-left transition ${theme === o.id ? "border-gold shadow-glow" : "border-line hover:border-gold/40"}`}
          >
            <div className={`h-20 bg-gradient-to-br ${o.preview} p-3`}>
              <div className="h-2 w-10 rounded-full bg-[#F2B544]" />
              <div className="mt-2 h-2 w-16 rounded-full bg-gray-400/40" />
              <div className="mt-1.5 h-2 w-12 rounded-full bg-gray-400/30" />
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm text-ivory">
                <o.icon className="h-4 w-4" /> {o.label}
              </span>
              {theme === o.id && <Icon.Check className="h-4 w-4 text-gold" />}
            </div>
          </button>
        ))}
      </div>

      <p className="label mt-8">Notifications</p>
      <div className="max-w-md space-y-2">
        {[
          ["Outbid alerts", "When someone bids higher than you"],
          ["Auction results", "When you win, lose or sell"],
          ["New bids on my items", "When someone bids on your listing"],
        ].map(([t, d]) => (
          <div key={t} className="flex items-center justify-between rounded-lg border border-line px-4 py-3">
            <div>
              <p className="text-sm text-ivory">{t}</p>
              <p className="text-xs text-mute">{d}</p>
            </div>
            <span className="rounded-full bg-win/15 px-2.5 py-1 text-[11px] font-semibold text-win">Live · On</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- helpers ---------------------------------- */
function Field({ label, hint, error, children }) {
  return (
    <div>
      <label className="label">
        {label} {hint && <span className="font-normal text-mute-dark">· {hint}</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-live">
          <Icon.Alert className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

function IconInput({ icon: I, children }) {
  return (
    <div className="relative">
      <I className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
      {children}
    </div>
  );
}
