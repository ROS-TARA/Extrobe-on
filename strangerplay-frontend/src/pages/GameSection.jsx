import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   CONSTANTS — Floppy Face Race game settings
───────────────────────────────────────────── */
const PIPE_WIDTH      = 65;
const PIPE_GAP        = 210;
const BASE_SPEED      = 3;
const BOOST_SPEED     = 8;
const BOOST_DECAY     = 0.92;
const NOISE_THRESHOLD = 18;
const CDN_TF          = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js";
const CDN_BLAZE       = "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js";

const BG = `linear-gradient(to right,#141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,#1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,#262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,#303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{color:#f0eeea;font-family:'Syne',sans-serif;}
@keyframes fadeUp    {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse     {0%,100%{opacity:1}50%{opacity:.35}}
@keyframes glowPulse {0%,100%{box-shadow:0 0 20px #00f5a044}50%{box-shadow:0 0 50px #00f5a099}}
@keyframes spinRing  {to{transform:rotate(360deg)}}
@keyframes floatUp   {0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-80px)}}
@keyframes cd        {0%{transform:scale(1.5);opacity:0}15%{opacity:1;transform:scale(1)}85%{opacity:1}100%{transform:scale(.5);opacity:0}}
@keyframes shimmer   {to{background-position:200% center}}
@keyframes cardIn    {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
`;

/* ─────────────────────────────────────────────
   ALL GAMES DATA
   Single source of truth for the lobby grid.
   To add a new game → add one entry here.
───────────────────────────────────────────── */
const ALL_GAMES = [
  {
    id: "floppy",
    emoji: "🐦",
    title: "FLOPPY FACE RACE",
    desc: "your face is the bird. tilt to dodge pipes. shout to boost.",
    color: "#00f5a0",
    pts: 15,
    tag: "AR • CAMERA",
    delay: 0,
  },
  {
    id: "dont_laugh",
    emoji: "😐",
    title: "DON'T LAUGH",
    desc: "keep a straight face while your stranger loses it.",
    color: "#00d4ff",
    pts: 10,
    tag: "FACE CAM",
    delay: 0.06,
  },
  {
    id: "vibe_check",
    emoji: "🎭",
    title: "VIBE CHECK",
    desc: "be a grandma, robot, or demon. crowd votes the winner.",
    color: "#ff4d6d",
    pts: 12,
    tag: "CROWD VOTE",
    delay: 0.12,
  },
  {
    id: "hot_take",
    emoji: "🌶️",
    title: "HOT TAKE",
    desc: "wild opinion. react in 5 seconds. crowd judges your face.",
    color: "#ffd60a",
    pts: 6,
    tag: "QUICK FIRE",
    delay: 0.18,
  },
  {
    id: "mirror_me",
    emoji: "🪞",
    title: "MIRROR ME",
    desc: "copy your stranger's expression exactly. crowd scores the match.",
    color: "#a064ff",
    pts: 8,
    tag: "CROWD VOTE",
    delay: 0.24,
  },
  {
    id: "speed_roast",
    emoji: "🔥",
    title: "SPEED ROAST",
    desc: "30 seconds. two strangers. crowd picks who got cooked.",
    color: "#ff9f43",
    pts: 20,
    tag: "HIGH STAKES",
    delay: 0.30,
  },
];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function addParticles(list, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    list.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      r: Math.random() * 4 + 1,
      color, life: 30, maxLife: 30,
    });
  }
}

function drawPipe(ctx, p, h) {
  const grd = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
  grd.addColorStop(0, "rgba(10,50,28,0.82)");
  grd.addColorStop(0.5, "rgba(20,90,50,0.88)");
  grd.addColorStop(1, "rgba(8,36,20,0.82)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_WIDTH, p.topH - 10, [0, 0, 8, 8]); ctx.fill();
  ctx.fillRect(p.x - 6, p.topH - 28, PIPE_WIDTH + 12, 22);
  const bot = p.topH + PIPE_GAP;
  ctx.beginPath(); ctx.roundRect(p.x, bot + 10, PIPE_WIDTH, h - bot - 10, [8, 8, 0, 0]); ctx.fill();
  ctx.fillRect(p.x - 6, bot + 4, PIPE_WIDTH + 12, 22);
  ctx.strokeStyle = "rgba(0,245,160,0.55)"; ctx.lineWidth = 1.5;
  ctx.shadowColor = "#00f5a0"; ctx.shadowBlur = 8;
  ctx.strokeRect(p.x, 0, PIPE_WIDTH, p.topH);
  ctx.strokeRect(p.x, bot, PIPE_WIDTH, h - bot);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,245,160,0.04)";
  ctx.fillRect(p.x, p.topH, PIPE_WIDTH, PIPE_GAP);
}

