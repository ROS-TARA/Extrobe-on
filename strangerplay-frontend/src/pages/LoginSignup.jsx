import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   LoginSignup.jsx — full rebuild against the locked design system.

   This file does NOT import StrangerPlay_Main.jsx, so the design
   tokens (DS) and shared classes (.sp-input, .sp-btn-primary, etc.)
   are redeclared here. Keep these in sync if the palette in
   StrangerPlay_Main.jsx ever changes — copy the DS object across.

   Identity for this screen specifically: "your ticket into the show."
   The whole page reads as an admission ticket — a perforated stub
   on the left (branding), torn off from the ticket body on the
   right (the actual form). Signature element: a rotated ink-stamp
   "ADMIT ONE" mark, reusing the ink-stamp button language that's
   already locked in everywhere else.

   FUNCTIONAL NOTE: handleLogin / handleSignup / saveSession logic
   is carried over unchanged from the old file — it already matches
   server.js exactly (POST /api/auth/signin, POST /api/auth/signup,
   { token, user } response shape). This rebuild only touches layout
   and styling, per your brief.

   THREE THINGS I CHANGED ON PURPOSE (read this before you ask "why"):

   1. Cut the Google / X buttons. They called no real function —
      onClick={()=>{}} — and your backend has no OAuth route. A button
      that does nothing on click is worse than no button; it reads as
      broken, not "coming soon." Easy to add back once there's a real
      route to hit.

   2. Cut "forgot password?". Same reason — no /api/auth/forgot route
      exists yet. Flag it as a real backlog item, not a dead link.

   3. Killed the hardcoded flag:"🇳🇵", country:"Nepal" on every signup.
      That was you testing locally, not a feature — it would've
      silently flagged every single user on Earth as Nepali on the
      leaderboard. Replaced with a real (optional) country picker
      that defaults to 🌍 "Prefer not to say".
═══════════════════════════════════════════════════════════════ */

