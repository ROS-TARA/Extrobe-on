import { useState, useEffect, useRef } from "react";
import Profile from "./Profile";
import LoginSignup from "./LoginSignup";
import GameSection from "./GameSection";
import Rewards  from "./Rewards";
import Settings from "./Settings";
// In StrangerPlay_Main.jsx or GameSection.jsx
import GameScreen from "./GameScreen";

// pass props like this:
<GameScreen
  gameMode="dontlaugh"
  opponent={{ name:"stranger_7829", flag:"🇧🇷", avatar:"🧑", pts:3200 }}
  entryFee={10}
  myPoints={74}
  onBack={() => setPage("games")}
/>

/* ─────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 16px; }

  body {
    background: #0e0e0f;
    color: #f0eeea;
    font-family: 'Syne', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
    -webkit-tap-highlight-color: transparent;
  }

  @keyframes shimmer        { to { background-position: 200% center; } }
  @keyframes orbFloat       { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-30px) scale(1.05)} }
  @keyframes fadeSlideUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spinRing       { to{transform:rotate(360deg)} }
  @keyframes pulse          { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
  @keyframes floatUp        { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-120px)} }
  @keyframes scanline       { 0%{top:0%} 100%{top:100%} }
  @keyframes glowPulse      { 0%,100%{box-shadow:0 0 20px #00f5a044} 50%{box-shadow:0 0 50px #00f5a099} }
  @keyframes borderGlow     { 0%,100%{border-color:rgba(0,245,160,0.25)} 50%{border-color:rgba(0,212,255,0.4)} }
  @keyframes menuSlide      { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

  ::-webkit-scrollbar       { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  /* Responsive helpers */
  .hide-mobile  { display: flex; }
  .show-mobile  { display: none; }

  @media (max-width: 768px) {
    .hide-mobile { display: none !important; }
    .show-mobile { display: flex !important; }

    .hero-title  { font-size: clamp(52px, 16vw, 100px) !important; }
    .stats-row   { flex-wrap: wrap; gap: 20px !important; }
    .games-grid  { grid-template-columns: 1fr !important; }
    .call-grid   { grid-template-columns: 1fr !important; }
    .lb-grid     { grid-template-columns: 40px 1fr 70px !important; }
    .lb-wins-col { display: none !important; }
    .ctrl-bar    { flex-wrap: wrap; gap: 10px !important; padding: 14px !important; }
    .sidebar     { flex-direction: row !important; }
    .sidebar > * { flex: 1; min-width: 0; }
    .nav-pad     { padding: 0 16px !important; }
    .section-pad { padding: 40px 16px 100px !important; }
    .hero-pad    { padding: 100px 20px 60px !important; }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .games-grid  { grid-template-columns: repeat(2,1fr) !important; }
    .call-grid   { grid-template-columns: 1fr 260px !important; }
  }
