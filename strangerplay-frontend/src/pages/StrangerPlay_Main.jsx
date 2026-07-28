import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import Profile from "./Profile";
import LoginSignup from "./LoginSignup";
import Rewards from "./Rewards";
import Settings from "./Settings";
import GameScreen from "./GameScreen";

/* ─────────────────────────────────────────────────────────────
   DESIGN SYSTEM — StrangerPlay
   Simple. One accent. Two surfaces. No gradients. No glow.
   Dark and light mode via CSS variables on <html data-theme>.
   ─────────────────────────────────────────────────────────────
   HOW THEME WORKS:
   - applyTheme("dark"|"light") sets document.documentElement.dataset.theme
   - Every DS.xxx is a var(--sp-xxx) reference
   - Browser resolves the variable — all components repaint for free
   - Settings.jsx calls window.applyTheme() to toggle
───────────────────────────────────────────────────────────── */

const DS = {
  void:    "var(--sp-void)",
  surface: "var(--sp-surface)",
  surface2:"var(--sp-surface2)",
  rim:     "var(--sp-rim)",
  plat:    "var(--sp-plat)",
  ash:     "var(--sp-ash)",
  ghost:   "var(--sp-ghost)",
  signal:  "var(--sp-signal)",
  live:    "var(--sp-live)",
  ice:     "var(--sp-ice)",
  gold:    "var(--sp-gold)",
};

// Expose globally so Settings.jsx can call it without importing
window.applyTheme = function(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("sp_theme", theme);
};

// Apply saved theme immediately on load (before first render)
window.applyTheme(localStorage.getItem("sp_theme") || "dark");

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ── CSS VARIABLES ─────────────────────────────── */
  :root, html[data-theme="dark"] {
    --sp-void:    #18191a;
    --sp-surface: #242526;
    --sp-surface2:#3a3b3c;
    --sp-rim:     #3e4042;
    --sp-plat:    #e4e6eb;
    --sp-ash:     #b0b3b8;
    --sp-ghost:   #6a6b6c;
    --sp-signal:  #2374e1;
    --sp-live:    #f02849;
    --sp-ice:     #45bd62;
    --sp-gold:    #f7b928;
  }
  html[data-theme="light"] {
    --sp-void:    #f0f2f5;
    --sp-surface: #ffffff;
    --sp-surface2:#f7f8fa;
    --sp-rim:     #dadde1;
    --sp-plat:    #050505;
    --sp-ash:     #65676b;
    --sp-ghost:   #bcc0c4;
    --sp-signal:  #1877f2;
    --sp-live:    #e41e3f;
    --sp-ice:     #31a24c;
    --sp-gold:    #e8a400;
  }

  /* ── RESET ───────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; }
  body {
    background: var(--sp-void);
    color: var(--sp-plat);
    font-family: 'Inter', sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.2s, color 0.2s;
  }
  ::-webkit-scrollbar       { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--sp-rim); border-radius: 4px; }

  /* ── ONLY TWO ANIMATIONS — live dot pulse + page enter ── */
  @keyframes sp-live   { 0%,100%{opacity:1} 50%{opacity:0.25} }
  @keyframes sp-enter  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sp-spin   { to{transform:rotate(360deg)} }
  @keyframes sp-ticker { from{transform:translateX(100%)} to{transform:translateX(-100%)} }

  .sp-page { animation: sp-enter 0.25s ease both; }

  /* ── BUTTONS ────────────────────────────────── */
  .sp-btn-primary {
    background: var(--sp-signal);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: filter 0.15s;
  }
  .sp-btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
  .sp-btn-primary:active:not(:disabled) { filter: brightness(0.95); }
  .sp-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .sp-btn-ghost {
    background: transparent;
    color: var(--sp-ash);
    border: 1px solid var(--sp-rim);
    border-radius: 8px;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .sp-btn-ghost:hover { background: var(--sp-surface2); color: var(--sp-plat); border-color: var(--sp-rim); }

  /* ── INPUT ────────────────────────────────── */
  .sp-input {
    background: var(--sp-surface2);
    border: 1.5px solid var(--sp-rim);
    border-radius: 8px;
    padding: 11px 14px;
    color: var(--sp-plat);
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    outline: none;
    width: 100%;
    transition: border-color 0.15s;
  }
  .sp-input:focus       { border-color: var(--sp-signal); }
  .sp-input::placeholder { color: var(--sp-ghost); }
  .sp-input.err          { border-color: var(--sp-live); }
  select.sp-input { cursor: pointer; appearance: none; }
  select.sp-input option { background: var(--sp-surface2); color: var(--sp-plat); }

  /* ── CARD ────────────────────────────────── */
  .sp-card {
    background: var(--sp-surface);
    border: 1px solid var(--sp-rim);
    border-radius: 12px;
    transition: box-shadow 0.15s;
  }
  .sp-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.18); }

  /* ── LIVE BADGE ──────────────────────────── */
  .sp-live-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--sp-live);
    border-radius: 4px;
    padding: 2px 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 700;
    color: #fff; letter-spacing: 1px;
    text-transform: uppercase;
  }
  .sp-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #fff;
    animation: sp-live 1.4s infinite;
    flex-shrink: 0;
  }

  /* ── TAG ─────────────────────────────────── */
  .sp-tag {
    display: inline-block;
    background: var(--sp-surface2);
    border: 1px solid var(--sp-rim);
    border-radius: 6px;
    padding: 2px 9px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; color: var(--sp-ash);
  }

  /* ── TAB RAIL ────────────────────────────── */
  .sp-mode-rail {
    display: inline-flex;
    background: var(--sp-surface2);
    border: 1px solid var(--sp-rim);
    border-radius: 10px;
    padding: 3px; gap: 2px;
  }
  .sp-mode-btn {
    border-radius: 8px; border: none;
    font-family: 'Inter', sans-serif;
    font-weight: 600; font-size: 14px;
    cursor: pointer; padding: 8px 18px;
    transition: background 0.15s, color 0.15s;
  }
  .sp-mode-btn.on  { background: var(--sp-signal); color: #fff; }
  .sp-mode-btn.off { background: transparent; color: var(--sp-ash); }
  .sp-mode-btn.off:hover { background: var(--sp-surface); color: var(--sp-plat); }

  /* ── NAV ACTIVE INDICATOR ─────────────────── */
  .sp-nav-item { position: relative; }
  .sp-nav-item.active { color: var(--sp-signal) !important; }
  .sp-nav-item.active::after {
    content: '';
    position: absolute;
    bottom: -8px; left: 50%;
    transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%;
    background: var(--sp-signal);
  }

  /* ── TICKER ──────────────────────────────── */
  .sp-ticker { overflow: hidden; border-top: 1px solid var(--sp-rim); background: var(--sp-surface); padding: 8px 0; }
  .sp-ticker-inner { display: inline-block; animation: sp-ticker 30s linear infinite; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--sp-ash); padding-right: 60px; white-space: nowrap; }

  /* ── RESPONSIVE ──────────────────────────── */
  .hide-mobile { display: flex; }
  .show-mobile { display: none; }
  @media (max-width: 768px) {
    .hide-mobile { display: none !important; }
    .show-mobile { display: flex !important; }
    .games-grid  { grid-template-columns: 1fr 1fr !important; }
    .hero-title  { font-size: clamp(42px,12vw,80px) !important; }
    .lb-wins     { display: none !important; }
  }
  @media (max-width: 480px) {
    .games-grid  { grid-template-columns: 1fr !important; }
  }
