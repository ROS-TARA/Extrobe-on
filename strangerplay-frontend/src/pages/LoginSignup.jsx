import { useState, useEffect } from "react";

const DS = {
  void:"var(--sp-void)", surface:"var(--sp-surface)", surface2:"var(--sp-surface2)",
  rim:"var(--sp-rim)", plat:"var(--sp-plat)", ash:"var(--sp-ash)", ghost:"var(--sp-ghost)",
  signal:"var(--sp-signal)", live:"var(--sp-live)", ice:"var(--sp-ice)", gold:"var(--sp-gold)",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--sp-void); color: var(--sp-plat); transition: background 0.2s, color 0.2s; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--sp-rim); border-radius: 4px; }
  @keyframes sp-enter { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sp-spin  { to{transform:rotate(360deg)} }
  .ls-input {
    background: var(--sp-surface2); border: 1.5px solid var(--sp-rim);
    border-radius: 8px; padding: 11px 14px; color: var(--sp-plat);
    font-size: 15px; outline: none; width: 100%; transition: border-color 0.15s;
  }
  .ls-input:focus { border-color: var(--sp-signal); }
  .ls-input::placeholder { color: var(--sp-ghost); }
  .ls-input.err { border-color: var(--sp-live); }
  .ls-btn {
    width: 100%; padding: 13px; background: var(--sp-signal);
    color: #fff; border: none; border-radius: 8px; font-size: 15px;
    font-weight: 600; cursor: pointer; transition: filter 0.15s;
  }
  .ls-btn:hover:not(:disabled) { filter: brightness(1.1); }
  .ls-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .ls-tab { flex: 1; padding: 12px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; background: transparent; }
  .ls-tab.on  { color: var(--sp-signal); border-bottom: 2px solid var(--sp-signal); }
  .ls-tab.off { color: var(--sp-ash); border-bottom: 2px solid transparent; }
  .ls-tab.off:hover { color: var(--sp-plat); }
  .ls-link { background: none; border: none; color: var(--sp-signal); cursor: pointer; font-weight: 600; font-size: 14px; font-family: inherit; }
  .ls-link:hover { text-decoration: underline; }
`;

const COUNTRIES = [
  { flag: "🌍", country: "" },
  { flag: "🇳🇵", country: "Nepal"          }, { flag: "🇺🇸", country: "United States"   },
  { flag: "🇬🇧", country: "United Kingdom" }, { flag: "🇮🇳", country: "India"           },
  { flag: "🇧🇷", country: "Brazil"         }, { flag: "🇩🇪", country: "Germany"         },
  { flag: "🇫🇷", country: "France"         }, { flag: "🇯🇵", country: "Japan"           },
  { flag: "🇰🇷", country: "South Korea"    }, { flag: "🇨🇦", country: "Canada"          },
  { flag: "🇦🇺", country: "Australia"      }, { flag: "🇲🇽", country: "Mexico"          },
  { flag: "🇵🇭", country: "Philippines"    }, { flag: "🇮🇩", country: "Indonesia"       },
  { flag: "🇳🇬", country: "Nigeria"        }, { flag: "🇷🇺", country: "Russia"          },
];

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
      animation: "sp-spin 0.7s linear infinite",
      display: "inline-block", verticalAlign: "middle", marginRight: 8,
    }} />
  );
}

function Field({ label, type = "text", placeholder, value, onChange, error, children }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: DS.ash, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          className={`ls-input${error ? " err" : ""}`}
          type={isPw && show ? "text" : type}
          placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          style={{ paddingRight: isPw ? 44 : 14 }}
        />
        {isPw && (
          <button type="button" onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: DS.ash, fontSize: 15 }}>
            {show ? "🙈" : "👁"}
          </button>
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: DS.live, marginTop: 5 }}>{error}</div>}
      {children}
    </div>
  );
}

function pwStrength(pw) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return {
    score: s,
    color: ["","#e41e3f","#f7b928","#45bd62","#2374e1"][s],
    label: ["","weak","fair","good","strong"][s],
  };
}

function Success({ mode, username, onNavigate }) {
  useEffect(() => {
    const t = setTimeout(() => onNavigate?.("home"), 1600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "36px 0", animation: "sp-enter 0.25s ease" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: DS.ice, margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff" }}>✓</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: DS.plat, marginBottom: 6 }}>
        {mode === "signup" ? "Account created" : "Welcome back"}
      </div>
      <div style={{ fontSize: 14, color: DS.ash }}>{username} · redirecting…</div>
    </div>
  );
}

/* ══════════════════════════════════
   MAIN EXPORT
   Props: onNavigate(page), onLogin(user)
══════════════════════════════════ */
export default function LoginSignup({ onNavigate, onLogin }) {
  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [doneUser, setDoneUser] = useState("");

  const [lEmail, setLEmail] = useState("");
  const [lPass,  setLPass]  = useState("");
  const [lLoad,  setLLoad]  = useState(false);
  const [lErr,   setLErr]   = useState({});

  const [sName,       setSName]       = useState("");
  const [sEmail,      setSEmail]      = useState("");
  const [sCountryIdx, setSCountryIdx] = useState(0);
  const [sUser,       setSUser]       = useState("");
  const [sPass,       setSPass]       = useState("");
  const [sConf,       setSConf]       = useState("");
  const [agree,       setAgree]       = useState(false);
  const [sLoad,       setSLoad]       = useState(false);
  const [sErr,        setSErr]        = useState({});
  const [sMsg,        setSMsg]        = useState("");

  useEffect(() => {
    if (localStorage.getItem("tz_token")) onNavigate?.("home");
  }, []);

  function switchMode(m) { setMode(m); setStep(1); setLErr({}); setSErr({}); setSMsg(""); }

  function saveSession(token, user) {
    localStorage.setItem("tz_token", token);
    localStorage.setItem("tz_user", JSON.stringify(user));
    setDoneUser(user.username || user.name || "");
    onLogin?.(user);
    setDone(true);
  }

  async function handleLogin() {
    const err = {};
    if (!lEmail) err.email = "Email required";
    else if (!lEmail.includes("@")) err.email = "Enter a valid email";
    if (!lPass) err.pass = "Password required";
    if (Object.keys(err).length) { setLErr(err); return; }
    setLLoad(true); setLErr({});
    try {
      const res = await fetch(`${API}/api/auth/signin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lEmail, password: lPass }),
      });
      const d = await res.json();
      if (!res.ok) setLErr({ pass: d.error || "Wrong email or password" });
      else saveSession(d.token, d.user);
    } catch { setLErr({ pass: "Can't reach server — is your backend running?" }); }
    setLLoad(false);
  }

  function handleStep1() {
    const err = {};
    if (!sName.trim()) err.name = "Enter your name";
    if (!sEmail) err.email = "Email required";
    else if (!sEmail.includes("@")) err.email = "Enter a valid email";
    if (Object.keys(err).length) { setSErr(err); return; }
    setSErr({}); setStep(2);
  }

  async function handleSignup() {
    const err = {};
    if (!sUser.trim())      err.user = "Pick a username";
    else if (sUser.length < 3) err.user = "At least 3 characters";
    if (!sPass)             err.pass = "Set a password";
    else if (sPass.length < 8) err.pass = "At least 8 characters";
    if (sConf !== sPass)    err.conf = "Passwords don't match";
    if (!agree)             err.agree = "You need to agree to continue";
    if (Object.keys(err).length) { setSErr(err); return; }
    setSLoad(true); setSErr({}); setSMsg("");
    const { flag, country } = COUNTRIES[sCountryIdx];
    try {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sName, email: sEmail, username: sUser, password: sPass, flag, country }),
      });
      const d = await res.json();
      if (!res.ok) setSMsg(d.error || "Username or email already taken");
      else saveSession(d.token, d.user);
    } catch { setSMsg("Can't reach server — is your backend running?"); }
    setSLoad(false);
  }

  const str = pwStrength(sPass);

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100dvh", background: DS.void, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 400, animation: "sp-enter 0.25s ease" }}>

          {/* Brand / logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {/*
              LOGO SLOT — put your logo file at public/logo.svg (or logo.png).
              The img tag hides itself automatically if the file isn't there yet.
              Once you add the file, it shows up here with no code changes needed.
            */}
            <img
              src="/Tranzlelogo.svg" alt="Tranzle"
              onError={e => { e.currentTarget.style.display = "none"; }}
              style={{ height: 64, width: "auto", display: "block", margin: "0 auto 12px" }}
            />
            <div style={{ fontSize: 22, fontWeight: 700, color: DS.plat }}>Tranzle</div>
            <div style={{ fontSize: 13, color: DS.ash, marginTop: 4 }}>call a stranger · play for points</div>
          </div>

          {/* Card */}
          <div style={{ background: DS.surface, border: `1px solid ${DS.rim}`, borderRadius: 12, overflow: "hidden" }}>

            {/* Mode tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${DS.rim}` }}>
              <button className={`ls-tab ${mode === "login"  ? "on" : "off"}`} onClick={() => switchMode("login")}>Sign In</button>
              <button className={`ls-tab ${mode === "signup" ? "on" : "off"}`} onClick={() => switchMode("signup")}>Sign Up</button>
            </div>

            <div style={{ padding: "24px 20px" }}>
              {done ? (
                <Success mode={mode} username={doneUser} onNavigate={onNavigate} />

              ) : mode === "login" ? (
                /* ── LOGIN ── */
                <div>
                  <Field label="Email" type="email" placeholder="you@example.com"
                    value={lEmail} onChange={v => { setLEmail(v); setLErr(e => ({ ...e, email: "" })); }} error={lErr.email} />
                  <Field label="Password" type="password" placeholder="your password"
                    value={lPass} onChange={v => { setLPass(v); setLErr(e => ({ ...e, pass: "" })); }} error={lErr.pass} />
                  <button className="ls-btn" onClick={handleLogin} disabled={lLoad} style={{ marginTop: 4 }}>
                    {lLoad ? <><Spinner />Signing in…</> : "Sign in"}
                  </button>
                  <div style={{ textAlign: "center", fontSize: 13, color: DS.ash, marginTop: 16 }}>
                    No account? <button className="ls-link" onClick={() => switchMode("signup")}>Sign up</button>
                  </div>
                </div>

              ) : (
                /* ── SIGNUP ── */
                <div>
                  {/* Step bar */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
                    {[1, 2].map(s => (
                      <div key={s} style={{ flex: 1, height: 3, borderRadius: 3, background: step >= s ? DS.signal : DS.rim, transition: "background 0.2s" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: DS.ash, fontWeight: 600, marginBottom: 16 }}>Step {step} of 2</div>

                  {sMsg && (
                    <div style={{ background: "rgba(240,40,73,0.1)", border: `1px solid rgba(240,40,73,0.35)`, borderRadius: 8, padding: "10px 13px", fontSize: 13, color: DS.live, marginBottom: 14 }}>
                      {sMsg}
                    </div>
                  )}

                  {step === 1 ? (
                    <>
                      <Field label="Full Name" placeholder="Your name"
                        value={sName} onChange={v => { setSName(v); setSErr(e => ({ ...e, name: "" })); }} error={sErr.name} />
                      <Field label="Email" type="email" placeholder="you@example.com"
                        value={sEmail} onChange={v => { setSEmail(v); setSErr(e => ({ ...e, email: "" })); }} error={sErr.email} />
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: DS.ash, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>Country <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
                        <select className="ls-input" value={sCountryIdx} onChange={e => setSCountryIdx(Number(e.target.value))} style={{ appearance: "none", cursor: "pointer" }}>
                          {COUNTRIES.map((c, i) => <option key={i} value={i}>{c.flag} {c.country || "Prefer not to say"}</option>)}
                        </select>
                      </div>
                      <button className="ls-btn" onClick={handleStep1}>Continue →</button>
                    </>
                  ) : (
                    <>
                      <Field label="Username" placeholder="pick a username"
                        value={sUser} onChange={v => { setSUser(v.toLowerCase().replace(/\s/g, "_")); setSErr(e => ({ ...e, user: "" })); setSMsg(""); }}
                        error={sErr.user} />
                      <Field label="Password" type="password" placeholder="at least 8 characters"
                        value={sPass} onChange={v => { setSPass(v); setSErr(e => ({ ...e, pass: "" })); }} error={sErr.pass}>
                        {str && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i <= str.score ? str.color : DS.rim, transition: "background 0.2s" }} />
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: str.color }}>{str.label}</div>
                          </div>
                        )}
                      </Field>
                      <Field label="Confirm Password" type="password" placeholder="same again"
                        value={sConf} onChange={v => { setSConf(v); setSErr(e => ({ ...e, conf: "" })); }} error={sErr.conf} />

                      {/* Terms */}
                      <div style={{ marginBottom: 18 }}>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                          <div onClick={() => setAgree(a => !a)} style={{
                            width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                            border: `2px solid ${agree ? "var(--sp-signal)" : "var(--sp-rim)"}`,
                            background: agree ? "var(--sp-signal)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, color: "#fff", transition: "all 0.15s",
                          }}>{agree ? "✓" : ""}</div>
                          <span style={{ fontSize: 13, color: DS.ash, lineHeight: 1.5 }}>
                            I agree to the <span style={{ color: DS.signal }}>terms</span> and <span style={{ color: DS.signal }}>privacy policy</span>. I'm at least 13 years old.
                          </span>
                        </label>
                        {sErr.agree && <div style={{ fontSize: 12, color: DS.live, marginTop: 5 }}>{sErr.agree}</div>}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setStep(1); setSMsg(""); }} style={{
                          padding: "13px 14px", background: "transparent",
                          border: `1px solid ${DS.rim}`, borderRadius: 8,
                          color: DS.ash, cursor: "pointer", fontSize: 16,
                        }}>←</button>
                        <button className="ls-btn" style={{ flex: 1 }} onClick={handleSignup} disabled={sLoad}>
                          {sLoad ? <><Spinner />Creating…</> : "Create account"}
                        </button>
                      </div>
                    </>
                  )}

                  <div style={{ textAlign: "center", fontSize: 13, color: DS.ash, marginTop: 16 }}>
                    Already have one? <button className="ls-link" onClick={() => switchMode("login")}>Sign in</button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}