function drawBirdDecor(ctx, cx, cy, size, tilt, alive, boosting) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  const col = alive ? (boosting ? "#ffd60a" : "#00f5a0") : "#ff4d6d";
  ctx.beginPath(); ctx.arc(0, 0, size / 2 + 8, 0, Math.PI * 2);
  ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(0, 0, size / 2 + 2, 0, Math.PI * 2);
  ctx.strokeStyle = col + "66"; ctx.lineWidth = 1; ctx.stroke();
  const wingFlap = Math.sin(Date.now() * 0.01) * 0.3;
  ctx.save(); ctx.rotate(-0.4 + wingFlap);
  ctx.fillStyle = col + "55"; ctx.beginPath();
  ctx.ellipse(-size / 2 - 10, 0, 22, 10, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.rotate(0.4 - wingFlap);
  ctx.fillStyle = col + "55"; ctx.beginPath();
  ctx.ellipse(size / 2 + 10, 0, 22, 10, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  if (boosting) {
    ctx.strokeStyle = "rgba(255,214,10,0.5)"; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const ly = (i - 1.5) * 14; const len = 20 + Math.random() * 20;
      ctx.beginPath(); ctx.moveTo(-size / 2 - 14, ly); ctx.lineTo(-size / 2 - 14 - len, ly); ctx.stroke();
    }
  }
  ctx.restore();
}

/* ─────────────────────────────────────────────
   LOBBY — game selection grid
   This is the first screen when you open Games.
   Instant load — no camera, no AI, nothing heavy.
───────────────────────────────────────────── */
function Lobby({ onSelect, onBack, myPoints }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Syne',sans-serif", color: "#f0eeea" }}>
      <style>{CSS}</style>

      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 58, padding: "0 clamp(12px,4vw,36px)",
        background: "rgba(14,14,15,0.92)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "linear-gradient(135deg,#00f5a0,#00d4ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, animation: "glowPulse 3s infinite",
          }}>▶</div>
          <span style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3,
            background: "linear-gradient(90deg,#00f5a0,#00d4ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>StrangerPlay</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#333", marginLeft: 6 }}>// pick a game</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#ffd60a",
            background: "rgba(255,214,10,0.07)", border: "1px solid rgba(255,214,10,0.14)",
            borderRadius: 20, padding: "3px 12px", display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ffd60a", animation: "pulse 2s infinite" }} />
            {myPoints} pts
          </div>
          {onBack && (
            <button onClick={onBack} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "6px 16px", color: "#555",
              fontFamily: "'Syne',sans-serif", fontSize: 13, cursor: "pointer",
            }}>← back</button>
          )}
        </div>
      </nav>

      <div style={{ padding: "48px clamp(16px,5vw,60px) 0" }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#444", letterSpacing: 4, marginBottom: 10 }}>// six ways to embarrass a stranger</div>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(36px,7vw,64px)", letterSpacing: 2, lineHeight: 1, marginBottom: 6 }}>
          PICK A{" "}
          <span style={{ background: "linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GAME</span>
        </h1>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#444", marginBottom: 40 }}>
          entry fee deducted at match start · winner takes both
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
        padding: "0 clamp(16px,5vw,60px) 80px",
      }}>
        {ALL_GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => onSelect(g.id)}
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "24px 20px",
              cursor: "pointer", textAlign: "left", color: "#f0eeea",
              transition: "border-color .2s, transform .15s, background .2s",
              animation: `cardIn .5s ${g.delay}s both`,
              position: "relative", overflow: "hidden",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = g.color + "55";
              e.currentTarget.style.background = g.color + "08";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
              e.currentTarget.style.background = "rgba(255,255,255,0.025)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{
              position: "absolute", top: -30, right: -30,
              width: 100, height: 100, borderRadius: "50%",
              background: `radial-gradient(circle, ${g.color}18, transparent 70%)`,
              pointerEvents: "none",
            }} />
            <div style={{
              display: "inline-block",
              fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
              color: g.color, background: g.color + "15",
              border: `1px solid ${g.color}33`,
              borderRadius: 20, padding: "2px 10px",
              letterSpacing: 1, marginBottom: 14,
            }}>{g.tag}</div>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{g.emoji}</div>
            <div style={{
              fontFamily: "'Bebas Neue',sans-serif",
              fontSize: "clamp(20px,3vw,26px)",
              letterSpacing: 2, color: g.color,
              marginBottom: 8, lineHeight: 1,
            }}>{g.title}</div>
            <p style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11, color: "#555",
              lineHeight: 1.6, marginBottom: 16,
            }}>{g.desc}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                color: "#ffd60a", background: "rgba(255,214,10,0.08)",
                border: "1px solid rgba(255,214,10,0.2)",
                borderRadius: 20, padding: "3px 10px",
              }}>up to +{g.pts}pts</span>
              <span style={{
                fontFamily: "'Bebas Neue',sans-serif", fontSize: 16,
                color: g.color, letterSpacing: 2,
              }}>PLAY →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMING SOON
   For games not built yet — shows instead of blank.
