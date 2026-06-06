import { useState, useEffect, useRef } from "react";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0e0e0f;
    color: #f0eeea;
    font-family: 'Syne', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  @keyframes shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
  @keyframes orbFloat {
    0%,100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(-40px) scale(1.06); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 20px rgba(0,245,160,0.3); }
    50%      { box-shadow: 0 0 50px rgba(0,245,160,0.6); }
  }
  @keyframes panelSlide {
    from { opacity: 0; transform: translateX(30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes tickPop {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes lineGrow {
    from { width: 0; opacity: 0; }
    to   { width: 100%; opacity: 1; }
  }
  @keyframes float1 {
    0%,100% { transform: translateY(0) rotate(0deg); }
    50%      { transform: translateY(-18px) rotate(3deg); }
  }
  @keyframes float2 {
    0%,100% { transform: translateY(0) rotate(0deg); }
    50%      { transform: translateY(-24px) rotate(-2deg); }
  }

  .fade-up { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }
  .panel-slide { animation: panelSlide 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  .sp-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 15px 18px;
    color: #f0eeea;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
  }
  .sp-input::placeholder { color: #444; }
  .sp-input:focus {
    border-color: rgba(0,245,160,0.4);
    background: rgba(0,245,160,0.04);
    box-shadow: 0 0 0 3px rgba(0,245,160,0.08);
  }
  .sp-input.error {
    border-color: rgba(255,77,109,0.5);
    box-shadow: 0 0 0 3px rgba(255,77,109,0.08);
  }

  .sp-btn-primary {
    width: 100%;
    background: linear-gradient(135deg, #00f5a0, #00d4ff);
    border: none;
    border-radius: 14px;
    padding: 16px;
    color: #0a0a0a;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 18px;
    letter-spacing: 2px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
    position: relative;
    overflow: hidden;
  }
  .sp-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,245,160,0.35);
  }
  .sp-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .sp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .sp-btn-social {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 13px;
    color: #aaa;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }
  .sp-btn-social:hover {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.15);
    color: #f0eeea;
  }

  .strength-bar {
    height: 3px;
    border-radius: 99px;
    transition: width 0.4s, background 0.4s;
  }

  .tab-toggle {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 5px;
    display: flex;
    gap: 4px;
    margin-bottom: 32px;
  }
  .tab-btn-inner {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 10px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 16px;
    letter-spacing: 2px;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  }
  .tab-btn-inner.active {
    background: linear-gradient(135deg,#00f5a0,#00d4ff);
    color: #0a0a0a;
    box-shadow: 0 4px 16px rgba(0,245,160,0.25);
  }
  .tab-btn-inner.inactive {
    background: transparent;
    color: #555;
  }
  .tab-btn-inner.inactive:hover { color: #aaa; }
`;

/* ── PARTICLE CANVAS ── */
function ParticleField() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    const pts = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      dx: (Math.random() - 0.5) * 0.25, dy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.4 + 0.1,
      c: Math.random() > 0.5 ? "#00f5a0" : "#00d4ff",
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c; ctx.globalAlpha = p.a; ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

/* ── ORB ── */
function Orb({ color, size, top, left, delay = 0 }) {
  return (
    <div style={{
      position: "fixed", top, left, width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 30% 30%, ${color}44, transparent 70%)`,
      filter: "blur(80px)",
      animation: `orbFloat 9s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      zIndex: 0, pointerEvents: "none",
    }} />
  );
}

/* ── SHIMMER TEXT ── */
function Shimmer({ children }) {
  return (
    <span style={{
      background: "linear-gradient(90deg,#00f5a0 0%,#00d4ff 30%,#fff 50%,#00d4ff 70%,#00f5a0 100%)",
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: "shimmer 3s linear infinite",
    }}>{children}</span>
  );
}

/* ── PASSWORD STRENGTH ── */
function pwStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "weak",   color: "#ff4d6d" },
    { label: "weak",   color: "#ff4d6d" },
    { label: "fair",   color: "#ffd60a" },
    { label: "good",   color: "#00d4ff" },
    { label: "strong", color: "#00f5a0" },
  ];
  return { score, ...map[score] };
}

/* ── INPUT FIELD ── */
function Field({ label, type = "text", placeholder, value, onChange, error, hint, extra }) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: "#666", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace" }}>{label}</label>
        {extra}
      </div>
      <div style={{ position: "relative" }}>
        <input
          className={`sp-input${error ? " error" : ""}`}
          type={isPass && show ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ paddingRight: isPass ? 50 : 18 }}
          autoComplete="off"
        />
        {isPass && (
          <button onClick={() => setShow(s => !s)} style={{
            position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "#555", fontSize: 18,
          }}>{show ? "🙈" : "👁"}</button>
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: "#ff4d6d", marginTop: 6, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>}
      {hint && !error && <div style={{ fontSize: 12, color: "#444", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

/* ── DIVIDER ── */
function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{ fontSize: 12, color: "#444", fontFamily: "'JetBrains Mono',monospace" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

/* ── SUCCESS SCREEN ── */
function SuccessScreen({ mode, username }) {
  return (
    <div className="panel-slide" style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: "rgba(0,245,160,0.1)",
        border: "2px solid rgba(0,245,160,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, margin: "0 auto 24px",
        animation: "tickPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>✓</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, letterSpacing: 2, marginBottom: 10 }}>
        <Shimmer>{mode === "signup" ? "YOU'RE IN 🎉" : "WELCOME BACK"}</Shimmer>
      </div>
      <div style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
        {mode === "signup"
          ? `Account created for ${username}. Time to embarrass some strangers.`
          : `Good to see you again, ${username}.`}
      </div>
      <div style={{
        background: "rgba(0,245,160,0.06)",
        border: "1px solid rgba(0,245,160,0.15)",
        borderRadius: 14, padding: "16px 20px",
        fontSize: 13, color: "#666",
        fontFamily: "'JetBrains Mono',monospace",
      }}>
        redirecting to home... <span style={{ color: "#00f5a0" }}>▶</span>
      </div>
    </div>
  );
}

/* ── LEFT PANEL ── */
function LeftPanel() {
  const stats = [
    { v: "14k+", l: "players online" },
    { v: "128",  l: "watching right now" },
    { v: "6",    l: "games to play" },
  ];
  return (
    <div style={{
      flex: 1,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: "60px 50px",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      position: "relative", overflow: "hidden",
      minHeight: "100vh",
    }}>
      <div>
        <div style={{
          fontFamily: "'Bebas Neue',sans-serif",
          fontSize: 26, letterSpacing: 4, color: "#00f5a0", marginBottom: 60,
        }}>STRANGERPLAY</div>

        <div style={{
          fontFamily: "'Bebas Neue',sans-serif",
          fontSize: 58, lineHeight: 1.05, letterSpacing: 1, marginBottom: 20,
        }}>
          <div>CALL A</div>
          <div><Shimmer>STRANGER.</Shimmer></div>
          <div>PLAY.</div>
          <div>WIN.</div>
        </div>

        <div style={{ fontSize: 15, color: "#555", lineHeight: 1.7, maxWidth: 300 }}>
          No followers. No feed. Just two people and a game.
        </div>
      </div>

      {/* floating game preview cards */}
      <div style={{ position: "relative", height: 180, marginBottom: 20 }}>
        <div style={{
          position: "absolute", left: 0, top: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,245,160,0.15)",
          borderRadius: 16, padding: "14px 18px", width: 200,
          animation: "float1 6s ease-in-out infinite",
        }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>😂</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 1.5, color: "#ffd60a" }}>Don't Laugh</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>+15 pts per round</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00f5a0", animation: "glowPulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono',monospace" }}>2,341 playing</span>
          </div>
        </div>

        <div style={{
          position: "absolute", right: 20, top: 40,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,77,109,0.15)",
          borderRadius: 16, padding: "14px 18px", width: 180,
          animation: "float2 7s ease-in-out infinite",
          animationDelay: "1s",
        }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🎤</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 1.5, color: "#ff4d6d" }}>Roast Battle</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>+20 pts per round</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4d6d", animation: "glowPulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono',monospace" }}>1,892 playing</span>
          </div>
        </div>
      </div>

      {/* stats bar */}
      <div style={{
        display: "flex", gap: 28,
        paddingTop: 24,
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        {stats.map(({ v, l }) => (
          <div key={l}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: "#f0eeea" }}>{v}</div>
            <div style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono',monospace" }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── MAIN ── */
export default function LoginSignup() {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  const [lEmail, setLEmail]     = useState("");
  const [lPass,  setLPass]      = useState("");
  const [lLoading, setLLoading] = useState(false);
  const [lErr,   setLErr]       = useState({});

  const [sName,    setSName]    = useState("");
  const [sEmail,   setSEmail]   = useState("");
  const [sUser,    setSUser]    = useState("");
  const [sPass,    setSPass]    = useState("");
  const [sConfirm, setSConfirm] = useState("");
  const [agree,    setAgree]    = useState(false);
  const [sLoading, setSLoading] = useState(false);
  const [sErr,     setSErr]     = useState({});

  const strength = pwStrength(sPass);

  function switchMode(m) {
    setMode(m); setStep(1); setDone(false);
    setLErr({}); setSErr({});
  }

  function handleLogin() {
    const err = {};
    if (!lEmail) err.email = "email is required";
    else if (!lEmail.includes("@")) err.email = "enter a valid email";
    if (!lPass) err.pass = "password is required";
    if (Object.keys(err).length) { setLErr(err); return; }
    setLLoading(true);
    setTimeout(() => { setLLoading(false); setDone(true); }, 1600);
  }

  function handleStep1() {
    const err = {};
    if (!sName)  err.name  = "what's your name?";
    if (!sEmail) err.email = "email is required";
    else if (!sEmail.includes("@")) err.email = "enter a valid email";
    if (Object.keys(err).length) { setSErr(err); return; }
    setSErr({});
    setStep(2);
  }

  function handleSignup() {
    const err = {};
    if (!sUser)  err.user = "pick a username";
    else if (sUser.length < 3) err.user = "at least 3 characters";
    if (!sPass)  err.pass = "set a password";
    else if (sPass.length < 6) err.pass = "at least 6 characters";
    if (sConfirm !== sPass) err.confirm = "passwords don't match";
    if (!agree) err.agree = "you need to agree to continue";
    if (Object.keys(err).length) { setSErr(err); return; }
    setSLoading(true);
    setTimeout(() => { setSLoading(false); setDone(true); }, 1800);
  }

  return (
    <>
      <style>{css}</style>

      {/* bg */}
      <ParticleField />
      <Orb color="#00f5a0" size="500px" top="-100px" left="-100px" />
      <Orb color="#00d4ff" size="400px" top="60%" left="60%" delay={3} />
      <Orb color="#ff4d6d" size="300px" top="80%" left="-80px" delay={5} />

      {/* page layout */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex",
        minHeight: "100vh",
        background: `linear-gradient(to right,
          #141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,
          #1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,
          #262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,
          #303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`,
      }}>

        {/* LEFT — branding */}
        <LeftPanel />

        {/* RIGHT — form — FIX: no fixed height, scrolls with page */}
        <div style={{
          width: 460, flexShrink: 0,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "60px 48px",
          minHeight: "100vh",
        }}>
          <div style={{ width: "100%", maxWidth: 380, paddingBottom: 60 }}>

            {done ? (
              <SuccessScreen mode={mode} username={mode === "login" ? lEmail.split("@")[0] : sUser} />
            ) : (
              <>
                {/* tab toggle */}
                <div className="tab-toggle">
                  {["login", "signup"].map(m => (
                    <button key={m} className={`tab-btn-inner ${mode === m ? "active" : "inactive"}`}
                      onClick={() => switchMode(m)}>
                      {m === "login" ? "SIGN IN" : "SIGN UP"}
                    </button>
                  ))}
                </div>

                {/* ── LOGIN FORM ── */}
                {mode === "login" && (
                  <div className="panel-slide">
                    <div style={{ marginBottom: 28 }}>
                      <div style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11, color: "#444", letterSpacing: 3,
                        textTransform: "uppercase", marginBottom: 8,
                      }}>// welcome back</div>
                      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 2, lineHeight: 1 }}>
                        <Shimmer>SIGN IN</Shimmer>
                      </h2>
                    </div>

                    <Field
                      label="Email" type="email" placeholder="you@example.com"
                      value={lEmail}
                      onChange={v => { setLEmail(v); setLErr(e => ({ ...e, email: "" })); }}
                      error={lErr.email}
                    />
                    <Field
                      label="Password" type="password" placeholder="your password"
                      value={lPass}
                      onChange={v => { setLPass(v); setLErr(e => ({ ...e, pass: "" })); }}
                      error={lErr.pass}
                      extra={
                        <button onClick={() => {}} style={{
                          background: "none", border: "none",
                          fontSize: 12, color: "#00d4ff", cursor: "pointer",
                          fontFamily: "'JetBrains Mono',monospace",
                        }}>forgot?</button>
                      }
                    />

                    <button className="sp-btn-primary" onClick={handleLogin} disabled={lLoading} style={{ marginTop: 8 }}>
                      {lLoading ? (
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                          <span style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "2px solid rgba(0,0,0,0.2)",
                            borderTopColor: "#0a0a0a",
                            animation: "spin 0.7s linear infinite",
                            display: "inline-block",
                          }} />
                          SIGNING IN...
                        </span>
                      ) : "SIGN IN →"}
                    </button>

                    <Divider />

                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="sp-btn-social">
                        <span style={{ fontSize: 18 }}>G</span> Google
                      </button>
                      <button className="sp-btn-social">
                        <span style={{ fontSize: 18 }}>𝕏</span> X
                      </button>
                    </div>

                    <div style={{
                      marginTop: 28, textAlign: "center",
                      fontSize: 13, color: "#444",
                      fontFamily: "'JetBrains Mono',monospace",
                    }}>
                      no account?{" "}
                      <button onClick={() => switchMode("signup")} style={{
                        background: "none", border: "none",
                        color: "#00f5a0", cursor: "pointer",
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 13,
                      }}>sign up →</button>
                    </div>
                  </div>
                )}

                {/* ── SIGNUP FORM ── */}
                {mode === "signup" && (
                  <div className="panel-slide" key={step}>
                    <div style={{ marginBottom: 24 }}>
                      {/* step indicator */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                        {[1, 2].map(s => (
                          <div key={s} style={{
                            height: 3, flex: 1, borderRadius: 99,
                            background: step >= s
                              ? "linear-gradient(90deg,#00f5a0,#00d4ff)"
                              : "rgba(255,255,255,0.08)",
                            transition: "background 0.4s",
                          }} />
                        ))}
                      </div>
                      <div style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11, color: "#444", letterSpacing: 3,
                        textTransform: "uppercase", marginBottom: 8,
                      }}>// step {step} of 2</div>
                      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: 2, lineHeight: 1 }}>
                        <Shimmer>{step === 1 ? "WHO ARE YOU?" : "LOCK IT IN"}</Shimmer>
                      </h2>
                    </div>

                    {/* STEP 1 */}
                    {step === 1 && (
                      <>
                        <Field label="Full Name" placeholder="your real name"
                          value={sName} onChange={v => { setSName(v); setSErr(e => ({ ...e, name: "" })); }}
                          error={sErr.name} />
                        <Field label="Email" type="email" placeholder="you@example.com"
                          value={sEmail} onChange={v => { setSEmail(v); setSErr(e => ({ ...e, email: "" })); }}
                          error={sErr.email} />

                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <button className="sp-btn-social" style={{ flex: 1 }}>
                            <span style={{ fontSize: 18 }}>G</span> Google
                          </button>
                          <button className="sp-btn-social" style={{ flex: 1 }}>
                            <span style={{ fontSize: 18 }}>𝕏</span> X
                          </button>
                        </div>

                        <Divider />

                        <button className="sp-btn-primary" onClick={handleStep1} style={{ marginTop: 4 }}>
                          CONTINUE →
                        </button>
                      </>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                      <>
                        <Field
                          label="Username"
                          placeholder="pick something cool"
                          value={sUser}
                          onChange={v => { setSUser(v.toLowerCase().replace(/\s/g, "_")); setSErr(e => ({ ...e, user: "" })); }}
                          error={sErr.user}
                          hint="this is what strangers will see"
                        />

                        <Field
                          label="Password" type="password" placeholder="make it hard to guess"
                          value={sPass}
                          onChange={v => { setSPass(v); setSErr(e => ({ ...e, pass: "" })); }}
                          error={sErr.pass}
                        />
                        {sPass && (
                          <div style={{ marginTop: -12, marginBottom: 18 }}>
                            <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} className="strength-bar" style={{
                                  flex: 1,
                                  background: i <= strength.score ? strength.color : "rgba(255,255,255,0.06)",
                                }} />
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: strength.color, fontFamily: "'JetBrains Mono',monospace" }}>
                              {strength.label}
                            </div>
                          </div>
                        )}

                        <Field
                          label="Confirm Password" type="password" placeholder="same again"
                          value={sConfirm}
                          onChange={v => { setSConfirm(v); setSErr(e => ({ ...e, confirm: "" })); }}
                          error={sErr.confirm}
                        />

                        {/* agree checkbox */}
                        <div style={{ marginBottom: 22 }}>
                          <div onClick={() => setAgree(a => !a)}
                            style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                              border: `1px solid ${agree ? "#00f5a0" : "rgba(255,255,255,0.12)"}`,
                              background: agree ? "rgba(0,245,160,0.12)" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.2s", fontSize: 12, color: "#00f5a0",
                            }}>{agree ? "✓" : ""}</div>
                            <span style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
                              I agree to the{" "}
                              <span style={{ color: "#00d4ff", cursor: "pointer" }}>terms</span>
                              {" "}and{" "}
                              <span style={{ color: "#00d4ff", cursor: "pointer" }}>privacy policy</span>.
                              I'm at least 18 years old.
                            </span>
                          </div>
                          {sErr.agree && (
                            <div style={{ fontSize: 12, color: "#ff4d6d", marginTop: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                              {sErr.agree}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => setStep(1)} style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 14, padding: "16px 20px",
                            color: "#666", cursor: "pointer", fontSize: 20,
                          }}>←</button>
                          <button className="sp-btn-primary" onClick={handleSignup} disabled={sLoading} style={{ flex: 1 }}>
                            {sLoading ? (
                              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                                <span style={{
                                  width: 18, height: 18, borderRadius: "50%",
                                  border: "2px solid rgba(0,0,0,0.2)",
                                  borderTopColor: "#0a0a0a",
                                  animation: "spin 0.7s linear infinite",
                                  display: "inline-block",
                                }} />
                                CREATING...
                              </span>
                            ) : "CREATE ACCOUNT →"}
                          </button>
                        </div>
                      </>
                    )}

                    <div style={{
                      marginTop: 24, textAlign: "center",
                      fontSize: 13, color: "#444",
                      fontFamily: "'JetBrains Mono',monospace",
                    }}>
                      already have one?{" "}
                      <button onClick={() => switchMode("login")} style={{
                        background: "none", border: "none",
                        color: "#00f5a0", cursor: "pointer",
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 13,
                      }}>sign in →</button>
                    </div>
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