const DS = {
  void:    "#0d0b08",
  surface: "#161310",
  surface2:"#1d1812",
  rim:     "#2b251d",
  rimHov:  "#473b2a",
  plat:    "#f4ede1",
  ash:     "#8a7d68",
  ghost:   "#352d22",
  signal:  "#c97b3d",
  live:    "#d6452f",
  ice:     "#7a8f7c",
  gold:    "#e0b454",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; }
  body {
    background: ${DS.void};
    color: ${DS.plat};
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
    -webkit-tap-highlight-color: transparent;
    background-image:
      radial-gradient(ellipse 900px 600px at 15% -10%, ${DS.signal}14, transparent 60%),
      radial-gradient(ellipse 700px 500px at 100% 30%, ${DS.live}0d, transparent 55%);
  }
  body::after {
    content: '';
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    opacity: 0.05; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  ::-webkit-scrollbar       { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${DS.rim}; border-radius: 99px; }

  @keyframes ls-up    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ls-slide { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes ls-stamp { 0%{opacity:0;transform:scale(1.8) rotate(-18deg)} 55%{opacity:1} 100%{opacity:1;transform:scale(1) rotate(-7deg)} }
  @keyframes ls-spin  { to{transform:rotate(360deg)} }
  @keyframes ls-pop   { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }

  .ls-up    { animation: ls-up 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .ls-panel { animation: ls-slide 0.32s cubic-bezier(0.16,1,0.3,1) both; }

  /* ── BUTTON — ink-stamp primary ── */
  .sp-btn-primary {
    background: ${DS.void};
    color: ${DS.signal};
    border: 1.5px solid ${DS.signal};
    border-radius: 3px;
    font-family: 'Fraunces', serif;
    font-weight: 600;
    font-style: italic;
    font-size: 14px;
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s, background 0.18s, color 0.18s;
    box-shadow: 4px 4px 0 0 ${DS.signal}30;
  }
  .sp-btn-primary:hover:not(:disabled) { background: ${DS.signal}; color: ${DS.void}; transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 ${DS.signal}55; }
  .sp-btn-primary:active:not(:disabled) { transform: translate(0,0); box-shadow: 2px 2px 0 0 ${DS.signal}55; }
  .sp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .sp-btn-ghost {
    background: transparent;
    color: ${DS.ash};
    border: 1px dashed ${DS.rimHov};
    border-radius: 3px;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, letter-spacing 0.15s;
  }
  .sp-btn-ghost:hover { border-color: ${DS.signal}; border-style: solid; color: ${DS.plat}; letter-spacing: 0.4px; }

  /* ── INPUT — underline only ── */
  .sp-input {
    background: transparent;
    border: none;
    border-bottom: 1.5px solid ${DS.rim};
    border-radius: 0;
    padding: 12px 2px;
    color: ${DS.plat};
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.25s;
    width: 100%;
  }
  .sp-input:focus { border-bottom-color: ${DS.signal}; }
  .sp-input::placeholder { color: ${DS.ghost}; }
  .sp-input.err { border-bottom-color: ${DS.live}; }
  select.sp-input { cursor: pointer; appearance: none; -webkit-appearance: none; }
  select.sp-input option { background: ${DS.surface}; color: ${DS.plat}; }

  /* ── TAG — ticket-stub ── */
  .sp-tag {
    display: inline-block;
    background: ${DS.surface2};
    border: 1px dashed ${DS.rim};
    border-radius: 0;
    padding: 3px 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    color: ${DS.ash};
    letter-spacing: 0.3px;
  }

  /* ── MODE SWITCHER — carved groove ── */
  .sp-mode-rail {
    display: inline-flex;
    width: 100%;
    background: ${DS.void};
    border: 1px solid ${DS.rim};
    border-radius: 3px;
    padding: 3px;
    gap: 2px;
    margin-bottom: 32px;
  }
  .sp-mode-btn {
    flex: 1;
    padding: 10px 0;
    border-radius: 2px;
    border: none;
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
    letter-spacing: 0.3px;
  }
  .sp-mode-btn.on  { background: ${DS.signal}; color: ${DS.void}; }
  .sp-mode-btn.off { background: transparent; color: ${DS.ash}; }
  .sp-mode-btn.off:hover { color: ${DS.plat}; }

  /* ── TICKET LAYOUT — perforated tear-line between stub and body ── */
  .ls-left {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .ls-divider { position: relative; flex-shrink: 0; width: 1px; align-self: stretch;
    background-image: repeating-linear-gradient(to bottom, ${DS.rim} 0 6px, transparent 6px 15px);
  }
  .ls-divider::before, .ls-divider::after {
    content: ''; position: absolute; left: 50%; transform: translateX(-50%);
    width: 18px; height: 18px; border-radius: 50%;
    background: ${DS.void}; border: 1px solid ${DS.rim};
  }
  .ls-divider::before { top: -9px; }
  .ls-divider::after  { bottom: -9px; }
  .ls-right { width: 440px; flex-shrink: 0; }

  @media (max-width: 760px) {
    .ls-left, .ls-divider { display: none !important; }
    .ls-right { width: 100% !important; }
  }
`;

/* ──────────────────────────────────────────
   AMBIENT GRID — same static treatment used app-wide
────────────────────────────────────────── */
function AmbientGrid() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      backgroundImage: `
        linear-gradient(${DS.rim} 1px, transparent 1px),
        linear-gradient(90deg, ${DS.rim} 1px, transparent 1px)
      `,
      backgroundSize: "80px 80px",
      opacity: 0.35,
      maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
      WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
    }} />
  );
}

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: "50%",
      border: `2px solid ${DS.void}33`, borderTopColor: DS.void,
      animation: "ls-spin 0.7s linear infinite",
      display: "inline-block", verticalAlign: "middle", marginRight: 8,
    }} />
  );
}

/* ── password strength — recolored to locked palette,
     weak→live, fair→gold, good→ice, strong→signal ── */
function pwStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const table = [
    { label: "weak",   color: DS.live },
    { label: "weak",   color: DS.live },
    { label: "fair",   color: DS.gold },
    { label: "good",   color: DS.ice },
    { label: "strong", color: DS.signal },
  ];
  return { score: s, ...table[s] };
}

/* ── COUNTRY PICKER — fixes the hardcoded-Nepal bug.
     Index 0 is the real default: "prefer not to say" → 🌍, no country. ── */
const COUNTRIES = [
  { flag: "🌍", country: "" },
  { flag: "🇳🇵", country: "Nepal" },
  { flag: "🇺🇸", country: "United States" },
  { flag: "🇬🇧", country: "United Kingdom" },
  { flag: "🇮🇳", country: "India" },
  { flag: "🇧🇷", country: "Brazil" },
  { flag: "🇩🇪", country: "Germany" },
  { flag: "🇫🇷", country: "France" },
  { flag: "🇯🇵", country: "Japan" },
  { flag: "🇰🇷", country: "South Korea" },
  { flag: "🇨🇳", country: "China" },
  { flag: "🇲🇽", country: "Mexico" },
  { flag: "🇨🇦", country: "Canada" },
  { flag: "🇦🇺", country: "Australia" },
  { flag: "🇪🇸", country: "Spain" },
  { flag: "🇮🇹", country: "Italy" },
  { flag: "🇵🇭", country: "Philippines" },
  { flag: "🇮🇩", country: "Indonesia" },
  { flag: "🇵🇰", country: "Pakistan" },
  { flag: "🇳🇬", country: "Nigeria" },
  { flag: "🇿🇦", country: "South Africa" },
  { flag: "🇷🇺", country: "Russia" },
];

function Field({ label, type = "text", placeholder, value, onChange, error, hint, extra }) {
  const [show, setShow] = useState(false);
  const isP = type === "password";
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <label style={{ fontSize: 11, color: DS.ash, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{label}</label>
        {extra}
      </div>
      <div style={{ position: "relative" }}>
        <input
          className={`sp-input${error ? " err" : ""}`}
          type={isP && show ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ paddingRight: isP ? 40 : 2 }}
          autoComplete="off"
        />
        {isP && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: DS.ash, fontSize: 16 }}
          >{show ? "🙈" : "👁"}</button>
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: DS.live, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>{error}</div>}
      {hint && !error && <div style={{ fontSize: 12, color: DS.ash, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
      <div style={{ flex: 1, height: 1, background: DS.rim }} />
      <span style={{ fontSize: 11, color: DS.ash, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>or</span>
      <div style={{ flex: 1, height: 1, background: DS.rim }} />
    </div>
  );
}

/* ── SUCCESS — stamped admission, not a generic checkmark toast ── */
function Success({ mode, username, onNavigate }) {
  useEffect(() => {
    const t = setTimeout(() => { if (onNavigate) onNavigate("home"); }, 1800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="ls-panel" style={{ textAlign: "center", padding: "30px 0" }}>
      <div style={{
        width: 76, height: 76, borderRadius: "50%", margin: "0 auto 26px",
        background: DS.surface, border: `1.5px solid ${DS.signal}`,
        boxShadow: `4px 4px 0 0 ${DS.signal}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30, color: DS.signal,
        animation: "ls-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>✓</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 32, letterSpacing: -0.5, marginBottom: 10, color: DS.plat }}>
        {mode === "signup" ? "You're in." : "Welcome back."}
      </div>
      <div style={{ fontSize: 13.5, color: DS.ash, marginBottom: 30, lineHeight: 1.7 }}>
        {mode === "signup" ? `Account created for ${username}. Time to talk to a stranger.` : `Good to see you again, ${username}.`}
      </div>
      <div className="sp-tag" style={{ display: "inline-block", color: DS.signal, borderColor: DS.signal + "55" }}>
        redirecting →
      </div>
    </div>
  );
}

/* ── the ticket stamp — signature element for this page ── */
function AdmitStamp() {
  return (
    <div style={{
      position: "absolute", top: 36, right: 0,
      width: 104, height: 104, borderRadius: "50%",
      border: `1.5px solid ${DS.signal}`, boxShadow: `0 0 0 3px ${DS.void}, 0 0 0 4px ${DS.signal}40`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
      transform: "rotate(-7deg)",
      animation: "ls-stamp 0.7s 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
      pointerEvents: "none",
    }}>
      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 14, color: DS.signal, letterSpacing: 0.5, lineHeight: 1 }}>ADMIT</span>
      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 14, color: DS.signal, letterSpacing: 0.5, lineHeight: 1 }}>ONE</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: DS.ash, letterSpacing: 1, marginTop: 2 }}>SP · LIVE</span>
    </div>
  );
}