`;

const BG = `linear-gradient(to right,
  #141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,
  #1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,
  #262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,
  #303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

/* ─────────────────────────────────────────────
   PARTICLE FIELD
───────────────────────────────────────────── */
function ParticleField() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    // fewer particles on mobile
    const count = window.innerWidth < 768 ? 50 : 100;
    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      dx: (Math.random() - 0.5) * 0.25, dy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.3 + 0.3, a: Math.random() * 0.5 + 0.1,
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
      if (window.innerWidth >= 768) {
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80) {
              ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
              ctx.strokeStyle = `rgba(0,245,160,${0.07 * (1 - dist / 80)})`; ctx.lineWidth = 0.5; ctx.stroke();
            }
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

/* ─────────────────────────────────────────────
   SHARED UI ATOMS
───────────────────────────────────────────── */
function Orb({ color, size, top, left, delay = 0 }) {
  return (
    <div style={{
      position: "fixed", top, left, width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle at 30% 30%, ${color}33, transparent 70%)`,
      filter: "blur(60px)", animation: `orbFloat 9s ease-in-out infinite`,
      animationDelay: `${delay}s`, zIndex: 0, pointerEvents: "none",
    }} />
  );
}

function ShimmerText({ children }) {
  return (
    <span style={{
      background: "linear-gradient(90deg,#00f5a0 0%,#00d4ff 30%,#fff 50%,#00d4ff 70%,#00f5a0 100%)",
      backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      animation: "shimmer 3s linear infinite",
    }}>{children}</span>
  );
}

/* ─────────────────────────────────────────────
   LIVE COUNTER
───────────────────────────────────────────── */
function LiveCounter({ label, value, color = "#f0eeea" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let n = 0;
    const target = parseInt(value.replace(/,/g, ""));
    const step = Math.ceil(target / 50);
    const t = setInterval(() => { n = Math.min(n + step, target); setDisplay(n); if (n >= target) clearInterval(t); }, 25);
    return () => clearInterval(t);
  }, [value]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "clamp(18px,3vw,26px)", fontWeight: 700, color, textShadow: `0 0 16px ${color}66` }}>{display.toLocaleString()}</span>
      <span style={{ fontSize: 11, color: "#555", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   GAME CARD
───────────────────────────────────────────── */
function GameCard({ emoji, title, desc, pts, color, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      background: hov ? `linear-gradient(135deg,${color}18,${color}08)` : "rgba(255,255,255,0.03)",
      border: `1px solid ${hov ? color + "55" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 20, padding: "24px 20px", cursor: "pointer",
      transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      transform: hov ? "translateY(-6px) scale(1.02)" : "none",
      boxShadow: hov ? `0 16px 48px ${color}22` : "none",
      animation: "fadeSlideUp 0.6s both", animationDelay: `${delay}s`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>{emoji}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(18px,2.5vw,22px)", letterSpacing: 2, color: hov ? color : "#f0eeea", marginBottom: 8, transition: "color 0.3s" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 14 }}>{desc}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#ffd60a", background: "rgba(255,214,10,0.08)", border: "1px solid rgba(255,214,10,0.15)", borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>+{pts} pts</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LEADERBOARD ROW
───────────────────────────────────────────── */
function LBRow({ rank, name, country, flag, pts, wins, isMe, delay }) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return (
    <div className="lb-grid" style={{
      display: "grid", gridTemplateColumns: "56px 1fr 100px 80px",
      alignItems: "center", padding: "13px 20px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      background: isMe ? "rgba(0,245,160,0.04)" : "transparent",
      borderLeft: isMe ? "2px solid #00f5a0" : "2px solid transparent",
      animation: "fadeSlideUp 0.5s both", animationDelay: `${delay}s`,
      transition: "background 0.15s", cursor: "pointer",
    }}
      onMouseEnter={e => e.currentTarget.style.background = isMe ? "rgba(0,245,160,0.07)" : "rgba(255,255,255,0.03)"}
      onMouseLeave={e => e.currentTarget.style.background = isMe ? "rgba(0,245,160,0.04)" : "transparent"}
    >
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: rank <= 3 ? 18 : 13, color: rank === 1 ? "#ffd60a" : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : "#555" }}>{medals[rank] || rank}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: isMe ? "rgba(0,245,160,0.12)" : "rgba(255,255,255,0.05)", border: isMe ? "1px solid rgba(0,245,160,0.25)" : "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {isMe ? "⭐" : ["😎","🦊","🌶️","🐉"][rank - 1] || "👤"}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: isMe ? "#00f5a0" : "#f0eeea" }}>{name}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{flag} {country}</div>
        </div>
      </div>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: "#ffd60a" }}>{pts.toLocaleString()}</span>
      <span className="lb-wins-col" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#555" }}>{wins}W</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   WEBRTC VIDEO CALL HOOK
───────────────────────────────────────────── */
function useWebRTC() {
  const localRef  = useRef(null);
  const [stream,  setStream]  = useState(null);
  const [camErr,  setCamErr]  = useState(null);
  const [muted,   setMuted]   = useState(false);
  const [camOff,  setCamOff]  = useState(false);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      setStream(s);
      if (localRef.current) { localRef.current.srcObject = s; localRef.current.play().catch(() => {}); }
      setCamErr(null);
    } catch (e) {
      setCamErr(e.name === "NotAllowedError"
        ? "Camera permission denied. Allow access in your browser settings."
        : "Could not access camera: " + e.message);
    }
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  }

  function toggleMute() {
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }

  function toggleCam() {
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  }

  // attach stream whenever localRef becomes available
  useEffect(() => {
    if (stream && localRef.current) { localRef.current.srcObject = stream; localRef.current.play().catch(() => {}); }
  }, [stream]);

  return { localRef, stream, camErr, muted, camOff, startCamera, stopCamera, toggleMute, toggleCam };
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function StrangerPlay() {
  const [page,       setPage]       = useState("home");
  const [matchState, setMatchState] = useState("idle");
  const [gameTimer,  setGameTimer]  = useState(30);
  const [points,     setPoints]     = useState(74);
  const [reactions,  setReactions]  = useState([]);
  const [menuOpen,   setMenuOpen]   = useState(false);

  const timerRef = useRef(null);
  const webrtc = useWebRTC();

  // game countdown
  useEffect(() => {
    if (matchState === "found") {
      timerRef.current = setInterval(() => {
        setGameTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [matchState]);

  // start camera when entering play page
  useEffect(() => {
    if (page === "play") webrtc.startCamera();
    else webrtc.stopCamera();
  }, [page]);

  const addReaction = (e) => {
    const id = Date.now();
    setReactions(r => [...r, { id, emoji: e, x: Math.random() * 80 + 10 }]);
    setTimeout(() => setReactions(r => r.filter(rx => rx.id !== id)), 2000);
    setPoints(p => p + 1);
  };

  const goTo = (p) => { setPage(p); setMenuOpen(false); };

  /* ── NAV LINKS ── */
  const navLinks = ["Home","Games","Ranks","Rewards"];

  return (
    <div style={{ minHeight: "100vh", background: BG, backgroundAttachment: "fixed", color: "#f0eeea", fontFamily: "'Syne',sans-serif", overflowX: "hidden" }}>
      <style>{GLOBAL_CSS}</style>

      <ParticleField />
      <Orb color="#00f5a0" size="500px" top="-150px" left="-80px" />
      <Orb color="#00d4ff" size="400px" top="35%" left="65%" delay={3} />
      <Orb color="#ff4d6d" size="350px" top="70%" left="5%"  delay={5} />

      {/* ══════════════════════════════
          TOP NAV
      ══════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, background: "rgba(14,14,15,0.85)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 clamp(16px,4vw,48px)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flexShrink: 0 }} onClick={() => goTo("home")}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#00f5a0,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, animation: "glowPulse 3s infinite" }}>▶</div>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3, background: "linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>StrangerPlay</span>
        </div>

        {/* Desktop links */}
        <div className="hide-mobile" style={{ gap: 32 }}>
          {navLinks.map(l => (
            <span key={l} onClick={() => goTo(l.toLowerCase())} style={{ fontSize: 14, fontWeight: 500, color: page === l.toLowerCase() ? "#00f5a0" : "#555", cursor: "pointer", transition: "color 0.2s", letterSpacing: 0.4 }}>{l}</span>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hide-mobile" style={{ alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.18)", borderRadius: 20, padding: "4px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#ff4d6d" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d6d", animation: "pulse 1.5s infinite" }} /> LIVE 2,847
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,214,10,0.07)", border: "1px solid rgba(255,214,10,0.14)", borderRadius: 20, padding: "4px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#ffd60a" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ffd60a", animation: "pulse 2s infinite" }} /> {points} pts
          </div>
          <button onClick={() => goTo("login")} style={{ background: "rgba(255,255,255,0.04)", color: "#ccc", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "8px 18px", fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Login</button>
          <button onClick={() => goTo("play")} style={{ background: "linear-gradient(135deg,#00f5a0,#00d4ff)", color: "#0a0a0a", border: "none", borderRadius: 9, padding: "8px 20px", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 0 20px rgba(0,245,160,0.3)" }}>Play Now</button>
        </div>

        {/* Mobile right */}
        <div className="show-mobile" style={{ alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#ffd60a", background: "rgba(255,214,10,0.07)", border: "1px solid rgba(255,214,10,0.14)", borderRadius: 20, padding: "4px 10px" }}>{points}pts</div>
          <button onClick={() => setMenuOpen(m => !m)} style={{ background: "none", border: "none", color: "#f0eeea", fontSize: 22, cursor: "pointer", padding: 4 }}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 64, left: 0, right: 0, zIndex: 299,
          background: "rgba(14,14,15,0.97)", backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 20px 24px", animation: "menuSlide 0.25s both",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {navLinks.map(l => (
            <button key={l} onClick={() => goTo(l.toLowerCase())} style={{
              background: page === l.toLowerCase() ? "rgba(0,245,160,0.06)" : "none",
              border: "none", borderRadius: 10, padding: "13px 16px",
              color: page === l.toLowerCase() ? "#00f5a0" : "#aaa",
              fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 15,
              cursor: "pointer", textAlign: "left",
            }}>{l}</button>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
          {[["🎁","Rewards","rewards"],["⚙️","Settings","settings"],["👤","Profile","profile"]].map(([icon,label,id]) => (
            <button key={id} onClick={() => goTo(id)} style={{
              background: page === id ? "rgba(0,245,160,0.06)" : "none",
              border: "none", borderRadius: 10, padding: "13px 16px",
              color: page === id ? "#00f5a0" : "#aaa",
              fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 15,
              cursor: "pointer", textAlign: "left",
            }}>{icon} {label}</button>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
          <button onClick={() => goTo("login")} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "12px 16px", color: "#ccc", fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Login / Sign up</button>
          <button onClick={() => goTo("play")} style={{ background: "linear-gradient(135deg,#00f5a0,#00d4ff)", border: "none", borderRadius: 10, padding: "13px 16px", color: "#0a0a0a", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}>▶ Play Now</button>
        </div>
      )}

      {/* ══════════════════════════════
          HOME
      ══════════════════════════════ */}
      {page === "home" && (
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Hero */}
          <section className="hero-pad" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 40px 80px" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#444", letterSpacing: 4, marginBottom: 24, animation: "fadeSlideUp 0.6s 0.2s both", display: "flex", alignItems: "center", gap: 12 }}>
              <span>◆</span> video calls that actually go somewhere <span>◆</span>
            </div>

            <h1 className="hero-title" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(64px,12vw,150px)", lineHeight: 0.9, letterSpacing: 3, animation: "fadeSlideUp 0.7s 0.4s both", marginBottom: 28 }}>
              CALL A<br /><ShimmerText>STRANGER</ShimmerText><br />PLAY. WIN.
            </h1>

            <p style={{ fontSize: "clamp(14px,2vw,17px)", color: "#4a4a50", maxWidth: 440, lineHeight: 1.85, animation: "fadeSlideUp 0.6s 0.6s both", marginBottom: 44 }}>
              Random video. Live games. Real points you can spend.<br />No followers. No feed. Just two people and a game.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", animation: "fadeSlideUp 0.6s 0.8s both" }}>
              <button onClick={() => goTo("play")} style={{ background: "linear-gradient(135deg,#00f5a0,#00d4ff)", color: "#0a0a0a", border: "none", borderRadius: 12, padding: "clamp(12px,2vw,18px) clamp(24px,4vw,44px)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(16px,2.5vw,20px)", letterSpacing: 2, cursor: "pointer", boxShadow: "0 0 40px rgba(0,245,160,0.4)", animation: "glowPulse 3s infinite" }}>▶ START PLAYING</button>
              <button style={{ background: "transparent", color: "#f0eeea", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "clamp(12px,2vw,18px) clamp(24px,4vw,44px)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(16px,2.5vw,20px)", letterSpacing: 2, cursor: "pointer" }}>WATCH LIVE</button>
            </div>

            <div className="stats-row" style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 64, animation: "fadeSlideUp 0.6s 1s both", flexWrap: "wrap", justifyContent: "center" }}>
              <LiveCounter label="Online Now"   value="2847"   color="#00f5a0" />
              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.07)" }} />
              <LiveCounter label="Games Played" value="148920" color="#00d4ff" />
              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.07)" }} />
              <LiveCounter label="Countries"    value="94"     color="#ffd60a" />
              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.07)" }} />
              <LiveCounter label="Points Given" value="982400" color="#ff4d6d" />
            </div>
          </section>

          {/* Games grid */}
          <section className="section-pad" style={{ padding: "40px clamp(16px,5vw,60px) 100px", position: "relative", zIndex: 1 }}>
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#444", letterSpacing: 4, marginBottom: 10, textTransform: "uppercase" }}>// six ways to embarrass a stranger</div>
              <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(36px,6vw,56px)", letterSpacing: 2 }}>PICK A <ShimmerText>GAME</ShimmerText></h2>
            </div>
            <div className="games-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {[
                { emoji: "😐", title: "DON'T LAUGH",     desc: "Keep a straight face while your stranger loses it.", pts: 10, color: "#00f5a0", delay: 0    },
                { emoji: "🪞", title: "MIRROR ME",       desc: "Copy expressions and poses. AI scores your match.", pts: 8,  color: "#00d4ff", delay: 0.08 },
                { emoji: "🎭", title: "VIBE CHECK",      desc: "Be a grandma, robot, or demon. Crowd votes.",       pts: 12, color: "#ff4d6d", delay: 0.16 },
                { emoji: "🌶️", title: "HOT TAKE",       desc: "Wild opinions. React in 5 seconds. Crowd judges.",  pts: 6,  color: "#ffd60a", delay: 0.24 },
                { emoji: "📖", title: "FINISH MY STORY", desc: "One starts a story. Other must end it live.",       pts: 15, color: "#a064ff", delay: 0.32 },
                { emoji: "🔥", title: "SPEED ROAST",     desc: "30 seconds. Two strangers. Crowd picks the winner.",pts: 20, color: "#ff9f43", delay: 0.40 },
              ].map(g => <GameCard key={g.title} {...g} />)}
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════
          PLAY
      ══════════════════════════════ */}
      {page === "play" && (
        <div style={{ position: "relative", zIndex: 1, paddingTop: 64, minHeight: "100vh" }}>

          {/* ── IDLE ── */}
          {matchState === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", gap: 28, padding: "40px 20px" }}>
              <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(40px,8vw,64px)", letterSpacing: 3, textAlign: "center" }}>READY TO <ShimmerText>PLAY?</ShimmerText></h1>
              <p style={{ color: "#555", fontSize: 14 }}>2,847 strangers waiting</p>

              {/* Camera preview before match */}
              {webrtc.stream && (
                <div style={{ width: "min(260px,70vw)", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", border: "2px solid rgba(0,245,160,0.3)", background: "#0a0a0b", boxShadow: "0 0 30px rgba(0,245,160,0.15)" }}>
                  <video ref={webrtc.localRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                </div>
              )}
              {webrtc.camErr && (
                <div style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)", borderRadius: 12, padding: "12px 20px", fontSize: 13, color: "#ff4d6d", maxWidth: 340, textAlign: "center" }}>{webrtc.camErr}</div>
              )}

              <button onClick={() => setMatchState("searching")} style={{ width: "clamp(130px,35vw,160px)", height: "clamp(130px,35vw,160px)", borderRadius: "50%", background: "linear-gradient(135deg,#00f5a0,#00d4ff)", border: "none", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(16px,3.5vw,20px)", letterSpacing: 2, color: "#0a0a0a", boxShadow: "0 0 60px rgba(0,245,160,0.5)", animation: "glowPulse 2s infinite" }}>
                FIND A<br />STRANGER
              </button>
            </div>
          )}

          {/* ── SEARCHING ── */}
          {matchState === "searching" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", gap: 24, padding: "40px 20px" }}>
              <div style={{ position: "relative", width: 180, height: 180 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#00f5a0", borderRightColor: "#00d4ff", animation: "spinRing 1s linear infinite" }} />
                <div style={{ position: "absolute", inset: 14, borderRadius: "50%", border: "1px solid transparent", borderTopColor: "#ff4d6d", animation: "spinRing 1.5s linear infinite reverse" }} />
                <div style={{ position: "absolute", inset: 28, borderRadius: "50%", background: "rgba(0,245,160,0.04)", border: "1px solid rgba(0,245,160,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#00f5a0", letterSpacing: 1 }}>SCAN</div>
              </div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(28px,5vw,40px)", letterSpacing: 3, textAlign: "center" }}>FINDING YOUR <ShimmerText>MATCH</ShimmerText></div>
              <p style={{ color: "#555", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>scanning 2,847 players...</p>
              <button onClick={() => { setMatchState("found"); setGameTimer(30); }} style={{ background: "rgba(0,245,160,0.08)", border: "1px solid rgba(0,245,160,0.18)", color: "#00f5a0", borderRadius: 10, padding: "10px 24px", fontFamily: "'Syne',sans-serif", fontSize: 13, cursor: "pointer" }}>Simulate Match →</button>
            </div>
          )}

          {/* ── IN CALL ── */}
          {matchState === "found" && (
            <div style={{ padding: "clamp(8px,2vw,16px) clamp(8px,2vw,20px) 100px", maxWidth: 1360, margin: "0 auto" }}>
              <div className="call-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12, marginBottom: 12 }}>

                {/* VIDEO */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ position: "relative", aspectRatio: "16/9", background: "#0a0a0b", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", animation: "borderGlow 4s infinite" }}>

                    {/* Scanline */}
                    <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(0,245,160,0.25),transparent)", animation: "scanline 3s linear infinite", zIndex: 3, pointerEvents: "none" }} />

                    {/* Stranger video (placeholder — in prod this is remoteStream) */}
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 40% 40%,rgba(0,245,160,0.03),transparent 60%)" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px" }}>🧑</div>
                        <div style={{ color: "#00f5a0", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>stranger_7829 🇧🇷</div>
                        <div style={{ color: "#444", fontSize: 11, marginTop: 4 }}>waiting for WebRTC peer...</div>
                      </div>
                    </div>

                    {/* Game info overlay */}
                    <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, zIndex: 4 }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#00f5a0", letterSpacing: 2 }}>😐 DON'T LAUGH</span>
                      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: gameTimer < 10 ? "#ff4d6d" : "#f0eeea", textShadow: gameTimer < 10 ? "0 0 16px #ff4d6d" : "none", transition: "color 0.3s" }}>0:{String(gameTimer).padStart(2, "0")}</span>
                    </div>

                    {/* Points badge */}
                    <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,214,10,0.09)", border: "1px solid rgba(255,214,10,0.18)", borderRadius: 8, padding: "6px 12px", zIndex: 4, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#ffd60a" }}>+10 pts</div>

                    {/* Self cam — real video */}
                    <div style={{ position: "absolute", bottom: 12, right: 12, width: "clamp(80px,16%,130px)", aspectRatio: "3/4", background: "#1a1a1c", borderRadius: 10, border: "2px solid #00f5a0", boxShadow: "0 0 16px rgba(0,245,160,0.2)", overflow: "hidden", zIndex: 4 }}>
                      {webrtc.stream && !webrtc.camOff
                        ? <video ref={webrtc.localRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 22 }}>📷</div>
                      }
                    </div>

                    {/* Floating reactions */}
                    {reactions.map(r => (
                      <div key={r.id} style={{ position: "absolute", bottom: "28%", left: `${r.x}%`, fontSize: 26, animation: "floatUp 2s forwards", zIndex: 5, pointerEvents: "none" }}>{r.emoji}</div>
                    ))}
                  </div>

                  {/* Controls */}
                  <div className="ctrl-bar" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 20px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14 }}>
                    <button onClick={webrtc.toggleMute} style={{ width: 48, height: 48, borderRadius: "50%", background: webrtc.muted ? "rgba(255,77,109,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${webrtc.muted ? "rgba(255,77,109,0.3)" : "rgba(255,255,255,0.08)"}`, color: "#f0eeea", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} title={webrtc.muted ? "Unmute" : "Mute"}>
                      {webrtc.muted ? "🔇" : "🎤"}
                    </button>
                    <button onClick={webrtc.toggleCam} style={{ width: 48, height: 48, borderRadius: "50%", background: webrtc.camOff ? "rgba(255,77,109,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${webrtc.camOff ? "rgba(255,77,109,0.3)" : "rgba(255,255,255,0.08)"}`, color: "#f0eeea", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} title={webrtc.camOff ? "Turn on cam" : "Turn off cam"}>
                      {webrtc.camOff ? "🚫" : "📷"}
                    </button>
                    <button style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#f0eeea", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✨</button>
                    <button onClick={() => { webrtc.stopCamera(); setMatchState("idle"); }} style={{ width: 56, height: 56, borderRadius: "50%", background: "#ff4d6d", border: "none", fontSize: 20, cursor: "pointer", boxShadow: "0 0 20px rgba(255,77,109,0.45)" }}>📵</button>
                    <button style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#f0eeea", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🚩</button>
                    <button onClick={() => { setMatchState("searching"); setTimeout(() => { setMatchState("found"); setGameTimer(30); }, 1200); }} style={{ background: "linear-gradient(135deg,#00f5a0,#00d4ff)", border: "none", borderRadius: 10, color: "#0a0a0a", fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(13px,2vw,16px)", letterSpacing: 1.5, padding: "0 20px", height: 48, cursor: "pointer", boxShadow: "0 0 16px rgba(0,245,160,0.3)", whiteSpace: "nowrap" }}>NEXT →</button>
                  </div>
                </div>

                {/* SIDEBAR */}
                <div className="sidebar" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Points */}
                  <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Points</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 12 }}>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(40px,6vw,52px)", color: "#ffd60a", textShadow: "0 0 24px rgba(255,214,10,0.35)", lineHeight: 1 }}>{points}</span>
                      <span style={{ color: "#444", fontSize: 12 }}>/ 100</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: `${points}%`, background: "linear-gradient(90deg,#ffd60a,#ff9f43)", borderRadius: 4, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#555" }}><span style={{ color: "#ffd60a" }}>{100 - points} pts</span> to reward 🎁</div>
                  </div>

                  {/* Crowd */}
                  <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>👀 Watching (128)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                      {[["🧑","alex_k","🇺🇸","#00f5a0"],["👩","priya_s","🇮🇳","#00d4ff"],["🧔","marco_r","🇧🇷","#ff4d6d"],["👦","raj_np","🇳🇵","#ffd60a"]].map(([av,n,f,c]) => (
                        <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${c}12`, border: `1px solid ${c}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{av}</div>
                          <span style={{ fontSize: 12, flex: 1 }}>{n}</span>
                          <span style={{ fontSize: 13 }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginBottom: 12 }}>+ 124 more</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      {["😂","🔥","😮","👏","💀"].map(e => (
                        <button key={e} onClick={() => addReaction(e)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, padding: "7px 8px", fontSize: 16, cursor: "pointer", transition: "transform 0.15s" }}
                          onMouseEnter={ev => ev.currentTarget.style.transform = "scale(1.25)"}
                          onMouseLeave={ev => ev.currentTarget.style.transform = "scale(1)"}
                        >{e}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════
          LEADERBOARD
      ══════════════════════════════ */}
      {page === "ranks" && (
        <div style={{ position: "relative", zIndex: 1, padding: "clamp(80px,12vw,100px) clamp(16px,5vw,60px) 120px", maxWidth: 860, margin: "0 auto" }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#444", letterSpacing: 4, marginBottom: 10, textTransform: "uppercase" }}>// who's winning rn</div>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(36px,7vw,56px)", letterSpacing: 2 }}><ShimmerText>LEADERBOARD</ShimmerText></h2>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden" }}>
            <div className="lb-grid" style={{ display: "grid", gridTemplateColumns: "56px 1fr 100px 80px", padding: "11px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "#333", letterSpacing: 2, textTransform: "uppercase" }}>
              <span></span><span>Player</span><span>Points</span><span className="lb-wins-col">Wins</span>
            </div>
            {[
              { rank:1, name:"shadow_x",  country:"USA",    flag:"🇺🇸", pts:9840, wins:312 },
              { rank:2, name:"foxgirl99", country:"Korea",  flag:"🇰🇷", pts:8210, wins:287 },
              { rank:3, name:"hotboi_br", country:"Brazil", flag:"🇧🇷", pts:7550, wins:241 },
              { rank:4, name:"dragonz",   country:"China",  flag:"🇨🇳", pts:6890, wins:198 },
              { rank:5, name:"nite_owl",  country:"UK",     flag:"🇬🇧", pts:5920, wins:167 },
              { rank:42,name:"you (raj_np)",country:"Nepal",flag:"🇳🇵", pts:points, wins:3, isMe:true },
            ].map((r,i) => <LBRow key={r.rank} {...r} delay={i*0.07} />)}
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          OTHER PAGES
      ══════════════════════════════ */}
      {page === "login"      && <LoginSignup onNavigate={goTo} />}
      {page === "profile"    && <Profile    onNavigate={goTo} />}
      {page === "rewards"    && <Rewards    onNavigate={goTo} />}
      {page === "settings"   && <Settings   onNavigate={goTo} />}

      {/* GameSection = Floppy Face Race — triggered from Games nav */}
      {page === "games"      && <GameSection onBack={() => goTo("home")} myPoints={74} />}

      {/* GameScreen = live in-match UI — triggered after matchmaking */}
      {page === "gamescreen" && (
        <GameScreen
          game="dont_laugh"
          onBack={() => goTo("play")}
          myName="raj_np"
          myFlag="🇳🇵"
          myPoints={74}
          oppName="stranger_7829"
          oppFlag="🇧🇷"
          pointsWagered={3}
        />
      )}

      {/* ══════════════════════════════
          BOTTOM NAV
      ══════════════════════════════ */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "10px 8px max(16px, env(safe-area-inset-bottom))",
        background: "rgba(14,14,15,0.92)", backdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        {[["🏠","Home","home"],["🎮","Games","games"],null,["🏆","Ranks","ranks"],["👤","Profile","profile"]].map((item,i) => {
          if (!item) return (
            <button key="fab" onClick={() => goTo("play")} style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#00f5a0,#00d4ff)", border: "none", fontSize: 22, cursor: "pointer", boxShadow: "0 0 28px rgba(0,245,160,0.45)", marginTop: -22, animation: "glowPulse 3s infinite", flexShrink: 0 }}>▶</button>
          );
          const [icon, label, id] = item;
          const active = page === id;
          return (
            <div key={id} onClick={() => goTo(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", color: active ? "#00f5a0" : "#444", fontSize: 10, fontWeight: 600, padding: "6px 12px", borderRadius: 10, background: active ? "rgba(0,245,160,0.06)" : "transparent", transition: "all 0.2s", minWidth: 44 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              {label}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