`;


/* ──────────────────────────────────────────
   SCAN LINE — thin lime bar sweeping once on mount
   Removed per design simplification — no entrance flash animations.
────────────────────────────────────────── */
function ScanLine() {
  return null; // kept as a no-op so existing <ScanLine /> calls don't need removing everywhere
}

/* AmbientGrid removed — grid lines add visual clutter with no function */
function AmbientGrid() { return null; }

/* ──────────────────────────────────────────
   SIGNAL TEXT — flat accent color, no shimmer/gradient
   (this used to have a hardcoded leftover neon-green #b8ff00 —
   removed, now just the one brand color, no animation)
────────────────────────────────────────── */
function Signal({ children }) {
  return <span style={{ color: DS.signal }}>{children}</span>;
}

/* ──────────────────────────────────────────
   LIVE COUNTER — animated number
────────────────────────────────────────── */
function AnimCount({ value, color = DS.plat }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const target = typeof value === "string" ? parseInt(value.replace(/,/g, "")) : value;
    if (!target) return;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 60));
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setN(cur);
      if (cur >= target) clearInterval(t);
    }, 18);
    return () => clearInterval(t);
  }, [value]);
  return <span style={{ color }}>{n.toLocaleString()}</span>;
}

/* ──────────────────────────────────────────
   GAME CARD — new design
────────────────────────────────────────── */
function GameCard({ emoji, title, desc, pts, color, delay, index, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="sp-up"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        animationDelay: `${delay}s`,
        padding: "20px 0",
        cursor: "pointer",
        borderBottom: `1px solid ${DS.rim}`,
        display: "flex",
        alignItems: "baseline",
        gap: 18,
        transition: "padding-left 0.18s",
        paddingLeft: hov ? 8 : 0,
      }}
    >
      {/* index as editorial serif numeral, not an icon pill */}
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        
        fontSize: 30,
        color: hov ? color : DS.ghost,
        minWidth: 36,
        transition: "color 0.2s",
      }}>{String((index ?? 0) + 1).padStart(2, "0")}</div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 17 }}>{emoji}</span>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: 0.2,
            color: hov ? color : DS.plat,
            transition: "color 0.2s",
          }}>{title}</span>
        </div>
        <div style={{ fontSize: 12.5, color: DS.ash, lineHeight: 1.6, maxWidth: 420 }}>{desc}</div>
      </div>

      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        color: DS.gold,
        whiteSpace: "nowrap",
      }}>+{pts}</div>
    </div>
  );
}

/* ──────────────────────────────────────────
   LEADERBOARD ROW
────────────────────────────────────────── */
function LBRow({ rank, name, flag, pts, wins, isMe, delay }) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return (
    <div className="sp-up" style={{
      animationDelay: `${delay}s`,
      display: "grid",
      gridTemplateColumns: "48px 1fr 100px 72px",
      alignItems: "center",
      padding: "12px 20px",
      borderBottom: `1px solid ${DS.rim}`,
      background: isMe ? DS.signal + "08" : "transparent",
      borderLeft: `2px solid ${isMe ? DS.signal : "transparent"}`,
      transition: "background 0.15s",
      cursor: "pointer",
    }}
      onMouseEnter={e => e.currentTarget.style.background = isMe ? DS.signal + "12" : DS.surface}
      onMouseLeave={e => e.currentTarget.style.background = isMe ? DS.signal + "08" : "transparent"}
    >
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: rank <= 3 ? 17 : 12,
        color: rank === 1 ? DS.gold : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : DS.ash,
      }}>{medals[rank] || `#${rank}`}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: isMe ? DS.signal + "18" : DS.surface2,
          border: `1px solid ${isMe ? DS.signal + "40" : DS.rim}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>{isMe ? "⭐" : ["😎", "🦊", "🌶️", "🐉"][rank - 1] || "👤"}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: isMe ? DS.signal : DS.plat }}>{name}</div>
          <div style={{ fontSize: 11, color: DS.ash }}>{flag}</div>
        </div>
      </div>

      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: DS.gold }}>
        {pts.toLocaleString()}
      </span>
      <span className="lb-wins" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: DS.ash }}>
        {wins}W
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────
   WEBRTC HOOK — unchanged logic, cleaner
────────────────────────────────────────── */
function useWebRTC() {
  const localRef         = useRef(null);
  const remoteRef        = useRef(null);  // stranger's video element
  const remoteStreamRef  = useRef(null);  // holds the remote MediaStream — survives conditional rendering
  const pcRef            = useRef(null);  // RTCPeerConnection
  const pendingICE       = useRef([]);    // ICE candidates queued before remote desc is set
  const streamRef        = useRef(null);  // ref copy of stream so closures always see it

  const [stream,          setStream]          = useState(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [camErr,  setCamErr]  = useState(null);
  const [muted,   setMuted]   = useState(false);
  const [camOff,  setCamOff]  = useState(false);

  /*
    ICE servers — STUN + 3 free TURN relays from openrelay.metered.ca
    WHY TURN IS REQUIRED:
    STUN only discovers your public IP. It fails (~30% of real calls) when
    both users are behind carrier-grade NAT (mobile data) or different ISPs
    in different countries. Nepal ↔ Japan will almost always need TURN.
    TURN acts as a video relay when direct peer-to-peer is impossible.
    openrelay.metered.ca is a free public TURN server — fine for dev/testing.
    For production: get your own at metered.ca (free tier = 500MB/month).
  */
  const ICE = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80",             username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443",            username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ];

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = s;
      setStream(s);
      if (localRef.current) { localRef.current.srcObject = s; localRef.current.play().catch(() => {}); }
      setCamErr(null);
    } catch (e) {
      setCamErr(e.name === "NotAllowedError"
        ? "Camera blocked — allow access in browser settings."
        : "Can't open camera: " + e.message);
    }
  }

  function stopCamera() {
    closePeer();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setStream(null);
  }

  function toggleMute() {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }

  function toggleCam() {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  }

  /*
    setupPeerConnection — call this the moment match:found fires.
    Creates RTCPeerConnection, adds local tracks, wires ICE + signaling.
    role === "offer"  → we create the offer immediately
    role === "answer" → we wait for the incoming offer via socket
    Returns a cleanup function that removes all socket listeners.
  */
  function setupPeerConnection(roomId, role) {
    closePeer();
    pendingICE.current = [];

    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;

    // Add our camera/mic tracks so the remote peer receives them
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => pc.addTrack(t, streamRef.current));
    }

    // Remote tracks arrive → attach to the stranger's <video> element.
    // CRITICAL: also store in remoteStreamRef because the <video> element is
    // conditionally rendered (only shows after remoteConnected=true).
    // Without the ref, srcObject gets assigned to null and the video stays black.
    pc.ontrack = ({ streams: [rs] }) => {
      remoteStreamRef.current = rs;           // store it — ref callback will pick this up
      if (remoteRef.current) {
        remoteRef.current.srcObject = rs;
        remoteRef.current.play().catch(() => {});
      }
      setRemoteConnected(true);
    };

    // Send our ICE candidates to the other peer through the server relay
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit("webrtc:ice", { roomId, candidate });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected")                              setRemoteConnected(true);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") setRemoteConnected(false);
    };

    // Socket listeners for signaling exchange
    async function onOffer({ sdp }) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingICE.current) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      pendingICE.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { roomId, sdp: answer });
    }

    async function onAnswer({ sdp }) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingICE.current) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      pendingICE.current = [];
    }

    async function onIce({ candidate }) {
      if (!pc.remoteDescription) { pendingICE.current.push(candidate); return; }
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }

    socket.on("webrtc:offer",  onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice",    onIce);

    // Offerer creates and sends the offer right away
    if (role === "offer") {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => socket.emit("webrtc:offer", { roomId, sdp: pc.localDescription }))
        .catch(e => console.error("createOffer failed:", e));
    }

    return () => {
      socket.off("webrtc:offer",  onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice",    onIce);
    };
  }

  function closePeer() {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    setRemoteConnected(false);
    pendingICE.current = [];
    remoteStreamRef.current = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
  }

  useEffect(() => {
    if (stream && localRef.current) { localRef.current.srcObject = stream; localRef.current.play().catch(() => {}); }
  }, [stream]);

  return {
    localRef, remoteRef, remoteStreamRef,
    stream, remoteConnected,
    camErr, muted, camOff,
    startCamera, stopCamera, toggleMute, toggleCam,
    setupPeerConnection, closePeer,
  };
}

/* ──────────────────────────────────────────
   WATCH LIVE PAGE — crowd view
────────────────────────────────────────── */
function WatchLivePage({ onNavigate, liveCount }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "don't laugh", "vibe check", "roast", "mirror"];

  // Real streams — populated by the server's "liveRooms" broadcast.
  // Replaces the old hardcoded fake array; this list is empty until
  // someone actually taps "Go Live" somewhere in the app right now.
  const [streams, setStreams] = useState([]);

  useEffect(() => {
    const onLiveRooms = (rooms) => setStreams(rooms);
    socket.on("liveRooms", onLiveRooms);
    socket.emit("liveRooms:get"); // ask for the current list immediately on mount
    return () => socket.off("liveRooms", onLiveRooms);
  }, []);

  return (
    <div style={{ position: "relative", zIndex: 1, paddingTop: 80, minHeight: "100vh" }}>
      <div style={{ padding: "0 clamp(16px,4vw,60px)", maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div className="sp-up" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span className="sp-live-badge"><span className="sp-live-dot" />{liveCount > 0 ? liveCount.toLocaleString() : "—"} online</span>
            <span style={{ fontSize: 12, color: DS.ash, fontFamily: "'JetBrains Mono',monospace" }}>{streams.length} live rooms</span>
          </div>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(36px,7vw,64px)",
            lineHeight: 0.95,
            letterSpacing: -1,
          }}>
            WATCH<br /><Signal>LIVE MATCHES</Signal>
          </h1>
          <p style={{ fontSize: 14, color: DS.ash, marginTop: 14, lineHeight: 1.7 }}>
            Drop into any match. React in real time. Points on the line.
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px",
              borderRadius: 14,
              border: `1px solid ${filter === f ? DS.signal + "66" : DS.rim}`,
              background: filter === f ? DS.signal + "12" : "transparent",
              color: filter === f ? DS.signal : DS.ash,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s",
              textTransform: "capitalize",
            }}>{f}</button>
          ))}
        </div>

        {/* Stream grid */}
        {streams.length === 0 ? (
          <div className="sp-card sp-up" style={{ padding: "60px 32px", textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📡</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif",  fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
              Nobody's live right now
            </div>
            <div style={{ fontSize: 13, color: DS.ash }}>
              Be the first — tap Go Live and the crowd shows up here instantly.
            </div>
          </div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 16, paddingBottom: 100 }}>
          {streams.map((s, i) => (
            <div key={s.id} className="sp-card sp-up" style={{ animationDelay: `${i * 0.07}s`, overflow: "hidden", cursor: "pointer" }}>
              {/* Video placeholder */}
              <div style={{
                aspectRatio: "16/9",
                background: DS.surface2,
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36,
              }}>
                {s.mode === "match" ? "⚔️" : "📡"}
                {/* live badge */}
                <div style={{ position: "absolute", top: 10, left: 10 }}>
                  <span className="sp-live-badge"><span className="sp-live-dot" />LIVE</span>
                </div>
                {/* viewer count */}
                <div style={{
                  position: "absolute", bottom: 10, right: 10,
                  background: "rgba(0,0,0,0.7)", borderRadius: 14, padding: "3px 8px",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.plat,
                }}>👁 {s.viewers || 0}</div>
              </div>

              {/* Info */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600, fontSize: 14, color: DS.plat,
                  }}>{s.title}</div>
                  <span className="sp-tag">{s.mode === "match" ? "live match" : "solo stream"}</span>
                </div>
                <div style={{ fontSize: 12, color: DS.ash, fontFamily: "'JetBrains Mono', monospace" }}>
                  {s.user?.flag || "🌍"} {s.user?.username || "anonymous"}
                </div>
                <button className="sp-btn-primary" style={{ marginTop: 14, width: "100%", padding: "10px" }}>
                  Watch Now
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   GO LIVE PAGE — broadcaster setup
   Users can go live solo (spectators watch them) 
   or get matched and play live with a crowd watching.
────────────────────────────────────────── */
function GoLivePage({ user, onNavigate, webrtc }) {
  const [liveMode, setLiveMode] = useState("stream"); // "stream" | "match"
  const [step, setStep] = useState("setup"); // "setup" | "live"
  const [title, setTitle] = useState("");

  // Tell the server (and therefore every WatchLivePage open right now) that we've gone live.
  // Without this emit, "going live" was purely local UI — nobody else could ever know.
  const goLive = () => {
    socket.emit("golive:start", {
      mode: liveMode,
      title: title || "Live now",
      user: user ? { username: user.username, flag: user.flag } : null,
    });
    setStep("live");
  };

  const endLive = () => {
    socket.emit("golive:end");
    setStep("setup");
    webrtc.stopCamera();
  };

  // If they close the tab/navigate away mid-stream without hitting "End Stream",
  // the server's disconnect handler cleans it up — but if they just switch pages
  // inside the app (no disconnect happens), we still need to tell the server.
  useEffect(() => {
    return () => { if (step === "live") socket.emit("golive:end"); };
  }, [step]);

  if (!user) {
    return (
      <div style={{ position: "relative", zIndex: 1, paddingTop: 80, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="sp-card" style={{ padding: "40px 48px", textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>📡</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 10 }}>Sign in to go live</div>
          <div style={{ fontSize: 13, color: DS.ash, marginBottom: 28, lineHeight: 1.7 }}>You need an account to broadcast. It takes 30 seconds.</div>
          <button className="sp-btn-primary" style={{ padding: "12px 28px" }} onClick={() => onNavigate("login")}>
            Create account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", zIndex: 1, paddingTop: 80, minHeight: "100vh" }}>
      <div style={{ padding: "0 clamp(16px,4vw,48px)", maxWidth: 800, margin: "0 auto", paddingBottom: 100 }}>

        <div className="sp-up" style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
            fontSize: "clamp(32px,6vw,54px)", lineHeight: 0.95, letterSpacing: -0.5, marginBottom: 12,
          }}>GO <Signal>LIVE</Signal></h1>
          <p style={{ fontSize: 14, color: DS.ash }}>Broadcast to the crowd, or get matched and play with them watching.</p>
        </div>

        {/* Mode switch */}
        <div style={{ marginBottom: 28 }}>
          <div className="sp-mode-rail">
            <button className={`sp-mode-btn ${liveMode === "stream" ? "on" : "off"}`} onClick={() => setLiveMode("stream")}>📡 Solo Stream</button>
            <button className={`sp-mode-btn ${liveMode === "match" ? "on" : "off"}`} onClick={() => setLiveMode("match")}>⚔️ Live Match</button>
          </div>
          <p style={{ fontSize: 12, color: DS.ash, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            {liveMode === "stream"
              ? "// you stream solo — crowd watches and reacts in real time"
              : "// get matched vs a stranger — crowd watches both of you"}
          </p>
        </div>

        {step === "setup" && (
          <div className="sp-card sp-up" style={{ padding: "28px 28px" }}>
            {/* Camera preview — MOBILE: full width portrait / DESKTOP: 16:9 landscape */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: DS.ash, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>
                // camera preview
              </div>

              {/* Desktop: landscape wide */}
              <div className="hide-mobile" style={{
                width: "100%", aspectRatio: "16/9",
                background: DS.surface2, borderRadius: 12,
                overflow: "hidden", border: `1px solid ${DS.rim}`,
                position: "relative",
              }}>
                {webrtc.stream
                  ? <video ref={el => { webrtc.localRef.current = el; if (el && webrtc.stream) { el.srcObject = webrtc.stream; el.play().catch(() => {}); } }} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                  : (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <span style={{ fontSize: 36 }}>📷</span>
                      <span style={{ fontSize: 12, color: DS.ash }}>Camera off</span>
                    </div>
                  )
                }
                {webrtc.stream && (
                  <div style={{ position: "absolute", bottom: 12, left: 12 }}>
                    <span className="sp-live-badge"><span className="sp-live-dot" />PREVIEW</span>
                  </div>
                )}
              </div>

              {/* Mobile: portrait crop — like a phone screen */}
              <div className="show-mobile" style={{
                width: "min(200px, 60vw)", aspectRatio: "9/16",
                background: DS.surface2, borderRadius: 16,
                overflow: "hidden", border: `1px solid ${DS.rim}`,
                position: "relative", margin: "0 auto",
              }}>
                {webrtc.stream
                  ? <video ref={el => { webrtc.localRef.current = el; if (el && webrtc.stream) { el.srcObject = webrtc.stream; el.play().catch(() => {}); } }} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                  : (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <span style={{ fontSize: 28 }}>📷</span>
                      <span style={{ fontSize: 11, color: DS.ash }}>Camera off</span>
                    </div>
                  )
                }
              </div>
            </div>

            {webrtc.camErr && (
              <div style={{ background: DS.live + "12", border: `1px solid ${DS.live}33`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: DS.live, marginBottom: 16 }}>
                {webrtc.camErr}
              </div>
            )}

            {/* Cam controls */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {!webrtc.stream
                ? <button className="sp-btn-primary" style={{ padding: "9px 20px", fontSize: 13 }} onClick={webrtc.startCamera}>Enable Camera</button>
                : <>
                    <button className="sp-btn-ghost" style={{ padding: "9px 14px", fontSize: 13 }} onClick={webrtc.toggleMute}>{webrtc.muted ? "🔇 Muted" : "🎤 Mute"}</button>
                    <button className="sp-btn-ghost" style={{ padding: "9px 14px", fontSize: 13 }} onClick={webrtc.toggleCam}>{webrtc.camOff ? "📷 Cam off" : "📷 Cam on"}</button>
                  </>
              }
            </div>

            {/* Stream title (solo mode) */}
            {liveMode === "stream" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: DS.ash, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  // stream title
                </label>
                <input
                  className="sp-input"
                  placeholder="e.g. 'don't make me laugh challenge'"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={60}
                />
              </div>
            )}

            <button
              className="sp-btn-primary"
              style={{ padding: "14px", width: "100%", fontSize: 15 }}
              onClick={goLive}
              disabled={!webrtc.stream}
            >
              {liveMode === "stream" ? "Start Streaming →" : "Find Opponent & Go Live →"}
            </button>
          </div>
        )}

        {step === "live" && (
          <div className="sp-card sp-up" style={{ padding: "24px", textAlign: "center" }}>
            <span className="sp-live-badge" style={{ fontSize: 13, padding: "6px 14px", marginBottom: 20, display: "inline-flex" }}>
              <span className="sp-live-dot" /> YOU ARE LIVE
            </span>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
              {title || "Live session"}
            </div>
            <div style={{ fontSize: 13, color: DS.ash, marginBottom: 24 }}>
              Crowd is watching. {liveMode === "match" ? "Finding opponent..." : "Stream is active."}
            </div>
            <button className="sp-btn-ghost" style={{ padding: "10px 28px" }} onClick={endLive}>
              End Stream
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════ */
export default function StrangerPlay() {
  const [page, setPage] = useState("home");

  /* ── THEME — toggle between dark and light, persists in localStorage.
     window.applyTheme is defined at module load, sets data-theme on <html>
     which flips every CSS variable across Main and GameScreen. */
  const [theme, setTheme] = useState(() => localStorage.getItem("sp_theme") || "dark");
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.applyTheme(next);
  };

  /* ── HOME SUB-MODE: "watch" | "play" | "golive" ── 
     This is the two-mode system you asked for.
     On the home page, users choose their intent first.
  */
  const [homeMode, setHomeMode] = useState("watch"); // default to discovery/watch

  /* ── AUTH — reads from localStorage on mount ── */
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sp_user")) || null; }
    catch { return null; }
  });
  const [points, setPoints] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sp_user"))?.points ?? 0; }
    catch { return 0; }
  });

  // BUG FIX #1: handleLogin is now correctly passed as onLogin to LoginSignup
  // Without this, auth state never updates in parent after signup/login
  const handleLogin = (userData) => {
    setUser(userData);
    setPoints(userData?.points ?? 0);
  };

  const handleLogout = () => {
    localStorage.removeItem("sp_token");
    localStorage.removeItem("sp_user");
    setUser(null);
    setPoints(0);
    goTo("home");
  };

  /* ── LIVE COUNT from socket ── */
  const [liveCount, setLiveCount] = useState(0);

  // Real leaderboard — replaces the hardcoded top-5 fake list.
  // /api/leaderboard already existed server-side and was just never called.
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(true);
  useEffect(() => {
    if (page !== "ranks") return;
    setLbLoading(true);
    fetch(`${import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com"}/api/leaderboard`)
      .then(r => r.json())
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [page]);


  /* ── MATCHMAKING ── */
  const [matchPhase,   setMatchPhase]   = useState("idle");
  const [matchInfo,    setMatchInfo]    = useState(null);
  const [queueTime,    setQueueTime]    = useState(0);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [proposedGame, setProposedGame] = useState(null);  // game the other side proposed
  const [gameAccepted, setGameAccepted] = useState(false); // both accepted → open GameScreen
  const queueTimerRef  = useRef(null);
  const peerCleanupRef = useRef(null);  // cleanup fn from setupPeerConnection

  /* ── SOCKET ── */
  useEffect(() => {
    socket.on("onlineCount", (n) => setLiveCount(n));

    const doAuth = () => {
      const token = localStorage.getItem("sp_token");
      if (token) socket.emit("auth", token);
    };
    if (socket.connected) doAuth();
    socket.on("connect", doAuth);

    socket.on("queue:waiting", ({ position }) => {
      console.log("📋 Queue position:", position);
    });

    socket.on("match:found", (info) => {
      clearInterval(queueTimerRef.current);
      setMatchInfo(info);
      setMatchPhase("connected");
      setOpponentLeft(false);
      setProposedGame(null);
      setGameAccepted(false);
      // Stay on play page — show the call UI, NOT GameScreen
      // Game only starts when both players choose and accept together
      setPage("play");
      // Start WebRTC peer connection now that we have roomId + role
      if (peerCleanupRef.current) peerCleanupRef.current();
      setTimeout(() => {
        peerCleanupRef.current = webrtc.setupPeerConnection(info.roomId, info.role);
      }, 150);
    });

    socket.on("opponent:left", () => {
      setOpponentLeft(true);
      webrtc.closePeer();
    });

    // Other player tapped a game pill — show accept toast
    socket.on("gameProposed", ({ game }) => {
      setProposedGame(game);
    });

    // Both accepted → open GameScreen with the chosen game
    socket.on("gameStarted", ({ game }) => {
      setMatchInfo(prev => prev ? { ...prev, gameMode: game } : prev);
      setGameAccepted(true);
      setPage("gamescreen");
    });

    socket.on("auth:error", () => console.warn("Socket auth failed"));

    return () => {
      socket.off("onlineCount");
      socket.off("connect", doAuth);
      socket.off("queue:waiting");
      socket.off("match:found");
      socket.off("auth:error");
      socket.off("opponent:left");
      socket.off("gameProposed");
      socket.off("gameStarted");
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("sp_token");
    if (token && socket.connected) socket.emit("auth", token);
  }, [user]);

  const webrtc = useWebRTC();
  useEffect(() => {
    // Start camera only on play/golive pages
    if (page === "play" || (page === "home" && homeMode === "golive")) webrtc.startCamera();
    else webrtc.stopCamera();
  }, [page, homeMode]);

  const goTo = (p) => setPage(p);

  // Opens Stripe Checkout for the 50-coin / $5 starter pack.
  // Coins are only credited after Stripe's webhook confirms real payment —
  // never on the frontend directly, so this can't be faked into free coins.
  const buyCoins = async () => {
    try {
      const token = localStorage.getItem("sp_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com"}/api/coins/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ packageIndex: 0 }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Couldn't start checkout"); return; }
      window.location.href = data.url; // redirect to Stripe's hosted checkout page
    } catch {
      alert("Can't reach server");
    }
  };

  const startSearch = () => {
    setMatchPhase("searching");
    setQueueTime(0);
    setOpponentLeft(false);
    setProposedGame(null);
    setGameAccepted(false);
    setPage("play");
    // gameMode: null — players match on availability, choose game AFTER connecting
    socket.emit("queue:join", { gameMode: null });
    clearInterval(queueTimerRef.current);
    queueTimerRef.current = setInterval(() => setQueueTime(t => t + 1), 1000);
  };

  const cancelSearch = () => {
    clearInterval(queueTimerRef.current);
    socket.emit("queue:leave");
    setMatchPhase("idle");
    setQueueTime(0);
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: DS.void, color: DS.plat, fontFamily: "'Inter', sans-serif", overflowX: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <ScanLine />
      <AmbientGrid />

      {/* ══════════════════════════════
          TOP NAV — redesigned
      ══════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(16px,3vw,40px)",
        background: DS.void + "ee",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${DS.rim}`,
      }}>
        {/* Logo */}
        <div
          onClick={() => goTo("home")}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}
        >
          <img
            src="/logo.svg"
            alt="Tranzle"
            style={{ width: 26, height: 26, borderRadius: 14, objectFit: "cover", display: "block" }}
          />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700, fontSize: 17, letterSpacing: 0.3,
            color: DS.plat,
          }}>Tranzle</span>
        </div>

        {/* Desktop right section */}
        <div className="hide-mobile" style={{ alignItems: "center", gap: 10 }}>
          {/* Live count */}
          <span className="sp-live-badge">
            <span className="sp-live-dot" />
            {liveCount > 0 ? liveCount.toLocaleString() : "—"}
          </span>

          {/* Points pill — shown only when logged in */}
          {user && (
            <span style={{
              background: DS.gold + "12",
              border: `1px solid ${DS.gold}33`,
              borderRadius: 14, padding: "4px 10px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, color: DS.gold,
            }}>
              {points} pts
            </span>
          )}

          {/* Coins — separate currency from points. Points = skill score from
              winning matches. Coins = spendable, bought with real money,
              used as entry fee for games. Click opens the purchase flow. */}
          {user && (
            <button
              onClick={buyCoins}
              className="sp-btn-ghost"
              style={{ padding: "4px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: DS.signal, borderColor: DS.signal + "33" }}
              title="Buy more coins"
            >
              🪙 {user.coins ?? 0}
            </button>
          )}

          {/* Theme toggle — quick access here, full switch also lives in Settings */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark/light mode"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="sp-btn-ghost"
            style={{ width: 34, height: 34, padding: 0, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* BUG FIX #2: Login button hidden after login. Per latest review:
              no separate Play button here anymore, and a logged-in user sees
              ONLY a single profile avatar — no username text, no inline logout.
              Sign-out lives in Settings now, not duplicated in the header. */}
          {!user ? (
            <button className="sp-btn-ghost" style={{ padding: "7px 16px" }} onClick={() => goTo("login")}>
              Sign in
            </button>
          ) : (
            <button
              onClick={() => goTo("profile")}
              aria-label="Profile"
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: DS.surface, border: `1px solid ${DS.rim}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 15, padding: 0,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = DS.signal + "66"}
              onMouseLeave={e => e.currentTarget.style.borderColor = DS.rim}
            >
              🧑‍💻
            </button>
          )}
        </div>

        {/* Mobile right */}
        <div className="show-mobile" style={{ alignItems: "center", gap: 10 }}>
          {user && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: DS.gold, background: DS.gold + "12",
              border: `1px solid ${DS.gold}22`, borderRadius: 14, padding: "3px 8px",
            }}>{points}pts</span>
          )}
          <button
            onClick={() => setMenuOpen(m => !m)}
            style={{ background: "none", border: "none", color: DS.plat, fontSize: 20, cursor: "pointer", padding: 4 }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 60, left: 0, right: 0, zIndex: 299,
          background: DS.void + "f8", backdropFilter: "blur(24px)",
          borderBottom: `1px solid ${DS.rim}`,
          padding: "16px 20px 28px",
          animation: "sp-in 0.22s both",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {[["🎁", "Rewards", "rewards"], ["⚙️", "Settings", "settings"], ["👤", "Profile", "profile"]].map(([icon, label, id]) => (
            <button key={id} onClick={() => { goTo(id); setMenuOpen(false); }} style={{
              background: "none", border: "none", borderRadius: 10, padding: "12px 16px",
              color: DS.ash, fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 15,
              cursor: "pointer", textAlign: "left",
            }}>{icon} {label}</button>
          ))}
          <div style={{ height: 1, background: DS.rim, margin: "8px 0" }} />

          {/* BUG FIX #2 mobile: hide login if already logged in */}
          {!user && (
            <button className="sp-btn-ghost" style={{ padding: "12px 16px", textAlign: "left", borderRadius: 10 }}
              onClick={() => { goTo("login"); setMenuOpen(false); }}>
              Sign in / Sign up
            </button>
          )}
          {user && (
            <button className="sp-btn-ghost" style={{ padding: "12px 16px", textAlign: "left", borderRadius: 10, color: DS.live, borderColor: DS.live + "33" }}
              onClick={() => { handleLogout(); setMenuOpen(false); }}>
              Sign out
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════
          HOME PAGE — redesigned
          Two modes: Watch Live / Play / Go Live
      ══════════════════════════════ */}
      {page === "home" && (
        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ── LIVE TICKER (top, below nav) ── */}
          <div className="sp-ticker-wrap" style={{ marginTop: 60 }}>
            <div className="sp-ticker-inner">
              shadow_x vs foxgirl99 — Don't Laugh — 80pts at stake &nbsp;◆&nbsp;
              dragonz vs raj_np — Vibe Check — 30pts &nbsp;◆&nbsp;
              3 new players just joined &nbsp;◆&nbsp;
              hotboi_br won 120pts in Speed Roast &nbsp;◆&nbsp;
              luna_mx connected from Mexico 🇲🇽 &nbsp;◆&nbsp;
              {liveCount > 0 ? `${liveCount.toLocaleString()} online now` : "server warming up..."} &nbsp;◆&nbsp;
            </div>
          </div>

          {/* ── HERO ── */}
          <section style={{
            minHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "clamp(60px,10vw,100px) clamp(20px,6vw,80px)",
            position: "relative",
          }}>
            {/* Tag line */}
            <div className="sp-up" style={{
              animationDelay: "0.1s",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: DS.ash, letterSpacing: 3,
              marginBottom: 28, textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ width: 20, height: 1, background: DS.rim, display: "inline-block" }} />
              random video calls. real stakes.
              <span style={{ width: 20, height: 1, background: DS.rim, display: "inline-block" }} />
            </div>

            {/* Hero title — brutalist, tight */}
            <h1
              className="hero-title sp-up"
              style={{
                animationDelay: "0.2s",
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(64px,14vw,160px)",
                lineHeight: 0.88,
                letterSpacing: -3,
                marginBottom: 32,
              }}
            >
              CALL A<br />
              <Signal>STRANGER.</Signal><br />
              WIN.
            </h1>

            <p className="sp-up" style={{
              animationDelay: "0.35s",
              fontSize: "clamp(14px,2vw,16px)",
              color: DS.ash,
              maxWidth: 400,
              lineHeight: 1.8,
              marginBottom: 44,
            }}>
              Two strangers. Live camera. A game. Crowd watching.<br />
              No followers. No algorithm. Just you.
            </p>

            {/* ── MODE SWITCHER ── The two-mode system */}
            <div className="sp-up" style={{ animationDelay: "0.45s", marginBottom: 32 }}>
              <div className="sp-mode-rail">
                <button
                  className={`sp-mode-btn ${homeMode === "watch" ? "on" : "off"}`}
                  onClick={() => setHomeMode("watch")}
                >
                  👁 Watch Live
                </button>
                <button
                  className={`sp-mode-btn ${homeMode === "play" ? "on" : "off"}`}
                  onClick={() => setHomeMode("play")}
                >
                  ⚔️ Play
                </button>
                <button
                  className={`sp-mode-btn ${homeMode === "golive" ? "on" : "off"}`}
                  onClick={() => setHomeMode("golive")}
                >
                  📡 Go Live
                </button>
              </div>
            </div>

            {/* CTA changes based on mode */}
            <div className="sp-up" style={{ animationDelay: "0.5s", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {homeMode === "watch" && (
                <button className="sp-btn-primary" style={{ padding: "14px 36px", fontSize: 15 }} onClick={() => goTo("watchlive")}>
                  Browse live matches →
                </button>
              )}
              {homeMode === "play" && (
                <button className="sp-btn-primary" style={{ padding: "14px 36px", fontSize: 15 }} onClick={() => startSearch()}>
                  ▶ Find a stranger
                </button>
              )}
              {homeMode === "golive" && (
                <button className="sp-btn-primary" style={{ padding: "14px 36px", fontSize: 15 }} onClick={() => goTo("golive")}>
                  📡 Set up stream →
                </button>
              )}
              <button className="sp-btn-ghost" style={{ padding: "14px 24px", fontSize: 14 }} onClick={() => goTo("games")}>
                Browse games
              </button>
            </div>

            {/* Stats row */}
            <div className="sp-up" style={{
              animationDelay: "0.65s",
              display: "flex", alignItems: "center", gap: "clamp(20px,4vw,48px)",
              marginTop: 64, flexWrap: "wrap", justifyContent: "center",
            }}>
              {[
                { label: "online now",     value: liveCount > 0 ? liveCount : 2847,  color: DS.signal },
                { label: "games played",   value: 148920,                              color: DS.ice    },
                { label: "countries",      value: 94,                                  color: DS.gold   },
                { label: "points given",   value: 982400,                              color: DS.live   },
              ].map((s, i) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "clamp(20px,3.5vw,30px)",
                    fontWeight: 600,
                    color: s.color,
                    marginBottom: 4,
                  }}>
                    <AnimCount value={s.value} color={s.color} />
                  </div>
                  <div style={{ fontSize: 11, color: DS.ash, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── GAMES GRID ── */}
          <section style={{ padding: "clamp(40px,6vw,80px) clamp(20px,5vw,60px) 120px", position: "relative" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 4, marginBottom: 12, textTransform: "uppercase" }}>
                  // six ways to embarrass a stranger
                </div>
                <h2 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: "clamp(30px,5vw,48px)",
                  letterSpacing: -0.5,
                  lineHeight: 1,
                }}>Pick a <Signal>game.</Signal></h2>
              </div>

              <div className="games-list" style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { emoji: "🔊", title: "Echo",           desc: "Make any sound — clap, hum, a made-up word. Your stranger has 2 seconds to echo it back. Crowd judges the match.", pts: 18, color: DS.signal, delay: 0    },
                  { emoji: "😐", title: "Don't Laugh",    desc: "Keep a straight face while your stranger loses it.",    pts: 10, color: DS.ice,    delay: 0.05 },
                  { emoji: "🪞", title: "Mirror Me",      desc: "Copy poses and expressions. AI scores the match.",       pts: 8,  color: DS.live,   delay: 0.10 },
                  { emoji: "🎭", title: "Vibe Check",     desc: "Act a mood — grandma, demon, robot. Crowd votes.",       pts: 12, color: DS.gold,   delay: 0.15 },
                  { emoji: "🌶️", title: "Hot Take",      desc: "Wild opinion. Five seconds to react. Crowd judges.",     pts: 6,  color: "#a064ff", delay: 0.20 },
                  { emoji: "📖", title: "Finish My Story",desc: "One starts a story. The other ends it live.",            pts: 15, color: "#ff9f43", delay: 0.25 },
                ].map((g, i) => (
                  <GameCard key={g.title} {...g} index={i} onClick={() => goTo("play")} />
                ))}
              </div>
              <div style={{ marginTop: 18, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: DS.ghost }}>
                games unlock after you connect — nobody picks before they've said hi
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════
          WATCH LIVE PAGE
      ══════════════════════════════ */}
      {page === "watchlive" && (
        <WatchLivePage onNavigate={goTo} liveCount={liveCount} />
      )}

      {/* ══════════════════════════════
          GO LIVE PAGE
      ══════════════════════════════ */}
      {page === "golive" && (
        <GoLivePage user={user} onNavigate={goTo} webrtc={webrtc} />
      )}

      {/* ══════════════════════════════
          PLAY — matchmaking + live call
      ══════════════════════════════ */}
      {page === "play" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10, background: "#000" }}>

          {/* ── IDLE ── */}
          {matchPhase === "idle" && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 28, padding: "40px 20px",
              background: DS.void,
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 4 }}>// tap to connect</div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "clamp(32px,7vw,56px)", letterSpacing: -1, textAlign: "center" }}>
                Talk to a <Signal>stranger</Signal>
              </h1>
              <p style={{ color: DS.ash, fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
                Random call first. Pick a game together if you both want to — or just talk.
              </p>

              {/* Camera preview */}
              {webrtc.stream ? (
                <div style={{
                  width: "min(220px,60vw)", aspectRatio: "4/3",
                  borderRadius: 14, overflow: "hidden",
                  border: `1px solid ${DS.signal}44`, background: DS.surface2, position: "relative",
                }}>
                  <video
                    ref={el => { webrtc.localRef.current = el; if (el && webrtc.stream) { el.srcObject = webrtc.stream; el.play().catch(() => {}); } }}
                    autoPlay muted playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }} />
                  <div style={{ position: "absolute", bottom: 8, left: 8 }}>
                    <span className="sp-live-badge"><span className="sp-live-dot" />PREVIEW</span>
                  </div>
                </div>
              ) : (
                <div style={{ width: "min(220px,60vw)", aspectRatio: "4/3", borderRadius: 14, background: DS.surface, border: `1px solid ${DS.rim}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: DS.ghost, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>no camera</span>
                </div>
              )}

              {webrtc.camErr && (
                <div style={{ background: DS.live + "18", border: `1px solid ${DS.live}44`, borderRadius: 10, padding: "10px 16px", fontSize: 12, color: DS.live, maxWidth: 280, textAlign: "center" }}>{webrtc.camErr}</div>
              )}

              <button onClick={startSearch} style={{
                width: 140, height: 140, borderRadius: "50%",
                background: DS.signal, border: "none", cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
                fontSize: 15, color: "#fff",
              }}>
                FIND A<br />STRANGER
              </button>

              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: DS.ghost }}>
                {liveCount > 0 ? `${liveCount.toLocaleString()} online` : "warming up..."}
              </div>

              {/* Back to home */}
              <button onClick={() => goTo("home")} style={{ background: "none", border: "none", color: DS.ash, fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
                ← back
              </button>
            </div>
          )}

          {/* ── SEARCHING ── */}
          {matchPhase === "searching" && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 24,
              background: DS.void,
            }}>
              <div style={{ position: "relative", width: 100, height: 100 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${DS.rim}`, borderTopColor: DS.signal, animation: "sp-spin 1s linear infinite" }} />
                <div style={{ position: "absolute", inset: 14, borderRadius: "50%", background: DS.surface, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: DS.gold }}>{queueTime}s</div>
                </div>
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "clamp(22px,5vw,34px)", textAlign: "center" }}>
                Finding your <Signal>match</Signal>
              </div>
              <div style={{ color: DS.ash, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textAlign: "center" }}>
                {liveCount} online · searching...
              </div>
              <button className="sp-btn-ghost" style={{ padding: "10px 28px" }} onClick={cancelSearch}>Cancel</button>
            </div>
          )}

          {/* ── CONNECTED — split screen call ── */}
          {matchPhase === "connected" && matchInfo && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              // No top nav, no bottom nav — full screen call takes everything
            }}>
              {/*
                SPLIT SCREEN LAYOUT
                ─────────────────────────────────────────
                TOP 50% — STRANGER
                Bottom 50% — YOU
                ─────────────────────────────────────────
                This is the standard Omegle/OmeTV layout.
                Both people feel present. No one is hidden.
                PiP (corner) feels like messenger — split
                screen feels like a real face-to-face call.
              */}

              {/* ── TOP HALF — STRANGER ── */}
              <div style={{ flex: 1, position: "relative", background: DS.void, overflow: "hidden" }}>
                {webrtc.remoteConnected ? (
                  /*
                    WHY REF CALLBACK NOT useRef directly:
                    This video element is conditionally rendered — it doesn't exist until
                    remoteConnected=true. But pc.ontrack fires BEFORE this element mounts.
                    If we use ref={webrtc.remoteRef}, srcObject was already assigned to null.
                    The ref callback fires on mount and immediately picks up remoteStreamRef,
                    which was stored in ontrack even though the element wasn't ready yet.
                  */
                  <video
                    ref={el => {
                      webrtc.remoteRef.current = el;
                      if (el && webrtc.remoteStreamRef.current) {
                        el.srcObject = webrtc.remoteStreamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: DS.void }}>
                    {!opponentLeft ? (
                      <>
                        <div style={{ position: "relative", width: 56, height: 56 }}>
                          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${DS.rim}`, borderTopColor: DS.signal, animation: "sp-spin 1s linear infinite" }} />
                          <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: DS.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 13 }}>{matchInfo.opponent?.flag || "🌍"}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.signal, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>CONNECTING</div>
                          <div style={{ fontSize: 11, color: DS.ghost, lineHeight: 1.6 }}>
                            {matchInfo.opponent?.username || "stranger"} · up to 10s on different networks
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif",  fontSize: 28, color: DS.ash }}>They left.</div>
                        <div style={{ fontSize: 11, color: DS.ghost, fontFamily: "'JetBrains Mono', monospace" }}>tap NEXT for another</div>
                      </>
                    )}
                  </div>
                )}

                {/* Stranger credential — top left */}
                <div style={{ position: "absolute", top: 14, left: 14, zIndex: 5 }}>
                  <div style={{
                    background: DS.void + "c0", backdropFilter: "blur(12px)",
                    border: `1px solid ${DS.rim}`, borderRadius: 10, padding: "5px 12px",
                    display: "flex", alignItems: "center", gap: 7,
                  }}>
                    <span style={{ fontSize: 13 }}>{matchInfo.opponent?.flag || "🌍"}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.plat, letterSpacing: 0.3 }}>
                      {matchInfo.opponent?.username || "stranger"}
                    </span>
                    {webrtc.remoteConnected && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: DS.ice, flexShrink: 0 }} />
                    )}
                  </div>
                </div>

                {/* Points on the line — top right */}
                <div style={{ position: "absolute", top: 14, right: 14, zIndex: 5 }}>
                  <div style={{
                    background: DS.void + "c0", backdropFilter: "blur(12px)",
                    border: `1px solid ${DS.rim}`, borderRadius: 10, padding: "4px 10px",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: DS.ash, letterSpacing: 1.5,
                  }}>STRANGER</div>
                </div>
              </div>

              {/* ── DIVIDER — flat, no glow ── */}
              <div style={{
                height: 1, flexShrink: 0, background: DS.rim,
                position: "relative", zIndex: 6,
              }}>
                {/* Center dot — like a perforation hole on a ticket */}
                <div style={{
                  position: "absolute", left: "50%", top: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 28, height: 28, borderRadius: "50%",
                  background: DS.void, border: `1px solid ${DS.rim}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: DS.signal }} />
                </div>
              </div>

              {/* ── BOTTOM HALF — YOU ── */}
              <div style={{ flex: 1, position: "relative", background: DS.surface2, overflow: "hidden" }}>
                {/*
                  LOCAL VIDEO REF CALLBACK:
                  When matchPhase switches idle→connected, React unmounts the idle
                  <video> and mounts this new one. stream state hasn't changed, so
                  useEffect([stream]) does NOT re-fire — new element never gets
                  srcObject. The ref callback fires on every mount and immediately
                  assigns the stream. This is the real fix for the black camera.
                */}
                <video
                  ref={el => { webrtc.localRef.current = el; if (el && webrtc.stream) { el.srcObject = webrtc.stream; el.play().catch(() => {}); } }}
                  autoPlay muted playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }}
                />

                {/* Camera off overlay */}
                {webrtc.camOff && (
                  <div style={{ position: "absolute", inset: 0, background: DS.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 28, color: DS.ghost }}>📷</span>
                  </div>
                )}

                {/* YOU label — top left */}
                <div style={{ position: "absolute", top: 14, left: 14, zIndex: 5 }}>
                  <div style={{
                    background: DS.void + "c0", backdropFilter: "blur(12px)", borderRadius: 10,
                    border: `1px dashed ${DS.rim}`, padding: "4px 10px",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: DS.ash, letterSpacing: 1.5,
                  }}>YOU</div>
                </div>

                {/* ── BOTTOM OVERLAY — game pills + controls ──
                    Lives INSIDE the bottom half, not fixed to screen bottom.
                    This is what prevents the bottom nav from covering it —
                    the nav is hidden during calls (see nav condition), and
                    these controls fill the freed space naturally.
                */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
                  padding: "0 16px 16px",
                  background: `linear-gradient(to top, ${DS.void}f0 0%, ${DS.void}99 60%, transparent 100%)`,
                }}>

                  {/* Game pills — horizontal scroll on small screens */}
                  <div style={{ marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
                    <div style={{ display: "flex", gap: 7, width: "max-content" }}>
                      {[
                        { id: "dontlaugh",     emoji: "😐", label: "Don't Laugh" },
                        { id: "vibecheck",     emoji: "🎭", label: "Vibe Check"  },
                        { id: "mirrorme",      emoji: "🪞", label: "Mirror Me"   },
                        { id: "hottake",       emoji: "🌶️", label: "Hot Take"    },
                        { id: "echo",          emoji: "🔊", label: "Echo"        },
                        { id: "finishmystory", emoji: "📖", label: "Story"       },
                      ].map(g => (
                        <button
                          key={g.id}
                          onClick={() => socket.emit("proposeGame", { roomId: matchInfo.roomId, game: g.id })}
                          style={{
                            background: DS.surface,
                            border: `1px dashed ${DS.rimHov}`,
                            padding: "6px 13px",
                            color: DS.plat, fontSize: 11,
                            fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3,
                            cursor: "pointer", whiteSpace: "nowrap",
                            transition: "border-color 0.15s, color 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = DS.signal; e.currentTarget.style.color = DS.signal; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = DS.rimHov; e.currentTarget.style.color = DS.plat; }}
                        >
                          {g.emoji} {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Controls row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>

                    {/* Mute */}
                    <button onClick={webrtc.toggleMute} title={webrtc.muted ? "Unmute" : "Mute"} style={{
                      width: 42, height: 42,
                      background: webrtc.muted ? DS.live : DS.surface,
                      border: `1px solid ${webrtc.muted ? DS.live : DS.rim}`,
                      cursor: "pointer", fontSize: 16, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {webrtc.muted ? "🔇" : "🎤"}
                    </button>

                    {/* Cam */}
                    <button onClick={webrtc.toggleCam} title={webrtc.camOff ? "Show camera" : "Hide camera"} style={{
                      width: 42, height: 42,
                      background: webrtc.camOff ? DS.live : DS.surface,
                      border: `1px solid ${webrtc.camOff ? DS.live : DS.rim}`,
                      cursor: "pointer", fontSize: 16, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {webrtc.camOff ? "🚫" : "📷"}
                    </button>

                    {/*
                      NEXT — brass/signal color. This is the primary call action.
                      Pressing NEXT = skip to a new random stranger immediately.
                      NOT a red hang-up. The verb is "next", not "end".
                    */}
                    <button
                      onClick={() => {
                        socket.emit("match:leave", { roomId: matchInfo.roomId });
                        webrtc.closePeer();
                        startSearch(); // straight back into matchmaking
                      }}
                      style={{
                        height: 42, padding: "0 28px",
                        background: DS.signal, border: "none", cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, 
                        fontSize: 14, color: DS.void, letterSpacing: 0.3,
                        flexShrink: 0,
                        transition: "transform 0.15s, box-shadow 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                    >
                      NEXT →
                    </button>

                    {/* End — small, ghost style, secondary action */}
                    <button
                      onClick={() => {
                        socket.emit("match:leave", { roomId: matchInfo.roomId });
                        webrtc.closePeer();
                        setMatchPhase("idle");
                        setMatchInfo(null);
                        setOpponentLeft(false);
                      }}
                      title="End call"
                      style={{
                        width: 42, height: 42, background: DS.surface,
                        border: `1px solid ${DS.rim}`, cursor: "pointer",
                        fontSize: 15, color: DS.ash, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "border-color 0.15s, color 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = DS.live; e.currentTarget.style.color = DS.live; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = DS.rim; e.currentTarget.style.color = DS.ash; }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {/* ── GAME PROPOSAL TOAST ── */}
              {proposedGame && !gameAccepted && (
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(0,0,0,0.9)", backdropFilter: "blur(16px)",
                  border: `1px solid ${DS.signal}66`,
                  borderRadius: 16, padding: "18px 24px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                  zIndex: 30, minWidth: 200, textAlign: "center",
                }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: DS.ash, letterSpacing: 2 }}>WANTS TO PLAY</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: DS.signal }}>
                    {proposedGame.replace(/_/g, " ").toUpperCase()}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        socket.emit("acceptGame", { roomId: matchInfo.roomId, game: proposedGame });
                        setProposedGame(null);
                      }}
                      style={{ background: DS.signal, color: DS.void, border: "none", borderRadius: 14, padding: "9px 20px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={() => setProposedGame(null)}
                      style={{ background: "transparent", color: DS.ash, border: `1px solid ${DS.rim}`, borderRadius: 14, padding: "9px 14px", fontSize: 12, cursor: "pointer" }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Opponent left overlay */}
              {opponentLeft && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "50%", background: "rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 20 }}>
                  <div style={{ fontSize: 36 }}>👋</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: DS.live }}>Stranger left</div>
                  <button
                    onClick={startSearch}
                    style={{ background: DS.signal, color: DS.void, border: "none", borderRadius: 10, padding: "10px 24px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                  >
                    Find another →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════
          RANKS / LEADERBOARD
      ══════════════════════════════ */}
      {page === "ranks" && (
        <div style={{ position: "relative", zIndex: 1, padding: "clamp(80px,12vw,100px) clamp(16px,5vw,60px) 120px", maxWidth: 860, margin: "0 auto" }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 4, marginBottom: 12, textTransform: "uppercase" }}>
              // who's winning rn
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "clamp(34px,6vw,54px)", letterSpacing: -0.5 }}>
              <Signal>Leaderboard</Signal>
            </h2>
          </div>

          <div className="sp-card" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 100px 72px", padding: "10px 20px", borderBottom: `1px solid ${DS.rim}`, fontSize: 10, color: DS.ash, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              <span /><span>Player</span><span>Points</span><span className="lb-wins">Wins</span>
            </div>
            {leaderboard.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: DS.ash, fontSize: 13 }}>
                {lbLoading ? "Loading real rankings…" : "Nobody's played yet — be the first on the board."}
              </div>
            ) : leaderboard.map((r, i) => (
              <LBRow key={r._id || r.username} rank={i + 1} name={r.username} flag={r.flag} pts={r.points} wins={r.wins}
                isMe={user && r.username === user.username} delay={i * 0.07} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          OTHER PAGES — pass user + points (BUG FIX #3)
      ══════════════════════════════ */}

      {/* BUG FIX #1 + #3: onLogin={handleLogin} passed, user+points forwarded */}
      {page === "login" && (
        <LoginSignup onNavigate={goTo} onLogin={handleLogin} />
      )}

      {/* BUG FIX #3: user and points now passed to Profile */}
      {page === "profile" && (
        <Profile onNavigate={goTo} user={user} points={points} onUserUpdate={handleLogin} />
      )}

      {page === "rewards"  && <Rewards  onNavigate={goTo} />}
      {page === "settings" && <Settings onNavigate={goTo} user={user} onUserUpdate={handleLogin} theme={theme} onToggleTheme={toggleTheme} />}

      {/* GameScreen — only renders on real match */}
      {page === "gamescreen" && matchPhase === "connected" && matchInfo ? (
        <GameScreen
          gameMode={matchInfo.gameMode}
          roomId={matchInfo.roomId}
          role={matchInfo.role}
          opponent={matchInfo.opponent}
          entryFee={matchInfo.entryFee}
          myPoints={points}
          myUsername={user?.username || "anon"}
          myFlag={user?.flag || "🌍"}
          onBack={() => { setMatchPhase("idle"); setMatchInfo(null); goTo("play"); }}
          onMatchEnd={(won, fee) => {
            const delta = won ? fee : -fee;
            const newPts = Math.max(0, points + delta);
            setPoints(newPts);
            const saved = JSON.parse(localStorage.getItem("sp_user") || "{}");
            localStorage.setItem("sp_user", JSON.stringify({ ...saved, points: newPts }));
            setMatchPhase("idle");
            setMatchInfo(null);
          }}
        />
      ) : page === "gamescreen" ? (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: DS.ash }}>no active match</div>
          <button className="sp-btn-primary" style={{ padding: "12px 28px" }} onClick={() => goTo("play")}>Find a match</button>
        </div>
      ) : null}

      {/* ══════════════════════════════
          BOTTOM NAV — main pages only.
          HIDDEN during active calls (matchPhase === "connected") — the call UI
          takes the full screen and the controls live inside the bottom half.
          Showing the nav during a call would bury the NEXT button behind it.
      ══════════════════════════════ */}
      {["home", "play", "ranks", "watchlive", "golive"].includes(page) && !(page === "play" && matchPhase === "connected") && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300,
          display: "flex", justifyContent: "space-around", alignItems: "center",
          padding: "12px 8px max(16px, env(safe-area-inset-bottom))",
          background: DS.void + "ee",
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${DS.rim}`,
        }}>
          {[
            ["Home", "home"],
            ["Play", "play"],
            ["Rank", "ranks"],
            ["Watch", "watchlive"],
          ].map(([label, id]) => {
            const active = page === id;
            return (
              <div key={id} className={`sp-nav-item${active ? " active" : ""}`} onClick={() => goTo(id)} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                cursor: "pointer",
                color: active ? DS.signal : DS.ash,
                fontFamily: "'Space Grotesk', sans-serif",
                fontStyle: active ? "italic" : "normal",
                fontWeight: 600,
                fontSize: 13,
                padding: "4px 18px",
                transition: "color 0.2s",
                minWidth: 56,
              }}>
                {label}
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
}