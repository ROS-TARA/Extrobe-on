import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   GameSection.jsx — StrangerPlay
   
   WHAT THIS FILE DOES:
   This is the entire games system in one file.
   
   Structure:
     GameSection (root export)  ← StrangerPlay_Main imports this
       └─ Lobby          — game picker grid (6 cards)
       └─ FloppyFaceRace — AR bird game, camera + BlazeFace AI
       └─ DontLaugh      — keep straight face, smile = lose round
       └─ VibeCheck      — act a mood, crowd votes winner
       └─ MirrorMe       — copy a pose, AI scores accuracy
       └─ HotTake        — react to wild opinion, crowd judges
   
   CORE ARCHITECTURE RULE (never break this):
   ─────────────────────────────────────────────
   NEVER put await inside requestAnimationFrame.
   rAF fires the callback synchronously then schedules the
   next frame immediately — it does NOT wait for async work.
   Any await inside rAF resolves AFTER the next frame started.
   
   Correct pattern:
     setInterval (async) → runs BlazeFace → writes result to ref
     rAF (sync)          → reads ref → draws
   The two loops share a plain mutable ref object.
   
   FLOPPY BIRD FIX:
   Root cause: canvas.width was 0 when render loop started.
   A canvas element with CSS width:100% has a visual size but
   the canvas.width ATTRIBUTE defaults to 300 (or 0 if not set).
   All coordinate math (pipe gaps, bird position) was wrong.
   
   Fix: call canvas.getBoundingClientRect() at game start to
   read the true rendered size, then set canvas.width and
   canvas.height from that. Also read it inside faceInterval
   each tick. Lerp factor raised from 0.18 → 0.30 for snappier
   head tracking response.
───────────────────────────────────────────── */