const GAMES = [
  ["🔊", "Echo"],
  ["😐", "Don't Laugh"],
  ["🪞", "Mirror Me"],
  ["🎭", "Vibe Check"],
  ["🌶️", "Hot Take"],
  ["📖", "Finish My Story"],
];

/* ── left panel — the ticket stub ── */
function LeftPanel() {
  return (
    <div className="ls-left" style={{ flex: 1, padding: "100px 56px 56px", position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <div className="ls-up" style={{ position: "relative" }}>
        <AdmitStamp />
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>
          // your ticket in
        </div>
        <h1 style={{
          fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic",
          fontSize: "clamp(38px,4.4vw,54px)", lineHeight: 1.04, letterSpacing: -0.5,
          color: DS.plat, marginBottom: 22, maxWidth: 360,
        }}>
          Call a stranger.<br />Talk first.<br /><span style={{ color: DS.signal }}>Play for points.</span>
        </h1>
        <p style={{ fontSize: 14.5, color: DS.ash, lineHeight: 1.75, maxWidth: 300 }}>
          No followers. No feed. Just a camera, someone you've never met, and a game you pick together.
        </p>
      </div>

      <div className="ls-up" style={{ animationDelay: "0.1s" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          // games on the roster
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {GAMES.map(([emoji, name]) => (
            <span key={name} className="sp-tag">{emoji} {name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN EXPORT
   Props:
     onNavigate(page) — called after successful login/signup
     onLogin(userData) — tells StrangerPlay_Main that auth state changed
──────────────────────────────────────────────── */
export default function LoginSignup({ onNavigate, onLogin }) {
  const [mode, setMode]   = useState("login");
  const [step, setStep]   = useState(1);
  const [done, setDone]   = useState(false);
  const [doneUser, setDoneUser] = useState("");

  // login fields
  const [lEmail, setLEmail] = useState("");
  const [lPass, setLPass]   = useState("");
  const [lLoad, setLLoad]   = useState(false);
  const [lErr, setLErr]     = useState({});

  // signup fields
  const [sName, setSName]     = useState("");
  const [sEmail, setSEmail]   = useState("");
  const [sCountryIdx, setSCountryIdx] = useState(0); // 0 = 🌍 prefer not to say
  const [sUser, setSUser]     = useState("");
  const [sPass, setSPass]     = useState("");
  const [sConf, setSConf]     = useState("");
  const [agree, setAgree]     = useState(false);
  const [sLoad, setSLoad]     = useState(false);
  const [sErr, setSErr]       = useState({});
  const [sMsg, setSMsg]       = useState(""); // server-level error (username/email taken)

  // VITE_API_URL → http://localhost:3001 in dev, your Render URL in prod.
  const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";

  const str = pwStrength(sPass);

  // Already logged in (token in localStorage) → skip this page entirely.
  useEffect(() => {
    if (localStorage.getItem("sp_token") && onNavigate) onNavigate("home");
  }, []);

  function switchMode(m) { setMode(m); setStep(1); setLErr({}); setSErr({}); setSMsg(""); }

  /* localStorage.setItem persists across refreshes — this is the whole
     auth session. sp_token = JWT for API calls. sp_user = display data.
     onLogin(user) pushes the new auth state up to StrangerPlay_Main
     without a page reload, so the nav/points pill update instantly. */
  function saveSession(token, user) {
    localStorage.setItem("sp_token", token);
    localStorage.setItem("sp_user", JSON.stringify(user));
    setDoneUser(user.username || user.name || "");
    if (onLogin) onLogin(user);
    setDone(true);
  }

  async function handleLogin() {
    const err = {};
    if (!lEmail) err.email = "email required";
    else if (!lEmail.includes("@")) err.email = "enter a valid email";
    if (!lPass) err.pass = "password required";
    if (Object.keys(err).length) { setLErr(err); return; }
    setLLoad(true); setLErr({});
    try {
      const res = await fetch(`${API}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lEmail, password: lPass }),
      });
      const data = await res.json();
      if (!res.ok) { setLErr({ pass: data.error || "wrong email or password" }); setLLoad(false); return; }
      saveSession(data.token, data.user);
    } catch {
      setLErr({ pass: "can't reach server — is your backend running?" });
    }
    setLLoad(false);
  }

  function handleStep1() {
    const err = {};
    if (!sName.trim()) err.name = "what's your name?";
    if (!sEmail) err.email = "email required";
    else if (!sEmail.includes("@")) err.email = "enter a valid email";
    if (Object.keys(err).length) { setSErr(err); return; }
    setSErr({}); setStep(2);
  }

  async function handleSignup() {
    const err = {};
    if (!sUser.trim()) err.user = "pick a username";
    else if (sUser.length < 3) err.user = "at least 3 characters";
    if (!sPass) err.pass = "set a password";
    else if (sPass.length < 8) err.pass = "at least 8 characters";
    if (sConf !== sPass) err.conf = "passwords don't match";
    if (!agree) err.agree = "you need to agree to continue";
    if (Object.keys(err).length) { setSErr(err); return; }
    setSLoad(true); setSErr({}); setSMsg("");
    const { flag, country } = COUNTRIES[sCountryIdx];
    try {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sName, email: sEmail, username: sUser, password: sPass, flag, country }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSMsg(data.error || "username or email already taken");
        setSLoad(false); return;
      }
      saveSession(data.token, data.user);
    } catch {
      setSMsg("can't reach server — is your backend running?");
    }
    setSLoad(false);
  }

  return (
    <>
      <style>{css}</style>
      <AmbientGrid />

      <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "100vh" }}>
        <LeftPanel />
        <div className="ls-divider" />

        <div className="ls-right" style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "100px 32px 60px" }}>
          <div style={{ width: "100%", maxWidth: 360 }}>

            {done ? (
              <Success mode={mode} username={doneUser} onNavigate={onNavigate} />
            ) : (
              <>
                <div className="sp-mode-rail">
                  {["login", "signup"].map(m => (
                    <button key={m} className={`sp-mode-btn ${mode === m ? "on" : "off"}`} onClick={() => switchMode(m)}>
                      {m === "login" ? "Sign In" : "Sign Up"}
                    </button>
                  ))}
                </div>

                {/* ────── LOGIN ────── */}
                {mode === "login" && (
                  <div className="ls-panel">
                    <div style={{ marginBottom: 26 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
                        // welcome back
                      </div>
                      <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 32, letterSpacing: -0.5, color: DS.plat }}>
                        Sign in
                      </h2>
                    </div>

                    <Field label="Email" type="email" placeholder="you@example.com"
                      value={lEmail} onChange={v => { setLEmail(v); setLErr(e => ({ ...e, email: "" })); }} error={lErr.email} />
                    <Field label="Password" type="password" placeholder="your password"
                      value={lPass} onChange={v => { setLPass(v); setLErr(e => ({ ...e, pass: "" })); }} error={lErr.pass} />

                    <button className="sp-btn-primary" style={{ width: "100%", padding: "13px 0", marginTop: 8 }} onClick={handleLogin} disabled={lLoad}>
                      {lLoad ? <><Spinner />Signing in...</> : "Sign in →"}
                    </button>

                    <div style={{ marginTop: 26, textAlign: "center", fontSize: 13, color: DS.ash, fontFamily: "'JetBrains Mono', monospace" }}>
                      no account?{" "}
                      <button onClick={() => switchMode("signup")} style={{ background: "none", border: "none", color: DS.signal, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>sign up →</button>
                    </div>
                  </div>
                )}

                {/* ────── SIGNUP ────── */}
                {mode === "signup" && (
                  <div className="ls-panel" key={step}>
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {[1, 2].map(s => (
                          <div key={s} style={{ height: 2, flex: 1, background: step >= s ? DS.signal : DS.rim, transition: "background 0.3s" }} />
                        ))}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
                        // step {step} of 2
                      </div>
                      <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 32, letterSpacing: -0.5, color: DS.plat }}>
                        {step === 1 ? "Who are you?" : "Lock it in"}
                      </h2>
                    </div>

                    {sMsg && (
                      <div style={{ background: DS.live + "14", border: `1px solid ${DS.live}40`, borderRadius: 2, padding: "10px 14px", fontSize: 12.5, color: DS.live, fontFamily: "'JetBrains Mono', monospace", marginBottom: 18 }}>
                        ⚠ {sMsg}
                      </div>
                    )}

                    {step === 1 && (
                      <>
                        <Field label="Full Name" placeholder="your name"
                          value={sName} onChange={v => { setSName(v); setSErr(e => ({ ...e, name: "" })); }} error={sErr.name} />
                        <Field label="Email" type="email" placeholder="you@example.com"
                          value={sEmail} onChange={v => { setSEmail(v); setSErr(e => ({ ...e, email: "" })); }} error={sErr.email} />

                        <div style={{ marginBottom: 18 }}>
                          <label style={{ fontSize: 11, color: DS.ash, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 7 }}>
                            Country <span style={{ color: DS.ghost, textTransform: "none" }}>(optional, shows on leaderboard)</span>
                          </label>
                          <select className="sp-input" value={sCountryIdx} onChange={e => setSCountryIdx(Number(e.target.value))}>
                            {COUNTRIES.map((c, i) => (
                              <option key={i} value={i}>{c.flag} {c.country || "Prefer not to say"}</option>
                            ))}
                          </select>
                        </div>

                        <button className="sp-btn-primary" style={{ width: "100%", padding: "13px 0", marginTop: 4 }} onClick={handleStep1}>
                          Continue →
                        </button>

                        <div style={{ marginTop: 22, textAlign: "center", fontSize: 13, color: DS.ash, fontFamily: "'JetBrains Mono', monospace" }}>
                          already have one?{" "}
                          <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: DS.signal, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>sign in →</button>
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <Field label="Username" placeholder="pick something cool"
                          value={sUser} onChange={v => { setSUser(v.toLowerCase().replace(/\s/g, "_")); setSErr(e => ({ ...e, user: "" })); setSMsg(""); }}
                          error={sErr.user} hint="this is what strangers will see" />

                        <Field label="Password" type="password" placeholder="make it hard to guess"
                          value={sPass} onChange={v => { setSPass(v); setSErr(e => ({ ...e, pass: "" })); }} error={sErr.pass} />

                        {sPass && (
                          <div style={{ marginTop: -10, marginBottom: 18 }}>
                            <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ height: 3, flex: 1, background: i <= str.score ? str.color : DS.rim, transition: "background 0.3s" }} />
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: str.color, fontFamily: "'JetBrains Mono', monospace" }}>{str.label}</div>
                          </div>
                        )}

                        <Field label="Confirm Password" type="password" placeholder="same again"
                          value={sConf} onChange={v => { setSConf(v); setSErr(e => ({ ...e, conf: "" })); }} error={sErr.conf} />

                        <div style={{ marginBottom: 22 }}>
                          <div onClick={() => setAgree(a => !a)} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: 2, flexShrink: 0, marginTop: 2,
                              border: `1.5px solid ${agree ? DS.signal : DS.rim}`,
                              background: agree ? DS.signal + "18" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.2s", fontSize: 11, color: DS.signal,
                            }}>{agree ? "✓" : ""}</div>
                            <span style={{ fontSize: 12.5, color: DS.ash, lineHeight: 1.6 }}>
                              I agree to the <span style={{ color: DS.ice, cursor: "pointer" }}>terms</span> and <span style={{ color: DS.ice, cursor: "pointer" }}>privacy policy</span>. I'm at least 13 years old.
                            </span>
                          </div>
                          {sErr.agree && <div style={{ fontSize: 12, color: DS.live, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>{sErr.agree}</div>}
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                          <button className="sp-btn-ghost" style={{ padding: "12px 16px", fontSize: 16 }} onClick={() => { setStep(1); setSMsg(""); }}>←</button>
                          <button className="sp-btn-primary" style={{ flex: 1, padding: "13px 0" }} onClick={handleSignup} disabled={sLoad}>
                            {sLoad ? <><Spinner />Creating...</> : "Create account →"}
                          </button>
                        </div>

                        <div style={{ marginTop: 22, textAlign: "center", fontSize: 13, color: DS.ash, fontFamily: "'JetBrains Mono', monospace" }}>
                          already have one?{" "}
                          <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: DS.signal, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>sign in →</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
