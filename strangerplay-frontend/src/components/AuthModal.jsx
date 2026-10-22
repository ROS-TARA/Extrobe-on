/*
  AuthModal.jsx — welcome popup: "Continue with Google" + email sign in / sign up.

  Env (frontend .env):
    VITE_API_URL=https://your-backend.onrender.com
    VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com

  Props:
    open      boolean   show the popup
    onClose   fn        user chose "keep watching as a guest" / pressed Esc / clicked outside
    onAuth    fn(user, token, isNew)   login worked — save token, update app state
    online    number?   optional live "people online" count (from your socket "onlineCount")
    defaultMode "signup" | "signin"
*/
import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Load Google's sign-in script once, however many times the popup opens.
let gsiPromise = null;
function loadGsi() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => { gsiPromise = null; reject(new Error("Google script blocked")); };
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
}

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export default function AuthModal({ open, onClose, onAuth, online, defaultMode = "signup" }) {
  const [mode, setMode] = useState(defaultMode);
  const [f, setF] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [googleOk, setGoogleOk] = useState(false);
  const gBtn = useRef(null);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  // Google button
  useEffect(() => {
    if (!open || !GOOGLE_ID) return;
    let dead = false;
    loadGsi()
      .then(() => {
        if (dead || !gBtn.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_ID,
          callback: async ({ credential }) => {
            setBusy(true);
            setErr("");
            try {
              const d = await post("/api/auth/google", { credential });
              onAuthRef.current(d.user, d.token, !!d.isNew);
            } catch (e) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(gBtn.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(340, window.innerWidth - 84),
        });
        setGoogleOk(true);
      })
      .catch(() => setGoogleOk(false));
    return () => { dead = true; };
  }, [open]);

  if (!open) return null;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    if (mode === "signup") {
      if (!/^[a-z0-9_]{3,20}$/i.test(f.username)) return setErr("Username: 3–20 letters, numbers or underscores.");
      if (f.password.length < 8) return setErr("Password needs at least 8 characters.");
    }
    setBusy(true);
    try {
      const d = mode === "signup"
        ? await post("/api/auth/signup", { name: f.username, username: f.username, email: f.email, password: f.password })
        : await post("/api/auth/signin", { email: f.email, password: f.password });
      onAuth(d.user, d.token, mode === "signup");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setErr("");
    setInfo("");
    if (!f.email) return setErr("Type your email above first.");
    try {
      const d = await post("/api/auth/forgot", { email: f.email });
      setInfo(d.message);
    } catch (e) {
      setErr(e.message);
    }
  }

  const signup = mode === "signup";

  return (
    <div className="tz-back" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <style>{CSS}</style>
      <div className="tz-card" role="dialog" aria-modal="true" aria-labelledby="tz-title">
        <button className="tz-x" onClick={onClose} aria-label="Close">×</button>

        <h2 id="tz-title" className="tz-h">Someone’s waiting to play with you.</h2>
        <p className="tz-sub">Sign in to meet strangers on video and play games together.</p>
        {typeof online === "number" && online > 0 && (
          <p className="tz-live"><span className="tz-dot" />{online.toLocaleString()} {online === 1 ? "person" : "people"} online now</p>
        )}

        {GOOGLE_ID && (
          <>
            <div className="tz-g" ref={gBtn} style={{ display: googleOk ? "flex" : "none" }} />
            {googleOk && <div className="tz-or"><span>or use email</span></div>}
          </>
        )}

        <div className="tz-tabs" role="tablist">
          <button role="tab" aria-selected={signup} className={signup ? "on" : ""} onClick={() => { setMode("signup"); setErr(""); setInfo(""); }}>Create account</button>
          <button role="tab" aria-selected={!signup} className={!signup ? "on" : ""} onClick={() => { setMode("signin"); setErr(""); setInfo(""); }}>Sign in</button>
        </div>

        <form onSubmit={submit} noValidate>
          {signup && (
            <input className="tz-in" placeholder="Username" autoComplete="username" value={f.username} onChange={set("username")} maxLength={20} />
          )}
          <input className="tz-in" type="email" placeholder="Email" autoComplete="email" value={f.email} onChange={set("email")} />
          <input className="tz-in" type="password" placeholder={signup ? "Password (8+ characters)" : "Password"} autoComplete={signup ? "new-password" : "current-password"} value={f.password} onChange={set("password")} />

          {err && <p className="tz-err" role="alert">{err}</p>}
          {info && <p className="tz-info" role="status">{info}</p>}

          <button className="tz-go" type="submit" disabled={busy || !f.email || !f.password}>
            {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>

        {!signup && <button className="tz-link" onClick={forgot}>Forgot password?</button>}
        <button className="tz-guest" onClick={onClose}>Keep watching as a guest</button>
      </div>
    </div>
  );
}

const CSS = `
.tz-back{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(8,6,4,.74);backdrop-filter:blur(6px);animation:tz-fade .2s ease-out}
.tz-card{position:relative;width:100%;max-width:420px;max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:30px 26px 22px;background:#17130d;color:#f4ede1;border:1px solid #3a2f21;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.55);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;animation:tz-pop .24s cubic-bezier(.2,.8,.2,1)}
.tz-x{position:absolute;top:10px;right:12px;width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:#a39379;font-size:24px;line-height:1;cursor:pointer}
.tz-x:hover{color:#f4ede1;background:#241d13}
.tz-h{margin:0 28px 8px 0;font-family:"Iowan Old Style",Georgia,"Times New Roman",serif;font-weight:600;font-size:27px;line-height:1.18;letter-spacing:-.01em}
.tz-sub{margin:0 0 12px;color:#bfae92;font-size:15px;line-height:1.5}
.tz-live{display:flex;align-items:center;gap:8px;margin:0 0 20px;color:#f4ede1;font-size:14px}
.tz-dot{width:8px;height:8px;border-radius:50%;background:#58c27d;box-shadow:0 0 0 3px rgba(88,194,125,.2)}
.tz-g{justify-content:center;min-height:44px;margin:4px 0 0}
.tz-or{display:flex;align-items:center;gap:12px;margin:16px 0 4px;color:#a39379;font-size:13px}
.tz-or::before,.tz-or::after{content:"";flex:1;height:1px;background:#3a2f21}
.tz-tabs{display:flex;gap:20px;margin:14px 0 14px;border-bottom:1px solid #3a2f21}
.tz-tabs button{padding:8px 0 10px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:#a39379;font:inherit;font-size:15px;cursor:pointer}
.tz-tabs button.on{color:#f4ede1;border-bottom-color:#c97b3d}
.tz-in{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:12px 14px;background:#100d09;color:#f4ede1;border:1px solid #3a2f21;border-radius:10px;font:inherit;font-size:16px}
.tz-in::placeholder{color:#7c6e58}
.tz-in:focus{outline:2px solid #c97b3d;outline-offset:1px;border-color:transparent}
.tz-go{width:100%;margin-top:4px;padding:13px 16px;border:0;border-radius:999px;background:#c97b3d;color:#1a1209;font:inherit;font-size:16px;font-weight:600;cursor:pointer}
.tz-go:hover:not(:disabled){background:#d98a3f}
.tz-go:disabled{opacity:.5;cursor:not-allowed}
.tz-err{margin:0 0 10px;color:#ff9a86;font-size:14px;line-height:1.4}
.tz-info{margin:0 0 10px;color:#8fd3a5;font-size:14px;line-height:1.4}
.tz-link,.tz-guest{display:block;margin:12px auto 0;padding:4px;border:0;background:none;color:#a39379;font:inherit;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.tz-link:hover,.tz-guest:hover{color:#f4ede1}
.tz-card button:focus-visible{outline:2px solid #c97b3d;outline-offset:2px}
@keyframes tz-fade{from{opacity:0}to{opacity:1}}
@keyframes tz-pop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.tz-back,.tz-card{animation:none}}
`;