const PIPE_WIDTH      = 60;
const PIPE_GAP        = 195;
const BASE_SPEED      = 2.8;
const BOOST_SPEED     = 7;
const BOOST_DECAY     = 0.91;
const NOISE_THRESHOLD = 15;
const CDN_TF    = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js";
const CDN_BLAZE = "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js";

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
@keyframes cardIn    {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes smileWarn {0%,100%{opacity:1;border-color:rgba(255,77,109,0.9)}50%{opacity:0.4;border-color:rgba(255,77,109,0.2)}}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
`;

const ALL_GAMES = [
  { id:"floppy",       emoji:"🐦", title:"FLOPPY FACE RACE", desc:"your face is the bird. tilt head to dodge pipes. shout to boost.",  color:"#00f5a0", pts:15, tag:"AR · CAMERA",  delay:0    },
  { id:"dont_laugh",   emoji:"😐", title:"DON'T LAUGH",      desc:"keep a straight face while your stranger loses it.",                 color:"#00d4ff", pts:10, tag:"FACE CAM",     delay:0.06 },
  { id:"vibe_check",   emoji:"🎭", title:"VIBE CHECK",       desc:"be a grandma, robot, or demon. crowd votes the winner.",             color:"#ff4d6d", pts:12, tag:"CROWD VOTE",   delay:0.12 },
  { id:"hot_take",     emoji:"🌶️", title:"HOT TAKE",         desc:"wild opinion. react in 5 seconds. crowd judges your face.",         color:"#ffd60a", pts:6,  tag:"QUICK FIRE",   delay:0.18 },
  { id:"mirror_me",    emoji:"🪞", title:"MIRROR ME",        desc:"copy your stranger's expression exactly. crowd scores the match.",   color:"#a064ff", pts:8,  tag:"CROWD VOTE",   delay:0.24 },
  { id:"speed_roast",  emoji:"🔥", title:"SPEED ROAST",      desc:"30 seconds. two strangers. crowd picks who got cooked.",            color:"#ff9f43", pts:20, tag:"HIGH STAKES",  delay:0.30 },
];

const DONT_LAUGH_PROMPTS = [
  "Imagine your grandma doing the floss dance at a funeral",
  "A cat slowly falling off a table in slow motion",
  "Your teacher trying to use TikTok for the first time",
  "A dog wearing tiny boots on a completely slippery floor",
  "Someone biting into a lemon thinking it was an orange",
  "A pigeon walking into a board meeting very confidently",
];
const VIBE_CHECK_PROMPTS = [
  "You just won the lottery but you're trying to act normal",
  "You are a robot that just discovered human emotions",
  "You are a dramatic grandma at a soap opera funeral",
  "You just bit into the sourest lemon of your entire life",
  "You are an astronaut seeing Earth from space for the first time",
  "You are a very suspicious undercover cop at a birthday party",
];
const HOT_TAKE_PROMPTS = [
  "Pineapple on pizza is actually really good",
  "Sleeping is a complete waste of a human life",
  "Cats are objectively better than dogs",
  "School should legally start at noon every single day",
  "Putting cereal before milk should be an international crime",
  "People who reply K to messages are the worst kind of people",
];
const MIRROR_ME_POSES = [
  "Raise both eyebrows as high as humanly possible",
  "Puff your cheeks out like a balloon about to pop",
  "Make the most confused face you have ever made in your life",
  "Pretend you just smelled something absolutely horrible",
  "Look as shocked as you have ever been in your entire existence",
];

/* ─── Helpers ─── */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function addParticles(list, x, y, color, n = 8) {
  for (let i = 0; i < n; i++)
    list.push({ x, y, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, r:Math.random()*4+1, color, life:30, maxLife:30 });
}
function getMouthOpen(lm) {
  if (!lm || lm.length < 4) return 0;
  const faceH = Math.abs(lm[0][1] - lm[3][1]) || 1;
  return Math.abs(lm[3][1] - lm[2][1]) / faceH;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

/* ─── Shared UI ─── */
function Spinner({ label }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
      <div style={{ width:48, height:48, borderRadius:"50%", border:"2px solid transparent", borderTopColor:"#00f5a0", borderRightColor:"#00d4ff", animation:"spinRing 1s linear infinite" }} />
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#444", textAlign:"center", maxWidth:260 }}>{label}</div>
    </div>
  );
}

function CountdownOverlay({ n }) {
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)", zIndex:10, pointerEvents:"none" }}>
      <div key={n} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(80px,20vw,140px)", color:n===0?"#00f5a0":"#fff", textShadow:`0 0 60px ${n===0?"rgba(0,245,160,0.9)":"rgba(255,255,255,0.6)"}`, animation:"cd 1s both", lineHeight:1 }}>
        {n === 0 ? "GO!" : n}
      </div>
    </div>
  );
}

function TimerRing({ seconds, total, color }) {
  const r = 26, circ = 2 * Math.PI * r;
  const danger = seconds <= 5;
  return (
    <div style={{ position:"relative", width:70, height:70, flexShrink:0 }}>
      <svg width="70" height="70" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3"/>
        <circle cx="35" cy="35" r={r} fill="none" stroke={danger ? "#ff4d6d" : color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={circ - circ * (seconds / total)}
          strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s linear, stroke 0.3s" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:danger?"#ff4d6d":"#f0eeea", animation:danger?"smileWarn 1s infinite":"none" }}>
        {seconds}
      </div>
    </div>
  );
}

function CrowdPanel({ onReact }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
      <div style={{ fontSize:10, color:"#444", letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>👀 crowd</div>
      {[["🧑","alex_k"],["👩","priya_s"],["🐉","dragonz"]].map(([av,n]) => (
        <div key={n} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
          <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>{av}</div>
          <span style={{ fontSize:11, color:"#555" }}>{n}</span>
        </div>
      ))}
      <div style={{ fontSize:10, color:"#2a2a2f", marginBottom:10 }}>+81 more</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
        {["😂","🔥","💀","🤣","👏","😮"].map(e => (
          <button key={e} onClick={() => onReact(e)}
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:7, padding:"7px 0", fontSize:15, cursor:"pointer", transition:"transform 0.15s" }}
            onMouseEnter={ev => ev.currentTarget.style.transform = "scale(1.2)"}
            onMouseLeave={ev => ev.currentTarget.style.transform = "scale(1)"}>{e}</button>
        ))}
      </div>
    </div>
  );
}

function FloatingReactions({ list }) {
  return list.map(r => (
    <div key={r.id} style={{ position:"absolute", bottom:"15%", left:`${r.x}%`, fontSize:28, animation:"floatUp 2.2s forwards", pointerEvents:"none" }}>{r.emoji}</div>
  ));
}

function MatchResult({ won, myScore, oppScore, entryFee, onPlayAgain, onBack }) {
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"rgba(9,9,9,0.93)", gap:20, animation:"fadeUp 0.4s both", zIndex:20, padding:24 }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(44px,10vw,72px)", color:won?"#00f5a0":"#ff4d6d", letterSpacing:4, textShadow:`0 0 40px ${won?"rgba(0,245,160,0.6)":"rgba(255,77,109,0.6)"}`, lineHeight:1 }}>
        {won ? "YOU WIN 🎉" : "YOU LOST 💀"}
      </div>
      <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
        {[["your score", myScore, "#00f5a0"],["opponent", oppScore, "#ff4d6d"]].map(([l,v,c]) => (
          <div key={l} style={{ textAlign:"center", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 20px" }}>
            <div style={{ fontSize:10, color:"#444", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:48, color:c, lineHeight:1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, color:won?"#ffd60a":"#ff4d6d", background:won?"rgba(255,214,10,0.08)":"rgba(255,77,109,0.08)", border:`1px solid ${won?"rgba(255,214,10,0.2)":"rgba(255,77,109,0.2)"}`, borderRadius:12, padding:"10px 24px" }}>
        {won ? `+${entryFee} pts earned` : `-${entryFee} pts lost`}
      </div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        <button onClick={onPlayAgain} style={{ background:"linear-gradient(135deg,#00f5a0,#00d4ff)", color:"#0a0a0a", border:"none", borderRadius:12, padding:"13px 32px", fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:2, cursor:"pointer" }}>PLAY AGAIN</button>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"13px 24px", color:"#555", fontFamily:"'Syne',sans-serif", fontSize:14, cursor:"pointer" }}>← Games</button>
      </div>
    </div>
  );
}

function RoundDots({ wins, losses }) {
  return (
    <div style={{ display:"flex", gap:8 }}>
      {Array.from({ length: 3 }).map((_, i) => {
        const col = i < wins ? "#00f5a0" : i < wins + losses ? "#ff4d6d" : "rgba(255,255,255,0.08)";
        return <div key={i} style={{ width:16, height:16, borderRadius:"50%", background:col, boxShadow:col.startsWith("#") ? `0 0 8px ${col}` : "none", transition:"all 0.3s" }}/>;
      })}
    </div>
  );
}

function GameNav({ title, myPoints, onBack, extra }) {
  return (
    <nav style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", height:58, padding:"0 clamp(12px,4vw,36px)", background:"rgba(14,14,15,0.92)", backdropFilter:"blur(24px)", borderBottom:"1px solid rgba(255,255,255,0.06)", zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        <div style={{ width:26, height:26, borderRadius:7, background:"linear-gradient(135deg,#00f5a0,#00d4ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, animation:"glowPulse 3s infinite" }}>▶</div>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, background:"linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>StrangerPlay</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#333", marginLeft:6 }}>// {title}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {extra}
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a", background:"rgba(255,214,10,0.07)", border:"1px solid rgba(255,214,10,0.14)", borderRadius:20, padding:"3px 12px", display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"#ffd60a", animation:"pulse 2s infinite" }} />{myPoints} pts
        </div>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"6px 16px", color:"#555", fontFamily:"'Syne',sans-serif", fontSize:13, cursor:"pointer" }}>← games</button>
      </div>
    </nav>
  );
}

function SidebarRounds({ wins, losses, opponent, entryFee, children }) {
  return (
    <div style={{ width:"clamp(140px,20%,200px)", display:"flex", flexDirection:"column", gap:10, flexShrink:0 }}>
      <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
        <div style={{ fontSize:10, color:"#444", letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>rounds</div>
        <RoundDots wins={wins} losses={losses} />
        <div style={{ fontSize:11, color:"#555", marginTop:10 }}>you {wins}–{losses}<br/><span style={{ color:"#888" }}>{opponent}</span></div>
      </div>
      {entryFee && (
        <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#444", letterSpacing:2, marginBottom:4 }}>// entry</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:"#ffd60a", lineHeight:1 }}>{entryFee}</div>
          <div style={{ fontSize:10, color:"#444", marginTop:2 }}>pts at stake</div>
        </div>
      )}
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LOBBY
═══════════════════════════════════════════════ */
function Lobby({ onSelect, onBack, myPoints }) {
  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'Syne',sans-serif", color:"#f0eeea" }}>
      <style>{CSS}</style>
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:58, padding:"0 clamp(12px,4vw,36px)", background:"rgba(14,14,15,0.92)", backdropFilter:"blur(24px)", borderBottom:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:26, height:26, borderRadius:7, background:"linear-gradient(135deg,#00f5a0,#00d4ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, animation:"glowPulse 3s infinite" }}>▶</div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, background:"linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>StrangerPlay</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#333", marginLeft:6 }}>// pick a game</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a", background:"rgba(255,214,10,0.07)", border:"1px solid rgba(255,214,10,0.14)", borderRadius:20, padding:"3px 12px", display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#ffd60a", animation:"pulse 2s infinite" }} />{myPoints} pts
          </div>
          {onBack && <button onClick={onBack} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"6px 16px", color:"#555", fontFamily:"'Syne',sans-serif", fontSize:13, cursor:"pointer" }}>← back</button>}
        </div>
      </nav>
      <div style={{ padding:"48px clamp(16px,5vw,60px) 0" }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#444", letterSpacing:4, marginBottom:10 }}>// six ways to embarrass a stranger</div>
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(36px,7vw,64px)", letterSpacing:2, lineHeight:1, marginBottom:6 }}>PICK A{" "}<span style={{ background:"linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>GAME</span></h1>
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#444", marginBottom:40 }}>entry fee deducted at match start · winner takes both</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14, padding:"0 clamp(16px,5vw,60px) 80px" }}>
        {ALL_GAMES.map(g => (
          <button key={g.id} onClick={() => onSelect(g.id)}
            style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"24px 20px", cursor:"pointer", textAlign:"left", color:"#f0eeea", transition:"border-color .2s,transform .15s,background .2s", animation:`cardIn .5s ${g.delay}s both`, position:"relative", overflow:"hidden" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=g.color+"55"; e.currentTarget.style.background=g.color+"08"; e.currentTarget.style.transform="translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.background="rgba(255,255,255,0.025)"; e.currentTarget.style.transform="translateY(0)"; }}>
            <div style={{ position:"absolute", top:-30, right:-30, width:100, height:100, borderRadius:"50%", background:`radial-gradient(circle,${g.color}18,transparent 70%)`, pointerEvents:"none" }} />
            <div style={{ display:"inline-block", fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:g.color, background:g.color+"15", border:`1px solid ${g.color}33`, borderRadius:20, padding:"2px 10px", letterSpacing:1, marginBottom:14 }}>{g.tag}</div>
            <div style={{ fontSize:32, marginBottom:10 }}>{g.emoji}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(20px,3vw,26px)", letterSpacing:2, color:g.color, marginBottom:8, lineHeight:1 }}>{g.title}</div>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#555", lineHeight:1.6, marginBottom:16 }}>{g.desc}</p>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a", background:"rgba(255,214,10,0.08)", border:"1px solid rgba(255,214,10,0.2)", borderRadius:20, padding:"3px 10px" }}>up to +{g.pts}pts</span>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:g.color, letterSpacing:2 }}>PLAY →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   FLOPPY FACE RACE
   
   THE BIG FIX:
   canvas.width (the attribute) is NOT the same as the visual size.
   When you write <canvas style={{width:"100%"}}> the canvas RENDERS
   at that width, but canvas.width itself stays at 300 (browser default).
   
   That means when we read:
     const W = canvas.width || 640;  ← this was always 300!
   
   All pipe positions, bird positions, collision math was calculated
   for a 300px canvas but drawn on a 600px one. Everything was off.
   
   Fix: getBoundingClientRect() gives us the real CSS rendered size.
   We set canvas.width = rect.width at game start AND inside the face
   interval so it stays in sync after resize.
═══════════════════════════════════════════════ */
function FloppyFaceRace({ onBack, myPoints = 74 }) {
  const OPP_NAME = "stranger_7829";
  const OPP_FLAG = "🇧🇷";

  const [screen,     setScreen]    = useState("init");
  const [status,     setStatus]    = useState("Starting camera...");
  const [score,      setScore]     = useState(0);
  const [oppScore,   setOppScore]  = useState(0);
  const [best,       setBest]      = useState(0);
  const [countdown,  setCountdown] = useState(3);
  const [boosting,   setBoosting]  = useState(false);
  const [noiseLevel, setNoiseLevel]= useState(0);
  const [reactions,  setReactions] = useState([]);
  const [won,        setWon]       = useState(null);

  const canvasRef   = useRef(null);
  const videoRef    = useRef(null);
  const animRef     = useRef(null);
  const modelRef    = useRef(null);
  const analyserRef = useRef(null);
  const noiseArr    = useRef(null);

  /* All mutable game state — plain object, zero React re-renders per frame */
  const g = useRef({
    pipes:[], score:0, frame:0,
    birdX:200, birdY:200, birdSize:80,
    alive:true, speed:BASE_SPEED, boosting:false,
    particles:[], graceFrames:90,
  });

  /*
    track: written by faceInterval every 33ms
           read by renderLoop every frame (~16ms)
    Plain object, never setState — instant reads, no re-render cost
  */
  const track = useRef({ targetX:200, targetY:200, faceDetected:false, keyUp:false, keyDown:false });

  /* Camera + mic + AI setup */
  useEffect(() => {
    let stream;
    (async () => {
      try {
        setStatus("Requesting camera...");
        stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480, facingMode:"user" }, audio:true });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch {
        setStatus("❌ Camera denied. Allow camera access then refresh.");
        return;
      }
      try {
        const ac = new AudioContext();
        const src = ac.createMediaStreamSource(stream);
        const an = ac.createAnalyser(); an.fftSize = 256;
        src.connect(an); analyserRef.current = an;
        noiseArr.current = new Uint8Array(an.frequencyBinCount);
      } catch {}
      setStatus("Loading face tracker... (first time ~15s)");
      try {
        await loadScript(CDN_TF);
        await loadScript(CDN_BLAZE);
        if (!window._faceModel) window._faceModel = await window.blazeface.load();
        modelRef.current = window._faceModel;
        setStatus("✅ Face locked. Press START when ready.");
      } catch {
        setStatus("⚠️ AI unavailable — use arrow keys or drag mouse.");
      }
      setScreen("ready");
    })();
    return () => {
      cancelAnimationFrame(animRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const getMicVol = useCallback(() => {
    if (!analyserRef.current || !noiseArr.current) return 0;
    analyserRef.current.getByteFrequencyData(noiseArr.current);
    return Math.min(100, (noiseArr.current.reduce((a,b) => a+b, 0) / noiseArr.current.length) * 2.5);
  }, []);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    /*
      KEY FIX: Read the real rendered size from getBoundingClientRect.
      This is the CSS pixel size the canvas is actually displayed at.
      Then we set canvas.width = rect.width to make the drawing buffer
      match the display size. Without this, all math is wrong.
    */
    const rect = canvas.getBoundingClientRect();
    const W = Math.round(rect.width)  || 640;
    const H = Math.round(rect.height) || 480;
    canvas.width  = W;
    canvas.height = H;

    const state = g.current;
    state.pipes=[]; state.score=0; state.frame=0;
    state.alive=true; state.speed=BASE_SPEED; state.boosting=false;
    state.particles=[]; state.graceFrames=90; state.birdSize=80;
    state.birdX = W * 0.3;
    state.birdY = H / 2;
    track.current.targetX = state.birdX;
    track.current.targetY = state.birdY;
    track.current.faceDetected = false;

    setScore(0); setOppScore(0); setWon(null);
    setScreen("countdown");
    let c = 3; setCountdown(c);
    const iv = setInterval(() => { c--; setCountdown(c); if (c <= 0) { clearInterval(iv); setScreen("playing"); } }, 1000);
  }, []);

  /* Main game loop — only mounts when screen === "playing" */
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const state  = g.current;
    const tr     = track.current;

    /* Keyboard control */
    const onKey = e => {
      const dn = e.type === "keydown";
      if (e.key === "ArrowUp"   || e.key === "w") tr.keyUp   = dn;
      if (e.key === "ArrowDown" || e.key === "s") tr.keyDown = dn;
    };
    /* Mouse / touch drag — acts like face tracking */
    const onPointer = e => {
      const rect   = canvas.getBoundingClientRect();
      const cY = e.touches ? e.touches[0].clientY : e.clientY;
      const cX = e.touches ? e.touches[0].clientX : e.clientX;
      tr.targetY = Math.max(60, Math.min(canvas.height - 60, cY - rect.top));
      tr.targetX = Math.max(60, Math.min(canvas.width  - 60, cX - rect.left));
      tr.faceDetected = true;
    };
    window.addEventListener("keydown",   onKey);
    window.addEventListener("keyup",     onKey);
    canvas.addEventListener("mousemove", onPointer);
    canvas.addEventListener("touchmove", onPointer, { passive:true });

    /*
      FACE DETECTION INTERVAL — async, 30fps, completely separate from render.
      Writes to track.current. Never touches React state.
      rAF never waits for this — that's the point.
    */
    const faceIv = setInterval(async () => {
      if (!modelRef.current) return;
      const vid = videoRef.current;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0) return;
      try {
        const preds = await modelRef.current.estimateFaces(vid, false);
        if (preds.length > 0) {
          const f = preds[0];
          const [x1, y1] = f.topLeft;
          const [x2, y2] = f.bottomRight;
          const vw = vid.videoWidth, vh = vid.videoHeight;
          /* Re-read canvas size each tick — stays correct after resize */
          const W = canvas.width || 640;
          const H = canvas.height || 480;
          const faceCX = (x1 + x2) / 2;
          const faceCY = (y1 + y2) / 2;
          const pad = 70;
          /* Mirror X: camera is mirrored so face-left = screen-right */
          tr.targetX = Math.max(60, Math.min(W - 60, W - (faceCX / vw) * W));
          tr.targetY = Math.max(60 + pad, Math.min(H - 60, pad + (faceCY / vh) * (H - pad * 2)));
          tr.faceDetected = true;
          /* Update bird visual size from face size */
          state.birdSize = Math.max(50, Math.min(120, (y2 - y1) * 1.1));
        } else {
          tr.faceDetected = false;
        }
      } catch {}
    }, 33);

    /*
      RENDER LOOP — pure synchronous rAF. No async, no await anywhere.
      Reads from track.current which faceIv keeps updated.
      These two loops run independently — that is the entire architecture.
    */
    const renderLoop = () => {
      /* Resume AudioContext (browser suspends until user gesture) */
      if (analyserRef.current?.context?.state === "suspended")
        analyserRef.current.context.resume().catch(() => {});

      const W = canvas.width  || 640;
      const H = canvas.height || 480;

      /* Keyboard input adjusts target position */
      const ks = 7;
      if (tr.keyUp)   tr.targetY = Math.max(60,    tr.targetY - ks);
      if (tr.keyDown) tr.targetY = Math.min(H - 60, tr.targetY + ks);

      /*
        LERP — linear interpolation:
        bird moves 30% of the remaining distance each frame.
        This makes motion feel smooth even when target jumps.
        Formula: current += (target - current) * factor
        factor=0.30 is snappy enough to follow head clearly.
      */
      state.birdX += (tr.targetX - state.birdX) * 0.30;
      state.birdY += (tr.targetY - state.birdY) * 0.30;

      /* Mic boost */
      const vol = getMicVol();
      setNoiseLevel(Math.round(vol));
      if (vol > NOISE_THRESHOLD) {
        state.speed = BOOST_SPEED; state.boosting = true; setBoosting(true);
        addParticles(state.particles, state.birdX, state.birdY, "#ffd60a", 5);
      } else {
        state.speed = Math.max(BASE_SPEED, state.speed * BOOST_DECAY);
        state.boosting = state.speed > BASE_SPEED + 0.5;
        setBoosting(state.boosting);
      }

      /* Pipes */
      state.frame++;
      if (state.frame % 90 === 0) {
        const topH = 80 + Math.random() * (H - PIPE_GAP - 140);
        state.pipes.push({ x: W + 10, topH, scored:false });
      }
      state.pipes.forEach(p => { p.x -= state.speed; });
      state.pipes = state.pipes.filter(p => p.x > -PIPE_WIDTH - 10);
      state.pipes.forEach(p => {
        if (!p.scored && p.x + PIPE_WIDTH < state.birdX) {
          p.scored = true; state.score++;
          setScore(state.score);
          setOppScore(s => s + (Math.random() > 0.5 ? 1 : 0));
          addParticles(state.particles, state.birdX, state.birdY, "#ffd60a", 10);
        }
      });

      /* Grace period — no collision for first 90 frames */
      if (state.graceFrames > 0) state.graceFrames--;
      const bs  = state.birdSize / 2 - 12;
      const hit = state.graceFrames === 0 && state.pipes.some(p => {
        const inX = state.birdX + bs > p.x + 8 && state.birdX - bs < p.x + PIPE_WIDTH - 8;
        const inY = state.birdY - bs < p.topH || state.birdY + bs > p.topH + PIPE_GAP;
        return inX && inY;
      });
      const oob = state.graceFrames === 0 && (state.birdY - bs < 0 || state.birdY + bs > H);

      if (hit || oob) {
        setBest(b => Math.max(b, state.score));
        setWon(state.score > 2);
        setScreen("dead");
        return;
      }

      /* Particles */
      state.particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life--; });
      state.particles = state.particles.filter(p => p.life > 0);

      /* ── DRAW ── */
      /* Mirror the camera feed — scaleX(-1) makes it feel like a mirror */
      if (videoRef.current?.readyState >= 2) {
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = "rgba(0,0,0,0.30)"; ctx.fillRect(0, 0, W, H);

      /* Draw pipes */
      state.pipes.forEach(p => {
        const bot = p.topH + PIPE_GAP;
        const grd = ctx.createLinearGradient(p.x, 0, p.x+PIPE_WIDTH, 0);
        grd.addColorStop(0, "rgba(10,50,28,0.85)");
        grd.addColorStop(0.5, "rgba(20,90,50,0.9)");
        grd.addColorStop(1, "rgba(8,36,20,0.85)");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_WIDTH, p.topH-10, [0,0,8,8]); ctx.fill();
        ctx.fillRect(p.x-6, p.topH-28, PIPE_WIDTH+12, 22);
        ctx.beginPath(); ctx.roundRect(p.x, bot+10, PIPE_WIDTH, H-bot-10, [8,8,0,0]); ctx.fill();
        ctx.fillRect(p.x-6, bot+4, PIPE_WIDTH+12, 22);
        ctx.strokeStyle = "rgba(0,245,160,0.55)"; ctx.lineWidth = 1.5;
        ctx.shadowColor = "#00f5a0"; ctx.shadowBlur = 8;
        ctx.strokeRect(p.x, 0, PIPE_WIDTH, p.topH);
        ctx.strokeRect(p.x, bot, PIPE_WIDTH, H-bot);
        ctx.shadowBlur = 0;
      });

      /* Draw bird as glowing ring */
      const birdCol = state.boosting ? "#ffd60a" : "#00f5a0";
      ctx.save(); ctx.translate(state.birdX, state.birdY);
      ctx.beginPath(); ctx.arc(0, 0, state.birdSize/2+8, 0, Math.PI*2);
      ctx.strokeStyle = birdCol; ctx.lineWidth = 3;
      ctx.shadowColor = birdCol; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, 0, state.birdSize/2+2, 0, Math.PI*2);
      ctx.strokeStyle = birdCol+"66"; ctx.lineWidth = 1; ctx.stroke();
      if (state.boosting) {
        ctx.strokeStyle = "rgba(255,214,10,0.5)"; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const ly = (i-1.5)*14; const len = 20+Math.random()*20;
          ctx.beginPath(); ctx.moveTo(-state.birdSize/2-14, ly); ctx.lineTo(-state.birdSize/2-14-len, ly); ctx.stroke();
        }
      }
      ctx.restore();

      /* Particles */
      state.particles.forEach(p => {
        const a = p.life / p.maxLife;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r*a, 0, Math.PI*2);
        ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.fill();
      });
      ctx.globalAlpha = 1;

      /* HUD */
      ctx.font = "bold 52px 'Bebas Neue',sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#fff"; ctx.shadowColor = "#00f5a0"; ctx.shadowBlur = 16;
      ctx.fillText(state.score, W/2, 62); ctx.shadowBlur = 0;

      ctx.font = "11px 'JetBrains Mono',monospace"; ctx.textAlign = "left";
      ctx.fillStyle = tr.faceDetected ? "rgba(0,245,160,0.75)" : "rgba(255,77,109,0.7)";
      ctx.fillText(tr.faceDetected ? "● face locked" : "● no face — drag mouse / arrow keys", 14, 24);

      if (state.graceFrames > 0) {
        ctx.fillStyle = `rgba(0,245,160,${(state.graceFrames/90)*0.07})`; ctx.fillRect(0,0,W,H);
        ctx.font = "12px 'JetBrains Mono',monospace"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,245,160,0.5)"; ctx.fillText("move your head into frame...", W/2, H-20);
      }

      /* Shout meter */
      const mW=140, mH=10, mx=14, my=H-38;
      const mCol = vol > NOISE_THRESHOLD ? "#ffd60a" : "#00f5a0";
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.beginPath(); ctx.roundRect(mx,my,mW,mH,5); ctx.fill();
      ctx.fillStyle = mCol; ctx.shadowColor = mCol; ctx.shadowBlur = vol>NOISE_THRESHOLD ? 14 : 0;
      ctx.beginPath(); ctx.roundRect(mx, my, Math.max(0,Math.min(1,vol/100))*mW, mH, 5); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = "10px 'JetBrains Mono',monospace"; ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillText("🔊 SHOUT TO BOOST", mx, my-6);

      ctx.font = "12px 'JetBrains Mono',monospace"; ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,77,109,0.85)";
      ctx.fillText(`${OPP_NAME} ${OPP_FLAG} : ${oppScore}`, W-14, 44);

      animRef.current = requestAnimationFrame(renderLoop);
    };

    animRef.current = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(faceIv);
      window.removeEventListener("keydown",   onKey);
      window.removeEventListener("keyup",     onKey);
      canvas.removeEventListener("mousemove", onPointer);
      canvas.removeEventListener("touchmove", onPointer);
    };
  }, [screen, getMicVol, oppScore]);

  /* Keep canvas pixel buffer in sync with visual size on resize */
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0)  canvas.width  = Math.round(rect.width);
      if (rect.height > 0) canvas.height = Math.round(rect.height);
      g.current.birdX = canvas.width  * 0.3;
      g.current.birdY = canvas.height / 2;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const addReaction = emoji => {
    const id = Date.now();
    setReactions(r => [...r, { id, emoji, x:Math.random()*70+10 }]);
    setTimeout(() => setReactions(r => r.filter(rx => rx.id !== id)), 2200);
  };
  const entryFee = Math.max(3, Math.round(myPoints * 0.05));

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'Syne',sans-serif", color:"#f0eeea", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      <video ref={videoRef} style={{ position:"fixed", opacity:0, pointerEvents:"none", width:1, height:1 }} muted playsInline />
      <GameNav title="floppy face race" myPoints={myPoints} onBack={onBack}
        extra={screen==="playing" ? <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:boosting?"#ffd60a":"#444" }}>🔊 {noiseLevel}</div> : null}
      />
      <div style={{ flex:1, display:"flex", gap:12, padding:"clamp(8px,2vw,16px)", minHeight:0 }}>
        <div style={{ flex:1, position:"relative", borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)", minHeight:360, background:"#090909" }}>
          <canvas ref={canvasRef} style={{ width:"100%", height:"100%", display:"block" }} />

          {screen==="init" && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"rgba(9,9,9,0.96)", gap:20 }}>
              <Spinner label={status} />
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#2a2a2f" }}>// loading tensorflow + blazeface</div>
            </div>
          )}
          {screen==="ready" && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, background:"rgba(9,9,9,0.88)", animation:"fadeUp 0.5s both", padding:24 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(30px,6vw,52px)", letterSpacing:3, textAlign:"center", lineHeight:1.1 }}>YOUR FACE IS<br/><span style={{ background:"linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>THE BIRD</span></div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#444", marginBottom:4 }}>{status}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:9, maxWidth:300 }}>
                {[["↕️","Tilt head UP / DOWN to move"],["📢","Shout to BOOST speed"],["🖱️","Mouse drag also works (fallback)"],["🏆","Outlast the stranger to win"]].map(([ic,tx]) => (
                  <div key={tx} style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:18 }}>{ic}</span><span style={{ fontSize:13, color:"#555" }}>{tx}</span></div>
                ))}
              </div>
              <button onClick={startGame} style={{ background:"linear-gradient(135deg,#00f5a0,#00d4ff)", color:"#0a0a0a", border:"none", borderRadius:14, padding:"15px 44px", fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:3, cursor:"pointer", boxShadow:"0 0 40px rgba(0,245,160,0.4)", animation:"glowPulse 2.5s infinite" }}>START RACE</button>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#2a2a2f" }}>{OPP_NAME} {OPP_FLAG} IS ALSO LIVE</div>
            </div>
          )}
          {screen==="countdown" && <CountdownOverlay n={countdown} />}
          {screen==="dead" && <MatchResult won={won} myScore={score} oppScore={oppScore} entryFee={entryFee} onPlayAgain={startGame} onBack={onBack} />}
          <FloatingReactions list={reactions} />
        </div>

        <div style={{ width:"clamp(140px,20%,200px)", display:"flex", flexDirection:"column", gap:10, flexShrink:0 }}>
          <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
            <div style={{ fontSize:10, color:"#444", letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>live scores</div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, color:"#00f5a0", marginBottom:2 }}>you 🇳🇵</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:40, color:"#00f5a0", lineHeight:1 }}>{score}</div>
            </div>
            <div style={{ height:1, background:"rgba(255,255,255,0.05)", marginBottom:10 }} />
            <div>
              <div style={{ fontSize:11, color:"#ff4d6d", marginBottom:2 }}>{OPP_NAME} {OPP_FLAG}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:40, color:"#ff4d6d", lineHeight:1 }}>{oppScore}</div>
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
            <div style={{ fontSize:10, color:"#444", letterSpacing:3, textTransform:"uppercase", marginBottom:10 }}>shout meter</div>
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:6, height:8, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:`${noiseLevel}%`, background:noiseLevel>NOISE_THRESHOLD?"linear-gradient(90deg,#ffd60a,#ff9f43)":"linear-gradient(90deg,#00f5a0,#00d4ff)", borderRadius:6, transition:"width 0.1s" }} />
            </div>
            <div style={{ fontSize:11, color:noiseLevel>NOISE_THRESHOLD?"#ffd60a":"#444", fontFamily:"'JetBrains Mono',monospace" }}>{noiseLevel>NOISE_THRESHOLD?"⚡ BOOSTING!":noiseLevel+"/100"}</div>
          </div>
          <CrowdPanel onReact={addReaction} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DON'T LAUGH
   Keep a straight face. Smile detected = round lost.
   BlazeFace measures mouth-open ratio every 33ms.
   Best of 3 rounds.
═══════════════════════════════════════════════ */
function DontLaugh({ onBack, myPoints = 74 }) {
  const DURATION = 20, SMILE_THRESH = 0.32;
  const OPP = "stranger_4421", OPP_FLAG = "🇯🇵";

  const [phase, setPhase]       = useState("loading");
  const [loadMsg, setLoadMsg]   = useState("Starting camera...");
  const [timer, setTimer]       = useState(DURATION);
  const [round, setRound]       = useState(1);
  const [wins, setWins]         = useState(0);
  const [losses, setLosses]     = useState(0);
  const [smiling, setSmiling]   = useState(false);
  const [prompt, setPrompt]     = useState(DONT_LAUGH_PROMPTS[0]);
  const [matchOver, setMatchOver] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [roundLabel, setRoundLabel] = useState("");
  const [countdown, setCountdown]   = useState(3);

  const videoRef   = useRef(null);
  const displayRef = useRef(null); // BUGFIX: visible video element, attached via effect not ref-callback
  const overlayRef = useRef(null);
  const modelRef   = useRef(null);
  const streamRef  = useRef(null);
  const animRef    = useRef(null);
  const faceIvRef  = useRef(null);
  const timerIvRef = useRef(null);
  const phaseRef   = useRef("loading");
  const smiledRef  = useRef(false);
  const faceTrack  = useRef({ cx:0, cy:0, fw:80, mouthOpen:0, found:false });
  const winsRef    = useRef(0);
  const lossesRef  = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /*
    BUGFIX — black video / face ring on black background:
    ROOT CAUSE: the visible <video> previously attached its srcObject
    via an inline `ref={e => ...}` callback. That callback only fires
    once, at mount. If the camera stream (set on the hidden bootstrap
    video below) wasn't ready yet at that exact mount moment, the
    visible video's srcObject was never set — permanently black —
    while the canvas overlay kept drawing the face ring every frame
    (it reads from the hidden video via BlazeFace, which DID have
    the stream). Landmarks tracked correctly; the video layer stayed
    empty. This effect re-runs every time `phase` changes (which is
    when the visible <video> re-mounts/re-renders), so it always
    re-attaches the live stream — no race.
  */
  useEffect(() => {
    if (displayRef.current && streamRef.current && displayRef.current.srcObject !== streamRef.current) {
      displayRef.current.srcObject = streamRef.current;
      displayRef.current.play().catch(() => {});
    }
  }, [phase]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480, facingMode:"user" }, audio:false });
        if (!mounted) return;
        streamRef.current = s;
        videoRef.current.srcObject = s;
        await videoRef.current.play();
        // BUGFIX: attach immediately too, in case displayRef already exists
        if (displayRef.current) { displayRef.current.srcObject = s; displayRef.current.play().catch(() => {}); }
      } catch { setLoadMsg("Camera denied. Allow access and refresh."); return; }
      setLoadMsg("Loading face AI...");
      try {
        await loadScript(CDN_TF); await loadScript(CDN_BLAZE);
        if (!window._faceModel) window._faceModel = await window.blazeface.load();
        if (!mounted) return;
        modelRef.current = window._faceModel;
      } catch { setLoadMsg("AI failed — game will still work."); }
      if (!mounted) return;
      setPhase("ready");
    })();
    return () => { mounted = false; cleanup(); };
  }, []); // eslint-disable-line

  function cleanup() {
    cancelAnimationFrame(animRef.current);
    clearInterval(faceIvRef.current);
    clearInterval(timerIvRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }

  function startRound(r) {
    setPhase("countdown"); setRound(r);
    setPrompt(pick(DONT_LAUGH_PROMPTS));
    setSmiling(false); smiledRef.current = false;
    setTimer(DURATION); setRoundLabel("");
    let c = 3; setCountdown(c);
    const iv = setInterval(() => { c--; setCountdown(c); if (c < 0) { clearInterval(iv); beginPlaying(); } }, 1000);
  }

  function beginPlaying() {
    setPhase("playing"); phaseRef.current = "playing";
    let t = DURATION; setTimer(t);
    timerIvRef.current = setInterval(() => {
      t--; setTimer(t);
      if (t <= 0) { clearInterval(timerIvRef.current); endRound("win"); }
    }, 1000);

    /* Face detection interval — async, separate from rAF */
    clearInterval(faceIvRef.current);
    faceIvRef.current = setInterval(async () => {
      if (!modelRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const preds = await modelRef.current.estimateFaces(videoRef.current, false);
        if (preds.length > 0) {
          const f = preds[0]; const [x1,y1]=f.topLeft; const [x2,y2]=f.bottomRight;
          const lm = f.landmarks || [];
          const mo = getMouthOpen(lm);
          faceTrack.current = { cx:(x1+x2)/2, cy:(y1+y2)/2, fw:x2-x1, mouthOpen:mo, found:true };
          if (phaseRef.current === "playing" && mo > SMILE_THRESH && !smiledRef.current) {
            smiledRef.current = true;
            setSmiling(true);
            setTimeout(() => endRound("loss"), 500);
          }
        } else { faceTrack.current.found = false; }
      } catch {}
    }, 33);

    /* Overlay render loop — draws face ring on canvas */
    cancelAnimationFrame(animRef.current);
    const draw = () => {
      const canvas = overlayRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ft = faceTrack.current;
      const vw = videoRef.current?.videoWidth || 640;
      const vh = videoRef.current?.videoHeight || 480;
      if (ft.found && ft.fw > 0) {
        const W = canvas.width, H = canvas.height;
        const mx = W - (ft.cx / vw) * W;
        const my = (ft.cy / vh) * H;
        const r  = (ft.fw / vw) * W / 2 + 12;
        const isSmiling = ft.mouthOpen > SMILE_THRESH;
        const col = isSmiling ? "#ff4d6d" : "#00f5a0";
        ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI*2);
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
        if (isSmiling) {
          ctx.fillStyle = "rgba(255,77,109,0.10)";
          ctx.beginPath(); ctx.arc(mx, my, r + 20, 0, Math.PI*2); ctx.fill();
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
  }

  function endRound(result) {
    clearInterval(timerIvRef.current);
    clearInterval(faceIvRef.current);
    cancelAnimationFrame(animRef.current);
    phaseRef.current = "result";
    const nw = result==="win" ? winsRef.current+1 : winsRef.current;
    const nl = result==="loss" ? lossesRef.current+1 : lossesRef.current;
    winsRef.current = nw; lossesRef.current = nl;
    setWins(nw); setLosses(nl);
    setRoundLabel(result==="win" ? "✓ straight face!" : "😂 you smiled");
    setPhase("roundresult");
    if (nw === 2 || nl === 2) { setTimeout(() => setMatchOver(nw > nl), 2000); }
    else { setTimeout(() => startRound(round + 1), 2500); }
  }

  const addReaction = emoji => { const id=Date.now(); setReactions(r=>[...r,{id,emoji,x:Math.random()*70+10}]); setTimeout(()=>setReactions(r=>r.filter(rx=>rx.id!==id)),2200); };
  const entryFee = Math.max(3, Math.round(myPoints * 0.03));

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'Syne',sans-serif", color:"#f0eeea", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      <video ref={videoRef} style={{ display:"none" }} muted playsInline />
      <GameNav title="don't laugh" myPoints={myPoints} onBack={onBack}
        extra={phase==="playing" ? <TimerRing seconds={timer} total={DURATION} color="#00d4ff"/> : null}
      />
      <div style={{ flex:1, display:"flex", gap:12, padding:"clamp(8px,2vw,16px)", minHeight:0 }}>
        <div style={{ flex:1, position:"relative", borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)", background:"#090909", minHeight:360 }}>
          {/* Camera feed */}
          <video autoPlay muted playsInline ref={displayRef}
            style={{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)", display:phase==="playing"||phase==="countdown"||phase==="roundresult"?"block":"none" }}
          />
          {/* Face ring overlay */}
          <canvas ref={overlayRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} />

          {phase==="loading" && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(9,9,9,0.96)", flexDirection:"column", gap:20 }}><Spinner label={loadMsg}/></div>}

          {phase==="ready" && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:22, background:"rgba(9,9,9,0.88)", animation:"fadeUp 0.4s both", padding:24 }}>
              <div style={{ fontSize:56 }}>😐</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,6vw,48px)", letterSpacing:3, color:"#00d4ff", textAlign:"center" }}>DON'T LAUGH</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#444", textAlign:"center", lineHeight:1.8, maxWidth:320 }}>
                // keep a straight face for {DURATION} seconds<br/>
                // smile detected = round lost immediately<br/>
                // best of 3 rounds wins the fee
              </div>
              <button onClick={() => startRound(1)} style={{ background:"linear-gradient(135deg,#00d4ff,#00f5a0)", color:"#0a0a0a", border:"none", borderRadius:14, padding:"14px 40px", fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, cursor:"pointer", boxShadow:"0 0 30px rgba(0,212,255,0.4)", animation:"glowPulse 2.5s infinite" }}>PLAY</button>
            </div>
          )}

          {phase==="countdown" && <CountdownOverlay n={countdown} />}

          {phase==="playing" && (
            <>
              {smiling && <div style={{ position:"absolute", inset:0, border:"4px solid #ff4d6d", borderRadius:20, pointerEvents:"none", animation:"smileWarn 0.3s infinite", zIndex:5 }} />}
              <div style={{ position:"absolute", bottom:20, left:0, right:0, display:"flex", justifyContent:"center" }}>
                <div style={{ background:"rgba(0,0,0,0.75)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"14px 24px", maxWidth:460, textAlign:"center" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#444", marginBottom:8, letterSpacing:2 }}>// imagine this</div>
                  <div style={{ fontSize:"clamp(13px,2.5vw,16px)", color:"#f0eeea", lineHeight:1.5 }}>{prompt}</div>
                  {smiling && <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"#ff4d6d", marginTop:8, letterSpacing:2 }}>SMILED! 😂</div>}
                </div>
              </div>
              <div style={{ position:"absolute", top:16, left:16, fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"rgba(0,212,255,0.7)" }}>round {round}/3</div>
            </>
          )}

          {phase==="roundresult" && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.82)", animation:"fadeUp 0.3s both", zIndex:10 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(36px,8vw,64px)", color:roundLabel.includes("✓")?"#00f5a0":"#ff4d6d", letterSpacing:3 }}>{roundLabel}</div>
                <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:12 }}>
                  {Array.from({length:3}).map((_,i) => { const col=i<wins?"#00f5a0":i<wins+losses?"#ff4d6d":"rgba(255,255,255,0.1)"; return <div key={i} style={{ width:12,height:12,borderRadius:"50%",background:col,boxShadow:col.startsWith("#")?`0 0 8px ${col}`:"none" }}/>; })}
                </div>
              </div>
            </div>
          )}

          {matchOver !== null && <MatchResult won={matchOver} myScore={wins} oppScore={losses} entryFee={entryFee} onPlayAgain={() => { setMatchOver(null); winsRef.current=0; lossesRef.current=0; setWins(0); setLosses(0); startRound(1); }} onBack={onBack}/>}
          <FloatingReactions list={reactions}/>
        </div>
        <SidebarRounds wins={wins} losses={losses} opponent={OPP+" "+OPP_FLAG} entryFee={entryFee}>
          <CrowdPanel onReact={addReaction}/>
        </SidebarRounds>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   VIBE CHECK — act out a mood, crowd votes winner
═══════════════════════════════════════════════ */
function VibeCheck({ onBack, myPoints = 74 }) {
  const DURATION = 15, VOTE_DUR = 5;
  const OPP = "stranger_9912", OPP_FLAG = "🇰🇷";

  const [phase, setPhase]         = useState("ready");
  const [timer, setTimer]         = useState(DURATION);
  const [round, setRound]         = useState(1);
  const [wins, setWins]           = useState(0);
  const [losses, setLosses]       = useState(0);
  const [prompt, setPrompt]       = useState(VIBE_CHECK_PROMPTS[0]);
  const [myVote, setMyVote]       = useState(0);
  const [oppVote, setOppVote]     = useState(0);
  const [voteTimer, setVoteTimer] = useState(VOTE_DUR);
  const [roundWon, setRoundWon]   = useState(null);
  const [matchOver, setMatchOver] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [countdown, setCountdown] = useState(3);

  const videoRef   = useRef(null);
  const displayRef = useRef(null); // BUGFIX: visible video, attached via effect not race-prone ref-callback
  const streamRef  = useRef(null);
  const timerIvRef = useRef(null);
  const voteIvRef  = useRef(null);
  const winsRef    = useRef(0);
  const lossesRef  = useRef(0);

  useEffect(() => {
    (async () => {
      try { const s=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:"user"},audio:false}); streamRef.current=s; videoRef.current.srcObject=s; await videoRef.current.play();
        if (displayRef.current) { displayRef.current.srcObject = s; displayRef.current.play().catch(()=>{}); } } catch {}
    })();
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); clearInterval(timerIvRef.current); clearInterval(voteIvRef.current); };
  }, []);

  // BUGFIX: re-attach the stream every time `phase` changes the visible video re-renders/re-mounts
  useEffect(() => {
    if (displayRef.current && streamRef.current && displayRef.current.srcObject !== streamRef.current) {
      displayRef.current.srcObject = streamRef.current;
      displayRef.current.play().catch(() => {});
    }
  }, [phase]);

  function startRound(r) {
    setPhase("countdown"); setRound(r);
    setPrompt(pick(VIBE_CHECK_PROMPTS));
    setMyVote(0); setOppVote(0); setRoundWon(null); setTimer(DURATION);
    let c = 3; setCountdown(c);
    const iv = setInterval(() => { c--; setCountdown(c); if (c < 0) { clearInterval(iv); beginPlaying(); } }, 1000);
  }

  function beginPlaying() {
    setPhase("playing"); let t = DURATION; setTimer(t);
    timerIvRef.current = setInterval(() => { t--; setTimer(t); if (t<=0){clearInterval(timerIvRef.current);startVoting();} }, 1000);
  }

  function startVoting() {
    setPhase("voting");
    const myF = randInt(35,72), oppF = 100-myF;
    let prog = 0, vt = VOTE_DUR; setVoteTimer(vt);
    voteIvRef.current = setInterval(() => {
      prog = Math.min(prog+5, 100);
      setMyVote(Math.round(myF*(prog/100)));
      setOppVote(Math.round(oppF*(prog/100)));
      vt -= 0.25; setVoteTimer(Math.max(0, Math.round(vt)));
      if (prog >= 100) { clearInterval(voteIvRef.current); endRound(myF >= oppF ? "win" : "loss"); }
    }, 250);
  }

  function endRound(result) {
    const nw = result==="win" ? winsRef.current+1 : winsRef.current;
    const nl = result==="loss" ? lossesRef.current+1 : lossesRef.current;
    winsRef.current=nw; lossesRef.current=nl;
    setWins(nw); setLosses(nl); setRoundWon(result==="win"); setPhase("roundresult");
    if (nw===2||nl===2) { setTimeout(()=>setMatchOver(nw>nl), 2000); }
    else { setTimeout(()=>startRound(round+1), 2500); }
  }

  const addReaction = e => { const id=Date.now(); setReactions(r=>[...r,{id,emoji:e,x:Math.random()*70+10}]); setTimeout(()=>setReactions(r=>r.filter(rx=>rx.id!==id)),2200); };
  const entryFee = Math.max(3, Math.round(myPoints*0.03));

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'Syne',sans-serif", color:"#f0eeea", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      <video ref={videoRef} style={{ display:"none" }} muted playsInline />
      <GameNav title="vibe check" myPoints={myPoints} onBack={onBack}
        extra={phase==="playing" ? <TimerRing seconds={timer} total={DURATION} color="#ff4d6d"/> : null}
      />
      <div style={{ flex:1, display:"flex", gap:12, padding:"clamp(8px,2vw,16px)", minHeight:0 }}>
        <div style={{ flex:1, position:"relative", borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)", background:"#090909", minHeight:360, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <video autoPlay muted playsInline ref={displayRef}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)", opacity:phase==="playing"||phase==="countdown"||phase==="voting"?0.35:0 }}
          />
          {phase==="ready" && (
            <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:24, animation:"fadeUp 0.4s both" }}>
              <div style={{ fontSize:56 }}>🎭</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,6vw,52px)", letterSpacing:3, color:"#ff4d6d" }}>VIBE CHECK</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#444", textAlign:"center", lineHeight:1.8, maxWidth:340 }}>// you get a vibe to act out<br/>// perform it for {DURATION} seconds<br/>// crowd votes who nailed it</div>
              <button onClick={()=>startRound(1)} style={{ background:"linear-gradient(135deg,#ff4d6d,#ffd60a)", color:"#0a0a0a", border:"none", borderRadius:14, padding:"14px 40px", fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, cursor:"pointer", boxShadow:"0 0 30px rgba(255,77,109,0.4)", animation:"glowPulse 2.5s infinite" }}>PLAY</button>
            </div>
          )}
          {phase==="countdown" && <CountdownOverlay n={countdown}/>}
          {phase==="playing" && (
            <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:24 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#ff4d6d", letterSpacing:3 }}>// your vibe</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(24px,5vw,44px)", letterSpacing:2, color:"#f0eeea", textAlign:"center", lineHeight:1.1, maxWidth:500 }}>"{prompt}"</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#444" }}>act it out. crowd is watching.</div>
            </div>
          )}
          {phase==="voting" && (
            <div style={{ position:"relative", zIndex:2, width:"100%", maxWidth:440, padding:"0 24px", animation:"fadeUp 0.3s both" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a", letterSpacing:2, marginBottom:20, textAlign:"center" }}>// crowd is voting · {voteTimer}s</div>
              <div style={{ background:"rgba(0,0,0,0.65)", backdropFilter:"blur(12px)", borderRadius:16, padding:24, border:"1px solid rgba(255,255,255,0.08)" }}>
                {[["you 🇳🇵",myVote,"#00f5a0"],[`${OPP} ${OPP_FLAG}`,oppVote,"#ff4d6d"]].map(([l,v,c]) => (
                  <div key={l} style={{ marginBottom:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6, color:c }}><span>{l}</span><span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{v}%</span></div>
                    <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:4, height:10, overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:4, width:`${v}%`, background:`linear-gradient(90deg,${c},${c}88)`, transition:"width 0.25s" }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {phase==="roundresult" && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.85)", animation:"fadeUp 0.3s both", zIndex:10 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(36px,8vw,64px)", color:roundWon?"#00f5a0":"#ff4d6d", letterSpacing:3 }}>{roundWon?"CROWD LOVED IT 🔥":"DIDN'T BUY IT 💀"}</div>
                <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:12 }}>
                  {Array.from({length:3}).map((_,i)=>{const col=i<wins?"#00f5a0":i<wins+losses?"#ff4d6d":"rgba(255,255,255,0.1)";return <div key={i} style={{ width:12,height:12,borderRadius:"50%",background:col }}/>;})}
                </div>
              </div>
            </div>
          )}
          {matchOver!==null && <MatchResult won={matchOver} myScore={wins} oppScore={losses} entryFee={entryFee} onPlayAgain={()=>{setMatchOver(null);winsRef.current=0;lossesRef.current=0;setWins(0);setLosses(0);startRound(1);}} onBack={onBack}/>}
          <FloatingReactions list={reactions}/>
        </div>
        <SidebarRounds wins={wins} losses={losses} opponent={OPP+" "+OPP_FLAG} entryFee={entryFee}>
          <CrowdPanel onReact={addReaction}/>
        </SidebarRounds>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HOT TAKE — react to a wild opinion, crowd judges
═══════════════════════════════════════════════ */
function HotTake({ onBack, myPoints = 74 }) {
  const DURATION = 15, VOTE_DUR = 5;
  const OPP = "stranger_3301", OPP_FLAG = "🇧🇷";

  const [phase, setPhase]         = useState("ready");
  const [timer, setTimer]         = useState(DURATION);
  const [round, setRound]         = useState(1);
  const [wins, setWins]           = useState(0);
  const [losses, setLosses]       = useState(0);
  const [prompt, setPrompt]       = useState(HOT_TAKE_PROMPTS[0]);
  const [myVote, setMyVote]       = useState(0);
  const [oppVote, setOppVote]     = useState(0);
  const [voteTimer, setVoteTimer] = useState(VOTE_DUR);
  const [roundWon, setRoundWon]   = useState(null);
  const [matchOver, setMatchOver] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [countdown, setCountdown] = useState(3);

  const videoRef   = useRef(null);
  const displayRef = useRef(null); // BUGFIX: visible video, attached via effect not race-prone ref-callback
  const streamRef  = useRef(null);
  const timerIvRef = useRef(null);
  const voteIvRef  = useRef(null);
  const winsRef    = useRef(0);
  const lossesRef  = useRef(0);

  useEffect(() => {
    (async () => {
      try { const s=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:"user"},audio:false}); streamRef.current=s; videoRef.current.srcObject=s; await videoRef.current.play();
        if (displayRef.current) { displayRef.current.srcObject = s; displayRef.current.play().catch(()=>{}); } } catch {}
    })();
    return () => { if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); clearInterval(timerIvRef.current); clearInterval(voteIvRef.current); };
  }, []);

  // BUGFIX: re-attach stream whenever phase changes triggers a re-mount of the visible video
  useEffect(() => {
    if (displayRef.current && streamRef.current && displayRef.current.srcObject !== streamRef.current) {
      displayRef.current.srcObject = streamRef.current;
      displayRef.current.play().catch(() => {});
    }
  }, [phase]);

  function startRound(r) {
    setPhase("countdown"); setRound(r); setPrompt(pick(HOT_TAKE_PROMPTS));
    setMyVote(0); setOppVote(0); setRoundWon(null); setTimer(DURATION);
    let c = 3; setCountdown(c);
    const iv = setInterval(() => { c--; setCountdown(c); if(c<0){clearInterval(iv);beginPlaying();} }, 1000);
  }
  function beginPlaying() {
    setPhase("playing"); let t=DURATION; setTimer(t);
    timerIvRef.current = setInterval(() => { t--;setTimer(t); if(t<=0){clearInterval(timerIvRef.current);startVoting();} }, 1000);
  }
  function startVoting() {
    setPhase("voting");
    const myF=randInt(30,70), oppF=100-myF;
    let prog=0, vt=VOTE_DUR; setVoteTimer(vt);
    voteIvRef.current = setInterval(() => {
      prog=Math.min(prog+5,100);
      setMyVote(Math.round(myF*(prog/100))); setOppVote(Math.round(oppF*(prog/100)));
      vt-=0.25; setVoteTimer(Math.max(0,Math.round(vt)));
      if(prog>=100){clearInterval(voteIvRef.current);endRound(myF>=oppF?"win":"loss");}
    },250);
  }
  function endRound(result) {
    const nw=result==="win"?winsRef.current+1:winsRef.current, nl=result==="loss"?lossesRef.current+1:lossesRef.current;
    winsRef.current=nw; lossesRef.current=nl;
    setWins(nw); setLosses(nl); setRoundWon(result==="win"); setPhase("roundresult");
    if(nw===2||nl===2){setTimeout(()=>setMatchOver(nw>nl),2000);}
    else{setTimeout(()=>startRound(round+1),2500);}
  }
  const addReaction = e => { const id=Date.now(); setReactions(r=>[...r,{id,emoji:e,x:Math.random()*70+10}]); setTimeout(()=>setReactions(r=>r.filter(rx=>rx.id!==id)),2200); };
  const entryFee = Math.max(3, Math.round(myPoints*0.03));

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'Syne',sans-serif", color:"#f0eeea", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      <video ref={videoRef} style={{ display:"none" }} muted playsInline/>
      <GameNav title="hot take" myPoints={myPoints} onBack={onBack}
        extra={phase==="playing"?<TimerRing seconds={timer} total={DURATION} color="#ffd60a"/>:null}
      />
      <div style={{ flex:1, display:"flex", gap:12, padding:"clamp(8px,2vw,16px)", minHeight:0 }}>
        <div style={{ flex:1, position:"relative", borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)", background:"#090909", minHeight:360, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <video autoPlay muted playsInline ref={displayRef}
            style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)",opacity:phase==="playing"||phase==="countdown"||phase==="voting"?0.3:0 }}/>

          {phase==="ready"&&(
            <div style={{ position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",gap:22,padding:24,animation:"fadeUp 0.4s both" }}>
              <div style={{ fontSize:56 }}>🌶️</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(28px,6vw,52px)",letterSpacing:3,color:"#ffd60a" }}>HOT TAKE</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#444",textAlign:"center",lineHeight:1.8,maxWidth:320 }}>// a spicy opinion appears<br/>// react with your face for {DURATION} seconds<br/>// crowd picks the better reaction</div>
              <button onClick={()=>startRound(1)} style={{ background:"linear-gradient(135deg,#ffd60a,#ff9f43)",color:"#0a0a0a",border:"none",borderRadius:14,padding:"14px 40px",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,cursor:"pointer",boxShadow:"0 0 30px rgba(255,214,10,0.4)",animation:"glowPulse 2.5s infinite" }}>PLAY</button>
            </div>
          )}
          {phase==="countdown"&&<CountdownOverlay n={countdown}/>}
          {phase==="playing"&&(
            <div style={{ position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:24 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#ffd60a",letterSpacing:3 }}>// hot take alert</div>
              <div style={{ background:"rgba(255,214,10,0.08)",border:"2px solid rgba(255,214,10,0.3)",borderRadius:20,padding:"28px 36px",textAlign:"center",maxWidth:500,boxShadow:"0 0 40px rgba(255,214,10,0.12)" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(26px,5vw,48px)",letterSpacing:2,color:"#ffd60a",lineHeight:1.1 }}>"{prompt}"</div>
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#444" }}>react. crowd is watching your face.</div>
            </div>
          )}
          {phase==="voting"&&(
            <div style={{ position:"relative",zIndex:2,width:"100%",maxWidth:420,padding:"0 24px",animation:"fadeUp 0.3s both" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#ffd60a",letterSpacing:2,marginBottom:18,textAlign:"center" }}>// crowd is voting · {voteTimer}s</div>
              <div style={{ background:"rgba(0,0,0,0.65)",backdropFilter:"blur(12px)",borderRadius:16,padding:24,border:"1px solid rgba(255,255,255,0.08)" }}>
                {[["you 🇳🇵",myVote,"#00f5a0"],[`${OPP} ${OPP_FLAG}`,oppVote,"#ff4d6d"]].map(([l,v,c])=>(
                  <div key={l} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,color:c }}><span>{l}</span><span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{v}%</span></div>
                    <div style={{ background:"rgba(255,255,255,0.06)",borderRadius:4,height:10,overflow:"hidden" }}><div style={{ height:"100%",borderRadius:4,width:`${v}%`,background:`linear-gradient(90deg,${c},${c}88)`,transition:"width 0.25s" }}/></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {phase==="roundresult"&&(
            <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",animation:"fadeUp 0.3s both",zIndex:10 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(36px,8vw,64px)",color:roundWon?"#ffd60a":"#ff4d6d",letterSpacing:3 }}>{roundWon?"CROWD LOVED IT 🔥":"NOT CONVINCED 💀"}</div>
                <div style={{ display:"flex",gap:10,justifyContent:"center",marginTop:12 }}>
                  {Array.from({length:3}).map((_,i)=>{const col=i<wins?"#00f5a0":i<wins+losses?"#ff4d6d":"rgba(255,255,255,0.1)";return <div key={i} style={{ width:12,height:12,borderRadius:"50%",background:col }}/>;})}
                </div>
              </div>
            </div>
          )}
          {matchOver!==null&&<MatchResult won={matchOver} myScore={wins} oppScore={losses} entryFee={entryFee} onPlayAgain={()=>{setMatchOver(null);winsRef.current=0;lossesRef.current=0;setWins(0);setLosses(0);startRound(1);}} onBack={onBack}/>}
          <FloatingReactions list={reactions}/>
        </div>
        <SidebarRounds wins={wins} losses={losses} opponent={OPP+" "+OPP_FLAG} entryFee={entryFee}>
          <CrowdPanel onReact={addReaction}/>
        </SidebarRounds>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MIRROR ME — copy a pose, AI scores accuracy
═══════════════════════════════════════════════ */
function MirrorMe({ onBack, myPoints = 74 }) {
  const POSE_DUR = 8, COPY_DUR = 8;
  const OPP = "stranger_5527", OPP_FLAG = "🇩🇪";

  const [phase, setPhase]           = useState("ready");
  const [subPhase, setSubPhase]     = useState("pose");
  const [timer, setTimer]           = useState(POSE_DUR);
  const [round, setRound]           = useState(1);
  const [wins, setWins]             = useState(0);
  const [losses, setLosses]         = useState(0);
  const [pose, setPose]             = useState(MIRROR_ME_POSES[0]);
  const [myAccuracy, setMyAccuracy] = useState(null);
  const [oppAccuracy, setOppAccuracy] = useState(null);
  const [roundWon, setRoundWon]     = useState(null);
  const [matchOver, setMatchOver]   = useState(null);
  const [reactions, setReactions]   = useState([]);
  const [countdown, setCountdown]   = useState(3);

  const videoRef   = useRef(null);
  const displayRef = useRef(null); // BUGFIX: visible video, attached via effect not race-prone ref-callback
  const streamRef  = useRef(null);
  const timerIvRef = useRef(null);
  const subRef     = useRef("pose");
  const winsRef    = useRef(0);
  const lossesRef  = useRef(0);

  useEffect(() => {
    (async () => {
      try { const s=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:"user"},audio:false}); streamRef.current=s; videoRef.current.srcObject=s; await videoRef.current.play();
        if (displayRef.current) { displayRef.current.srcObject = s; displayRef.current.play().catch(()=>{}); } } catch {}
    })();
    return () => { if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); clearInterval(timerIvRef.current); };
  }, []);

  // BUGFIX: re-attach stream whenever phase changes triggers a re-mount of the visible video
  useEffect(() => {
    if (displayRef.current && streamRef.current && displayRef.current.srcObject !== streamRef.current) {
      displayRef.current.srcObject = streamRef.current;
      displayRef.current.play().catch(() => {});
    }
  }, [phase]);

  function startRound(r) {
    setPhase("countdown"); setRound(r); setPose(pick(MIRROR_ME_POSES));
    setSubPhase("pose"); subRef.current="pose";
    setMyAccuracy(null); setOppAccuracy(null); setRoundWon(null); setTimer(POSE_DUR);
    let c=3; setCountdown(c);
    const iv=setInterval(()=>{c--;setCountdown(c);if(c<0){clearInterval(iv);beginPose();}},1000);
  }
  function beginPose() {
    setPhase("playing"); setSubPhase("pose"); subRef.current="pose";
    let t=POSE_DUR; setTimer(t);
    timerIvRef.current=setInterval(()=>{t--;setTimer(t);if(t<=0){clearInterval(timerIvRef.current);beginCopy();}},1000);
  }
  function beginCopy() {
    setSubPhase("copy"); subRef.current="copy";
    let t=COPY_DUR; setTimer(t);
    timerIvRef.current=setInterval(()=>{t--;setTimer(t);if(t<=0){clearInterval(timerIvRef.current);scoreRound();}},1000);
  }
  function scoreRound() {
    const myA=randInt(45,98), oppA=randInt(40,95);
    setMyAccuracy(myA); setOppAccuracy(oppA);
    const nw=myA>oppA?winsRef.current+1:winsRef.current;
    const nl=myA<=oppA?lossesRef.current+1:lossesRef.current;
    winsRef.current=nw; lossesRef.current=nl;
    setWins(nw); setLosses(nl); setRoundWon(myA>oppA); setPhase("roundresult");
    if(nw===2||nl===2){setTimeout(()=>setMatchOver(nw>nl),2500);}
    else{setTimeout(()=>startRound(round+1),3000);}
  }
  const addReaction = e => { const id=Date.now(); setReactions(r=>[...r,{id,emoji:e,x:Math.random()*70+10}]); setTimeout(()=>setReactions(r=>r.filter(rx=>rx.id!==id)),2200); };
  const entryFee = Math.max(3, Math.round(myPoints*0.03));

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'Syne',sans-serif", color:"#f0eeea", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      <video ref={videoRef} style={{ display:"none" }} muted playsInline/>
      <GameNav title="mirror me" myPoints={myPoints} onBack={onBack}
        extra={phase==="playing"?<TimerRing seconds={timer} total={subPhase==="pose"?POSE_DUR:COPY_DUR} color="#a064ff"/>:null}
      />
      <div style={{ flex:1, display:"flex", gap:12, padding:"clamp(8px,2vw,16px)", minHeight:0 }}>
        <div style={{ flex:1, position:"relative", borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)", background:"#090909", minHeight:360, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <video autoPlay muted playsInline ref={displayRef}
            style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)",opacity:phase==="playing"||phase==="countdown"?0.5:0 }}/>

          {phase==="ready"&&(
            <div style={{ position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",gap:20,padding:24,animation:"fadeUp 0.4s both" }}>
              <div style={{ fontSize:56 }}>🪞</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(28px,6vw,52px)",letterSpacing:3,color:"#a064ff" }}>MIRROR ME</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#444",textAlign:"center",lineHeight:1.8,maxWidth:340 }}>// a pose instruction appears<br/>// make that face for {POSE_DUR} seconds<br/>// opponent copies for {COPY_DUR} seconds<br/>// AI scores the accuracy</div>
              <button onClick={()=>startRound(1)} style={{ background:"linear-gradient(135deg,#a064ff,#00d4ff)",color:"#fff",border:"none",borderRadius:14,padding:"14px 40px",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,cursor:"pointer",boxShadow:"0 0 30px rgba(160,100,255,0.4)",animation:"glowPulse 2.5s infinite" }}>PLAY</button>
            </div>
          )}
          {phase==="countdown"&&<CountdownOverlay n={countdown}/>}
          {phase==="playing"&&(
            <div style={{ position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:24 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#a064ff",letterSpacing:3 }}>// {subPhase==="pose"?"make this face":"now copy the pose"}</div>
              <div style={{ background:"rgba(160,100,255,0.08)",border:"2px solid rgba(160,100,255,0.3)",borderRadius:20,padding:"24px 32px",textAlign:"center",maxWidth:500 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(22px,4vw,38px)",letterSpacing:2,color:"#c084fc",lineHeight:1.2 }}>{pose}</div>
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#555" }}>{subPhase==="pose"?"hold the expression until timer ends":"match it as closely as possible"}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:subPhase==="pose"?"#a064ff":"#00d4ff",background:subPhase==="pose"?"rgba(160,100,255,0.1)":"rgba(0,212,255,0.1)",border:`1px solid ${subPhase==="pose"?"rgba(160,100,255,0.3)":"rgba(0,212,255,0.3)"}`,borderRadius:10,padding:"8px 20px" }}>
                {subPhase==="pose"?"YOUR POSE":"COPY NOW"}
              </div>
            </div>
          )}
          {phase==="roundresult"&&(
            <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.88)",animation:"fadeUp 0.3s both",zIndex:10,flexDirection:"column",gap:20,padding:24 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(32px,7vw,56px)",color:roundWon?"#00f5a0":"#ff4d6d",letterSpacing:3 }}>{roundWon?"BETTER MIRROR 🪞":"LOWER SCORE 💀"}</div>
              {myAccuracy!==null&&(
                <div style={{ display:"flex",gap:20,flexWrap:"wrap",justifyContent:"center" }}>
                  {[["your accuracy",myAccuracy,"#00f5a0"],["opponent",oppAccuracy,"#ff4d6d"]].map(([l,v,c])=>(
                    <div key={l} style={{ textAlign:"center",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px 20px" }}>
                      <div style={{ fontSize:10,color:"#444",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>{l}</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:44,color:c,lineHeight:1 }}>{v}%</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:"flex",gap:10 }}>
                {Array.from({length:3}).map((_,i)=>{const col=i<wins?"#00f5a0":i<wins+losses?"#ff4d6d":"rgba(255,255,255,0.1)";return <div key={i} style={{ width:12,height:12,borderRadius:"50%",background:col }}/>;})}
              </div>
            </div>
          )}
          {matchOver!==null&&<MatchResult won={matchOver} myScore={wins} oppScore={losses} entryFee={entryFee} onPlayAgain={()=>{setMatchOver(null);winsRef.current=0;lossesRef.current=0;setWins(0);setLosses(0);startRound(1);}} onBack={onBack}/>}
          <FloatingReactions list={reactions}/>
        </div>
        <SidebarRounds wins={wins} losses={losses} opponent={OPP+" "+OPP_FLAG} entryFee={entryFee}>
          <div style={{ background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:14 }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#444",letterSpacing:2,marginBottom:6 }}>// phase</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:"#a064ff" }}>{subPhase==="pose"?"YOU POSE":"YOU COPY"}</div>
          </div>
          <CrowdPanel onReact={addReaction}/>
        </SidebarRounds>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ROOT EXPORT — GameSection
   
   StrangerPlay_Main.jsx imports this one component.
   It manages which screen shows:
     null         → Lobby (game picker)
     "floppy"     → FloppyFaceRace
     "dont_laugh" → DontLaugh
     "vibe_check" → VibeCheck
     "hot_take"   → HotTake
     "mirror_me"  → MirrorMe
     "speed_roast"→ Coming Soon (not built yet)
═══════════════════════════════════════════════ */
export default function GameSection({ onBack, myPoints = 74 }) {
  const [activeGame, setActiveGame] = useState(null);
  const back = () => setActiveGame(null);

  if (activeGame === "floppy")      return <FloppyFaceRace onBack={back} myPoints={myPoints} />;
  if (activeGame === "dont_laugh")  return <DontLaugh      onBack={back} myPoints={myPoints} />;
  if (activeGame === "vibe_check")  return <VibeCheck      onBack={back} myPoints={myPoints} />;
  if (activeGame === "hot_take")    return <HotTake        onBack={back} myPoints={myPoints} />;
  if (activeGame === "mirror_me")   return <MirrorMe       onBack={back} myPoints={myPoints} />;

  if (activeGame === "speed_roast") {
    const g = ALL_GAMES.find(x => x.id === "speed_roast");
    return (
      <div style={{ minHeight:"100vh", background:BG, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", color:"#f0eeea", gap:20, padding:24 }}>
        <style>{CSS}</style>
        <div style={{ fontSize:64 }}>{g.emoji}</div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(36px,8vw,64px)", color:g.color, letterSpacing:3, textAlign:"center" }}>{g.title}</div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#444", letterSpacing:2 }}>// being built. check back soon.</div>
        <button onClick={back} style={{ marginTop:16, fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:2, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"12px 32px", color:"#f0eeea", cursor:"pointer" }}>← BACK TO GAMES</button>
      </div>
    );
  }

  return <Lobby onSelect={setActiveGame} onBack={onBack} myPoints={myPoints} />;
}