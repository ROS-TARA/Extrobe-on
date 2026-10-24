/*
  Settings.jsx — account settings, simple and honest: account info, password, log out.

  Props:
    user        logged-in user
    token       the sp_token
    onNavigate  fn(key)   "profile" (for the Edit profile button)
    onLogout    fn()
*/
import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function api(path, { method = "POST", token, body } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export default function Settings({ user, token, onNavigate, onLogout }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  if (!user) return <div className="tzst"><style>{CSS}</style><p className="tzst-mute">Log in to see your settings.</p></div>;

  const google = !!user.googleLinked;
  const hasPassword = user.hasPassword !== false;
  const method = google && hasPassword ? "Google and password" : google ? "Google" : "Email and password";

  async function changePassword(e) {
    e.preventDefault();
    setErr(""); setOk("");
    if (next.length < 8) return setErr("New password needs at least 8 characters.");
    if (next !== again) return setErr("The new passwords don’t match.");
    setBusy(true);
    try {
      await api("/api/auth/change-password", { token, body: { currentPassword: cur, newPassword: next } });
      setOk("Password updated.");
      setCur(""); setNext(""); setAgain("");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function emailLink() {
    setErr(""); setOk(""); setBusy(true);
    try {
      const d = await api("/api/auth/forgot", { body: { email: user.email } });
      setOk(d.message || "Check your email for the link.");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tzst">
      <style>{CSS}</style>
      <h1 className="tzst-h">Settings</h1>

      <section className="tzst-card">
        <h2>Account</h2>
        <div className="tzst-row"><span>Username</span><b>@{user.username}</b></div>
        <div className="tzst-row"><span>Email</span><b>{user.email || "—"}</b></div>
        <div className="tzst-row"><span>Signs in with</span><b>{method}</b></div>
        <button className="tzst-btn" onClick={() => onNavigate && onNavigate("profile")}>Edit profile</button>
      </section>

      <section className="tzst-card">
        <h2>Password</h2>
        {hasPassword ? (
          <form onSubmit={changePassword}>
            <input className="tzst-in" type="password" placeholder="Current password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            <input className="tzst-in" type="password" placeholder="New password (8+ characters)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <input className="tzst-in" type="password" placeholder="Confirm new password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            <button className="tzst-btn tzst-main" type="submit" disabled={busy || !cur || !next || !again}>{busy ? "Updating…" : "Update password"}</button>
          </form>
        ) : (
          <>
            <p className="tzst-mute">You signed up with Google, so there’s no Tranzle password yet. You can add one if you also want to log in with your email.</p>
            <button className="tzst-btn tzst-main" onClick={emailLink} disabled={busy}>{busy ? "Sending…" : "Email me a link to set one"}</button>
          </>
        )}
        {err && <p className="tzst-err" role="alert">{err}</p>}
        {ok && <p className="tzst-ok" role="status">{ok}</p>}
      </section>

      {onLogout && (
        <section className="tzst-card">
          <h2>Session</h2>
          <button className="tzst-btn tzst-danger" onClick={onLogout}>Log out</button>
        </section>
      )}
    </div>
  );
}

const CSS = `
.tzst{max-width:640px;margin:0 auto;color:var(--sp-plat);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.tzst *{box-sizing:border-box}
.tzst-h{margin:0 0 18px;font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:600;letter-spacing:-.01em}
.tzst-card{margin-bottom:14px;padding:20px;border:1px solid var(--sp-rim);border-radius:16px;background:var(--sp-surface)}
.tzst-card h2{margin:0 0 14px;font-size:16px;font-weight:600}
.tzst-row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--sp-rim);font-size:15px}
.tzst-row span{color:var(--sp-ash);flex:none}
.tzst-row b{font-weight:500;text-align:right;overflow-wrap:anywhere}
.tzst-mute{margin:0 0 14px;color:var(--sp-ash);font-size:14px;line-height:1.5}
.tzst-in{display:block;width:100%;margin:0 0 10px;padding:12px 14px;background:var(--sp-void);color:var(--sp-plat);border:1px solid var(--sp-rim);border-radius:10px;font:inherit;font-size:16px}
.tzst-in::placeholder{color:var(--sp-ghost)}
.tzst-in:focus{outline:2px solid var(--sp-signal);outline-offset:1px;border-color:transparent}
.tzst-btn{margin-top:14px;padding:11px 18px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-surface2);color:var(--sp-plat);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.tzst-btn:hover:not(:disabled){background:var(--sp-rim)}
.tzst-btn:disabled{opacity:.5;cursor:not-allowed}
.tzst-in + .tzst-btn,.tzst-mute + .tzst-btn{margin-top:4px}
.tzst-main{border-color:transparent;background:var(--sp-signal);color:#fff}
.tzst-main:hover:not(:disabled){background:color-mix(in srgb, var(--sp-signal) 82%, #fff)}
.tzst-danger{margin-top:0;color:var(--sp-live);border-color:color-mix(in srgb, var(--sp-live) 35%, transparent);background:none}
.tzst-err{margin:12px 0 0;color:var(--sp-live);font-size:14px}
.tzst-ok{margin:12px 0 0;color:var(--sp-ice);font-size:14px}
.tzst button:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}
@media (max-width:640px){.tzst-card{padding:16px}.tzst-h{font-size:26px}.tzst-btn{width:100%}}
`;