───────────────────────────────────────────── */
function ComingSoon({ game, onBack }) {
  return (
    <div style={{
      minHeight: "100vh", background: BG,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne',sans-serif", color: "#f0eeea", gap: 20, padding: 24,
    }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 64 }}>{game.emoji}</div>
      <div style={{
        fontFamily: "'Bebas Neue',sans-serif",
        fontSize: "clamp(36px,8vw,64px)",
        color: game.color, letterSpacing: 3, textAlign: "center",
      }}>{game.title}</div>
      <div style={{
        fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
        color: "#444", letterSpacing: 2, textAlign: "center",
      }}>// being built. check back soon.</div>
      <button onClick={onBack} style={{
        marginTop: 16,
        fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2,
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, padding: "12px 32px", color: "#f0eeea", cursor: "pointer",
      }}>← BACK TO GAMES</button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FLOPPY FACE RACE — full AR game
   Only mounts (and loads TensorFlow + camera)
   when you actually pick this game from the lobby.
───────────────────────────────────────────── */
function FloppyFaceRace({ onBack, myPoints = 74, opponentName = "stranger_7829", opponentFlag = "🇧🇷" }) {
  const [screen,     setScreen]     = useState("init");
  const [status,     setStatus]     = useState("Starting camera...");
  const [score,      setScore]      = useState(0);
  const [oppScore,   setOppScore]   = useState(0);
  const [best,       setBest]       = useState(0);
  const [countdown,  setCountdown]  = useState(3);
  const [boosting,   setBoosting]   = useState(false);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [reactions,  setReactions]  = useState([]);
  const [won,        setWon]        = useState(null);

  const canvasRef   = useRef(null);
  const videoRef    = useRef(null);
  const animRef     = useRef(null);
  const modelRef    = useRef(null);
  const analyserRef = useRef(null);
  const noiseArr    = useRef(null);
  const noiseLvlRef = useRef(0);

  const gameRef = useRef({
    pipes: [], score: 0, frame: 0,
    birdY: 0, birdCX: 0, birdCY: 0, birdSize: 80,
    alive: true, speed: BASE_SPEED, boosting: false,
    particles: [], headY: 0.5, headTilt: 0, faceSize: 80,
  });

  /* camera + mic + AI model setup */
  useEffect(() => {
    let stream;
    (async () => {
      try {
        setStatus("Requesting camera...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: true,
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch {
        setStatus("❌ Camera denied. Allow access then refresh.");
        return;
      }
      try {
        const ac = new AudioContext();
        const src = ac.createMediaStreamSource(stream);
        const analyser = ac.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
        noiseArr.current = new Uint8Array(analyser.frequencyBinCount);
      } catch {}
      setStatus("Loading face tracker (first time ~15s)...");
      try {
        await loadScript(CDN_TF);
        await loadScript(CDN_BLAZE);
        if (!window._faceModel) window._faceModel = await window.blazeface.load();
        modelRef.current = window._faceModel;
        setStatus("✅ Face locked. Position yourself in frame.");
        setScreen("ready");
      } catch {
        setStatus("⚠️ AI failed. Playing in keyboard mode (arrow keys).");
        setScreen("ready");
      }
    })();
    return () => {
      cancelAnimationFrame(animRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const getMicVolume = useCallback(() => {
    if (!analyserRef.current || !noiseArr.current) return 0;
    analyserRef.current.getByteFrequencyData(noiseArr.current);
    const sum = noiseArr.current.reduce((a, b) => a + b, 0);
    return Math.min(100, (sum / noiseArr.current.length) * 2.5);
  }, []);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    const canvas = canvasRef.current;
    const W = canvas.width  || 640;
    const H = canvas.height || 480;
    g.pipes = []; g.score = 0; g.frame = 0;
    g.alive = true; g.speed = BASE_SPEED; g.boosting = false;
    g.particles = [];
    // Start bird in the CENTER of the canvas so it doesn't
    // immediately trigger outOfBounds (which was the instant-death bug).
    g.birdCX = W * 0.35;
    g.birdCY = H / 2;
    g.headY  = 0.5;
    g.faceSize = 80;
    g.headTilt = 0;
    // Grace frames — collision is disabled for the first 90 frames (~1.5s)
    // so the player has time to get their face in frame.
    g.graceFrames = 90;
    setScore(0); setOppScore(0); setWon(null);
    setScreen("countdown");
    let c = 3; setCountdown(c);
    const iv = setInterval(() => {
      c--; setCountdown(c);
      if (c <= 0) { clearInterval(iv); setScreen("playing"); }
    }, 1000);
  }, []);

  /* ── GAME LOOP ──────────────────────────────────────────────────────
     ROOT CAUSE OF "bird doesn't move":
     The loop was async and used "await estimateFaces()" inside
     requestAnimationFrame. rAF does NOT await async functions —
     it fires the callback, hits the await, and immediately schedules
     the next frame without waiting for face data. Result: targetCY
     never updates because the await resolves after rAF already moved on.

     FIX: split into two completely separate loops:
       1. faceLoop  — runs on setInterval(33ms ≈ 30fps), purely async,
                      writes headY + targetCX/targetCY to gameRef
       2. renderLoop — pure sync rAF, reads from gameRef and draws.
                       No async, no awaits, never blocks.
     They share data through gameRef (a mutable ref = no re-renders).

     KEYBOARD FALLBACK: arrow keys + mouse/touch move the bird when
     face tracking doesn't detect you. So the game is always playable.
  ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const W = canvas.width  || canvas.offsetWidth  || 640;
    const H = canvas.height || canvas.offsetHeight || 480;
    const g = gameRef.current;

    // Separate mutable tracking state — written by faceLoop, read by renderLoop
    // Using a plain object (not state) so writes are instant, no re-renders
    const track = {
      targetCX: g.birdCX,
      targetCY: g.birdCY,
      faceDetected: false,
      keyUp: false,
      keyDown: false,
    };

    // ── KEYBOARD FALLBACK ─────────────────────────────────────────
    // Arrow keys move the bird when face tracking misses you
    const onKey = (e) => {
      if (e.type === "keydown") {
        if (e.key === "ArrowUp"   || e.key === "w") track.keyUp   = true;
        if (e.key === "ArrowDown" || e.key === "s") track.keyDown = true;
      } else {
        if (e.key === "ArrowUp"   || e.key === "w") track.keyUp   = false;
        if (e.key === "ArrowDown" || e.key === "s") track.keyDown = false;
      }
    };
    // Mouse/touch move on the canvas — drag the bird
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const relY = clientY - rect.top;
      track.targetCY = Math.max(80, Math.min(H - 80, relY));
      track.faceDetected = true; // treat mouse as "face found"
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup",   onKey);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchmove", onMouseMove, { passive: true });

    // ── FACE DETECTION LOOP (async, 30fps) ────────────────────────
    // Completely separate from render. Writes to track{} object.
    // rAF never touches this — no await contamination.
    const faceInterval = setInterval(async () => {
      if (!modelRef.current) return;
      const vid = videoRef.current;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0) return;

      try {
        const preds = await modelRef.current.estimateFaces(vid, false);
        if (preds.length > 0) {
          const face   = preds[0];
          const [x1, y1] = face.topLeft;
          const [x2, y2] = face.bottomRight;
          const faceCX   = (x1 + x2) / 2;
          const faceCY   = (y1 + y2) / 2;
          const faceH    = y2 - y1;

          // headY: 0 = top of camera feed, 1 = bottom
          const rawY = faceCY / vid.videoHeight;
          g.headY    = Math.max(0, Math.min(1, rawY));
          g.faceSize = Math.max(50, Math.min(130, faceH * 1.1));

          const lm = face.landmarks || [];
          if (lm.length >= 2) {
            g.headTilt = Math.atan2(lm[1][1] - lm[0][1], lm[1][0] - lm[0][0]);
          }

          const pad = 80;
          // Mirror X so moving head left = bird moves left on screen
          track.targetCX    = W - (faceCX / vid.videoWidth) * W;
          track.targetCY    = pad + g.headY * (H - pad * 2);
          track.faceDetected = true;
        } else {
          track.faceDetected = false;
        }
      } catch {}
    }, 33); // ~30fps for detection — fast enough, not too heavy

    // ── RENDER LOOP (sync rAF, 60fps) ─────────────────────────────
    // Pure synchronous. No async, no await. Just reads + draws.
    const renderLoop = () => {
      // Resume AudioContext if suspended (browser blocks until user gesture)
      if (analyserRef.current?.context?.state === "suspended") {
        analyserRef.current.context.resume().catch(() => {});
      }

      // Keyboard input moves targetCY directly
      const keySpeed = 6;
      if (track.keyUp)   track.targetCY = Math.max(80, track.targetCY - keySpeed);
      if (track.keyDown) track.targetCY = Math.min(H - 80, track.targetCY + keySpeed);

      // Lerp bird toward target — smooth even on missed detection frames
      g.birdCX += (track.targetCX - g.birdCX) * 0.18;
      g.birdCY += (track.targetCY - g.birdCY) * 0.18;

      // ── MIC / BOOST ─────────────────────────────────────────────
      const vol = getMicVolume();
      noiseLvlRef.current = Math.round(vol);
      setNoiseLevel(Math.round(vol));
      if (vol > NOISE_THRESHOLD) {
        g.speed    = BOOST_SPEED;
        g.boosting = true;
        setBoosting(true);
        addParticles(g.particles, g.birdCX, g.birdCY, "#ffd60a", 5);
      } else {
        g.speed    = Math.max(BASE_SPEED, g.speed * BOOST_DECAY);
        g.boosting = g.speed > BASE_SPEED + 0.5;
        setBoosting(g.boosting);
      }

      // ── PIPES ───────────────────────────────────────────────────
      g.frame++;
      if (g.frame % 90 === 0) {
        const topH = 80 + Math.random() * (H - PIPE_GAP - 120);
        g.pipes.push({ x: W + 10, topH, scored: false });
      }
      g.pipes.forEach(p => { p.x -= g.speed; });
      g.pipes = g.pipes.filter(p => p.x > -PIPE_WIDTH - 10);
      g.pipes.forEach(p => {
        if (!p.scored && p.x + PIPE_WIDTH < g.birdCX) {
          p.scored = true;
          g.score++;
          setScore(g.score);
          setOppScore(s => s + (Math.random() > 0.45 ? 1 : 0));
          addParticles(g.particles, g.birdCX, g.birdCY, "#ffd60a", 10);
        }
      });

      // ── COLLISION ───────────────────────────────────────────────
      if (g.graceFrames > 0) g.graceFrames--;
      const bs  = g.faceSize / 2 - 10;
      const hit = g.graceFrames === 0 && g.pipes.some(p => {
        const inX = g.birdCX + bs > p.x + 8 && g.birdCX - bs < p.x + PIPE_WIDTH - 8;
        const inY = g.birdCY - bs < p.topH  || g.birdCY + bs > p.topH + PIPE_GAP;
        return inX && inY;
      });
      const outOfBounds = g.graceFrames === 0 && track.faceDetected &&
        (g.birdCY - bs < 0 || g.birdCY + bs > H);

      if (hit || outOfBounds) {
        g.alive = false;
        setBest(b => Math.max(b, g.score));
        setWon(g.score >= 3);
        setScreen("dead");
        return;
      }

      // ── PARTICLES ───────────────────────────────────────────────
      g.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; });
      g.particles = g.particles.filter(p => p.life > 0);

      // ── DRAW ────────────────────────────────────────────────────
      if (videoRef.current?.readyState >= 2) {
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(0, 0, W, H);

      g.pipes.forEach(p => drawPipe(ctx, p, H));
      drawBirdDecor(ctx, g.birdCX, g.birdCY, g.faceSize, g.headTilt, g.alive, g.boosting);

      g.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
        ctx.fillStyle   = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // score display
      ctx.font        = "bold 52px 'Bebas Neue', sans-serif";
      ctx.textAlign   = "center";
      ctx.fillStyle   = "#ffffff";
      ctx.shadowColor = "#00f5a0"; ctx.shadowBlur = 16;
      ctx.fillText(g.score, W / 2, 62);
      ctx.shadowBlur  = 0;

      // face tracking status indicator (top-left, small)
      ctx.font      = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = track.faceDetected ? "rgba(0,245,160,0.7)" : "rgba(255,77,109,0.6)";
      ctx.fillText(track.faceDetected ? "● face locked" : "● no face — use mouse/arrows", 14, 24);

      // grace period flash
      if (g.graceFrames > 0) {
        ctx.fillStyle = `rgba(0,245,160,${(g.graceFrames / 90) * 0.07})`;
        ctx.fillRect(0, 0, W, H);
        ctx.font      = "12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,245,160,0.5)";
        ctx.fillText("move into frame...", W / 2, H - 20);
      }

      // noise meter
      const meterW = 140, meterH = 10, mx = 14, my = H - 38;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.roundRect(mx, my, meterW, meterH, 5); ctx.fill();
      const mCol = vol > NOISE_THRESHOLD ? "#ffd60a" : "#00f5a0";
      ctx.fillStyle   = mCol;
      ctx.shadowColor = mCol;
      ctx.shadowBlur  = vol > NOISE_THRESHOLD ? 14 : 0;
      const fillW = Math.max(0, Math.min(1, vol / 100)) * meterW;
      ctx.beginPath(); ctx.roundRect(mx, my, fillW, meterH, 5); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font       = "10px 'JetBrains Mono', monospace";
      ctx.textAlign  = "left";
      ctx.fillStyle  = "rgba(255,255,255,0.4)";
      ctx.fillText("🔊 SHOUT TO BOOST", mx, my - 6);

      if (g.boosting) {
        ctx.fillStyle = "rgba(255,214,10,0.05)"; ctx.fillRect(0, 0, W, H);
        ctx.font        = "bold 18px 'Bebas Neue', sans-serif";
        ctx.textAlign   = "right";
        ctx.fillStyle   = "#ffd60a";
        ctx.shadowColor = "#ffd60a"; ctx.shadowBlur = 14;
        ctx.fillText("⚡ BOOST", W - 14, H - 18);
        ctx.shadowBlur  = 0;
      }

      // opponent score
      ctx.font      = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillStyle  = "rgba(255,77,109,0.85)";
      ctx.fillText(`${opponentName} ${opponentFlag} : ${oppScore}`, W - 14, 44);

      animRef.current = requestAnimationFrame(renderLoop);
    };

    animRef.current = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(faceInterval);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup",   onKey);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onMouseMove);
    };
  }, [screen, opponentName, opponentFlag, oppScore, getMicVolume]);
  function addReaction(emoji) {
    const id = Date.now();
    setReactions(r => [...r, { id, emoji, x: Math.random() * 70 + 10 }]);
    setTimeout(() => setReactions(r => r.filter(rx => rx.id !== id)), 2200);
  }

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const c = canvas.parentElement;
      canvas.width = c.clientWidth; canvas.height = c.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Syne',sans-serif", color: "#f0eeea", display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      <video ref={videoRef} style={{ position: "fixed", opacity: 0, pointerEvents: "none", width: 1, height: 1 }} muted playsInline />

      <nav style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 58, padding: "0 clamp(12px,4vw,36px)",
        background: "rgba(14,14,15,0.92)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#00f5a0,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, animation: "glowPulse 3s infinite" }}>▶</div>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, background: "linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>StrangerPlay</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#333", marginLeft: 6 }}>// floppy face</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {screen === "playing" && (
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: boosting ? "#ffd60a" : "#444", transition: "color 0.2s" }}>🔊 {noiseLevel}</div>
          )}
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#ffd60a",
            background: "rgba(255,214,10,0.07)", border: "1px solid rgba(255,214,10,0.14)",
            borderRadius: 20, padding: "3px 12px", display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ffd60a", animation: "pulse 2s infinite" }} />
            {myPoints} pts
          </div>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "6px 16px", color: "#555",
            fontFamily: "'Syne',sans-serif", fontSize: 13, cursor: "pointer",
          }}>← games</button>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", gap: 12, padding: "clamp(8px,2vw,16px)", minHeight: 0 }}>
        {/* canvas area */}
        <div style={{
          flex: 1, position: "relative", borderRadius: 20, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)", minHeight: 360, background: "#090909",
        }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

          {/* INIT — loading spinner */}
          {screen === "init" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(9,9,9,0.95)", gap: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#00f5a0", borderRightColor: "#00d4ff", animation: "spinRing 1s linear infinite" }} />
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3, color: "#00f5a0" }}>SETTING UP AR</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#444", textAlign: "center", maxWidth: 280 }}>{status}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#2a2a2f" }}>// loading tensorflow + blazeface ai</div>
            </div>
          )}

          {/* READY */}
          {screen === "ready" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "rgba(9,9,9,0.82)", animation: "fadeUp 0.5s both" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(30px,6vw,52px)", letterSpacing: 3, textAlign: "center", lineHeight: 1.1 }}>
                YOUR FACE IS<br />
                <span style={{ background: "linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>THE BIRD</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300 }}>
                {[
                  ["↕️", "Tilt head UP/DOWN to move"],
                  ["📢", "Shout to BOOST speed"],
                  ["💥", "Hit a pipe = lose points"],
                  ["🏆", "Outlast the stranger to win"],
                ].map(([ic, tx]) => (
                  <div key={tx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{ic}</span>
                    <span style={{ fontSize: 13, color: "#555", lineHeight: 1.4 }}>{tx}</span>
                  </div>
                ))}
              </div>
              <button onClick={startGame} style={{
                background: "linear-gradient(135deg,#00f5a0,#00d4ff)", color: "#0a0a0a",
                border: "none", borderRadius: 14, padding: "15px 44px",
                fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3,
                cursor: "pointer", boxShadow: "0 0 40px rgba(0,245,160,0.4)", animation: "glowPulse 2.5s infinite",
              }}>START RACE</button>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#2a2a2f", letterSpacing: 2 }}>
                {opponentName} {opponentFlag} IS ALSO LIVE
              </div>
            </div>
          )}

          {/* COUNTDOWN */}
          {screen === "countdown" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", pointerEvents: "none" }}>
              <div key={countdown} style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: "clamp(80px,20vw,140px)",
                color: countdown <= 0 ? "#00f5a0" : "#ffffff",
                textShadow: `0 0 60px ${countdown <= 0 ? "rgba(0,245,160,0.9)" : "rgba(255,255,255,0.6)"}`,
                animation: "cd 1s both", lineHeight: 1,
              }}>
                {countdown <= 0 ? "GO!" : countdown}
              </div>
            </div>
          )}

          {/* DEAD / WIN */}
          {screen === "dead" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(9,9,9,0.88)", gap: 18, animation: "fadeUp 0.4s both" }}>
              <div style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: "clamp(44px,10vw,72px)",
                color: won ? "#00f5a0" : "#ff4d6d", letterSpacing: 4,
                textShadow: `0 0 40px ${won ? "rgba(0,245,160,0.6)" : "rgba(255,77,109,0.6)"}`,
                lineHeight: 1,
              }}>
                {won ? "YOU WIN 🎉" : "YOU DIED 💀"}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                {[["your score", score, "#00f5a0"], ["opponent", oppScore, "#ff4d6d"], ["best", best, "#ffd60a"]].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 20px" }}>
                    <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: c, lineHeight: 1 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 14,
                color: won ? "#ffd60a" : "#ff4d6d",
                background: won ? "rgba(255,214,10,0.08)" : "rgba(255,77,109,0.08)",
                border: `1px solid ${won ? "rgba(255,214,10,0.2)" : "rgba(255,77,109,0.2)"}`,
                borderRadius: 12, padding: "10px 24px",
              }}>
                {won ? `+${Math.floor(myPoints * 0.05)} pts earned` : `-${Math.floor(myPoints * 0.05)} pts lost`}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={startGame} style={{
                  background: "linear-gradient(135deg,#00f5a0,#00d4ff)", color: "#0a0a0a",
                  border: "none", borderRadius: 12, padding: "13px 32px",
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2,
                  cursor: "pointer", boxShadow: "0 0 30px rgba(0,245,160,0.35)",
                }}>PLAY AGAIN</button>
                <button onClick={onBack} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12, padding: "13px 24px", color: "#555",
                  fontFamily: "'Syne',sans-serif", fontSize: 14, cursor: "pointer",
                }}>← Games</button>
              </div>
            </div>
          )}

          {/* floating reactions */}
          {reactions.map(r => (
            <div key={r.id} style={{
              position: "absolute", bottom: "15%", left: `${r.x}%`,
              fontSize: 28, animation: "floatUp 2.2s forwards", pointerEvents: "none",
            }}>{r.emoji}</div>
          ))}
        </div>

        {/* right sidebar */}
        <div style={{ width: "clamp(140px,20%,200px)", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
          {/* scores */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>live scores</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#00f5a0", marginBottom: 2 }}>you 🇳🇵</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: "#00f5a0", lineHeight: 1 }}>{score}</div>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 10 }} />
            <div>
              <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 2 }}>{opponentName} {opponentFlag}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: "#ff4d6d", lineHeight: 1 }}>{oppScore}</div>
            </div>
          </div>

          {/* shout meter */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>shout meter</div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%", width: `${noiseLevel}%`,
                background: noiseLevel > NOISE_THRESHOLD ? "linear-gradient(90deg,#ffd60a,#ff9f43)" : "linear-gradient(90deg,#00f5a0,#00d4ff)",
                borderRadius: 6, transition: "width 0.1s",
              }} />
            </div>
            <div style={{ fontSize: 11, color: noiseLevel > NOISE_THRESHOLD ? "#ffd60a" : "#444", fontFamily: "'JetBrains Mono',monospace" }}>
              {noiseLevel > NOISE_THRESHOLD ? "⚡ BOOSTING!" : `${noiseLevel}/100`}
            </div>
          </div>

          {/* crowd */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14, flex: 1 }}>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>👀 crowd</div>
            {[["🧑", "alex_k"], ["👩", "priya_s"], ["🐉", "dragonz"]].map(([av, n]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{av}</div>
                <span style={{ fontSize: 11, color: "#555" }}>{n}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "#2a2a2f", marginBottom: 10 }}>+81 more</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {["😂", "🔥", "💀", "🤣", "👏", "😮"].map(e => (
                <button key={e} onClick={() => addReaction(e)} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 7, padding: "7px 0", fontSize: 15, cursor: "pointer", transition: "transform 0.15s",
                }}
                  onMouseEnter={ev => ev.currentTarget.style.transform = "scale(1.2)"}
                  onMouseLeave={ev => ev.currentTarget.style.transform = "scale(1)"}
                >{e}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT EXPORT — GameSection
   StrangerPlay_Main.jsx imports this.
   Manages which sub-screen to show:
     null      → lobby (game picker grid, instant)
     "floppy"  → Floppy Face Race AR game
     anything else → ComingSoon placeholder
───────────────────────────────────────────── */
export default function GameSection({ onBack, myPoints = 74 }) {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame === "floppy") {
    return <FloppyFaceRace onBack={() => setActiveGame(null)} myPoints={myPoints} />;
  }

  if (activeGame && activeGame !== "floppy") {
    const game = ALL_GAMES.find(g => g.id === activeGame);
    return <ComingSoon game={game} onBack={() => setActiveGame(null)} />;
  }

  return <Lobby onSelect={setActiveGame} onBack={onBack} myPoints={myPoints} />;
}
