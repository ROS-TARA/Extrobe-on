/**
 * GameScreen.jsx — StrangerPlay
 *
 * TWO COMPLETELY DIFFERENT LAYOUTS:
 *
 * 1. PLAYER layout  (isPlayer=true, default)
 *    — You are IN the game
 *    — Fullscreen: opponent fills the whole screen, YOUR cam is big (not tiny PIP)
 *    — Bottom control bar with mute/cam/hang-up
 *    — Game prompts overlay at bottom
 *    — Score bar at top, timer in center
 *    — Mobile: vertical stack, both cams 50/50 height
 *
 * 2. SPECTATOR layout (isPlayer=false)
 *    — You are WATCHING two strangers play
 *    — TikTok-style: both players side by side, equal width
 *    — Right panel: live reaction bar + emoji buttons
 *    — Left panel: scrolling chat / crowd comments
 *    — Score ticker at top like a sports broadcast
 *    — No controls. No camera access. Pure viewer experience.
 *
 * Architecture rules (never break):
 *   - NEVER put await inside requestAnimationFrame
 *   - setInterval(async) writes to ref → rAF reads ref synchronously
 *   - canvas.width must be set from getBoundingClientRect(), not CSS
 */

import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const BG = `linear-gradient(to right,#141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,#1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,#262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,#303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

const ROUND_DURATION  = 20;
const VOTE_DURATION   = 5;
const INTRO_DURATION  = 2000;
const RESULT_DURATION = 3000;
const TOTAL_ROUNDS    = 3;
const SMILE_THRESHOLD = 0.38;
const FACE_INTERVAL   = 33;

const CDN_TF    = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js";
const CDN_BLAZE = "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js";

/* ─────────────────────────────────────────────
   GAME MODE CONFIG
───────────────────────────────────────────── */
const MODES = {
  dontlaugh: {
    label:"Don't Laugh", emoji:"😐", color:"#00f5a0", duration:20,
    desc:"Keep a straight face. Smile = you lose the round.",
    prompts:[
      "Imagine your grandma doing the floss dance",
      "A cat slowly falling off a table in slow motion",
      "Your teacher trying to use TikTok for the first time",
      "A dog wearing tiny boots on a slippery floor",
      "Someone biting into a lemon expecting it to be an orange",
    ],
  },
  vibecheck: {
    label:"Vibe Check", emoji:"🎭", color:"#ff4d6d", duration:15,
    desc:"Act out the vibe. Crowd votes who nailed it.",
    prompts:[
      "You just won the lottery but you're trying to act normal",
      "You are a robot that just discovered human emotions",
      "You are a very dramatic grandma at a soap opera funeral",
      "You just bit into the sourest lemon of your entire life",
      "You are an astronaut seeing Earth for the first time",
    ],
  },
  mirrorme: {
    label:"Mirror Me", emoji:"🪞", color:"#00d4ff", duration:10,
    desc:"Copy the pose exactly. AI scores your accuracy.",
    poses:[
      "Raise both eyebrows as high as humanly possible",
      "Puff out your cheeks like a balloon about to pop",
      "Make the most confused face you have ever made",
      "Pretend you just smelled something absolutely horrible",
      "Look as surprised as you have ever been in your life",
    ],
  },
  hottake: {
    label:"Hot Take", emoji:"🌶️", color:"#ffd60a", duration:15,
    desc:"React to the take in 5 seconds. Crowd picks best reaction.",
    prompts:[
      "Pineapple on pizza is actually really good",
      "Sleeping is a complete waste of time",
      "Cats are objectively better than dogs",
      "School should legally start at noon",
      "Putting cereal before milk should be illegal",
    ],
  },
};

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

function getMouthOpenness(lm) {
  if (!lm || lm.length < 4) return 0;
  const nose = lm[2], mouth = lm[3], eyeL = lm[1];
  const faceH = Math.abs(eyeL[1] - mouth[1]) || 1;
  return Math.abs(mouth[1] - nose[1]) / faceH;
}

function mirrorScore(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 4) return 50;
  let diff = 0;
  for (let i = 0; i < Math.min(lm1.length, lm2.length); i++) {
    const dx = lm1[i][0]-lm2[i][0], dy = lm1[i][1]-lm2[i][1];
    diff += Math.sqrt(dx*dx+dy*dy);
  }
  return Math.max(0, Math.round(100 - diff/2));
}

function getRank(pts) {
  if (pts >= 5000) return "Diamond";
  if (pts >= 1000) return "Platinum";
  if (pts >= 500)  return "Gold";
  if (pts >= 100)  return "Silver";
  return "Bronze";
}

function rankColor(pts) {
  if (pts >= 5000) return "#00d4ff";
  if (pts >= 1000) return "#a064ff";
  if (pts >= 500)  return "#ffd60a";
  if (pts >= 100)  return "#c0c0c0";
  return "#cd7f32";
}

/* ─────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────── */
function RoundDots({ total, scores }) {
  return (
    <div style={{ display:"flex", gap:7, alignItems:"center" }}>
      {Array.from({length:total}).map((_,i) => {
        const s = scores[i];
        const col = s==="win"?"#00f5a0":s==="loss"?"#ff4d6d":"rgba(255,255,255,0.1)";
        return <div key={i} style={{ width:9, height:9, borderRadius:"50%", background:col, boxShadow:s?`0 0 7px ${col}`:"none", transition:"all 0.3s" }} />;
      })}
    </div>
  );
}

function TimerRing({ seconds, total, color }) {
  const r = 26, circ = 2*Math.PI*r;
  const danger = seconds <= 5;
  return (
    <div style={{ position:"relative", width:70, height:70, flexShrink:0 }}>
      <svg width="70" height="70" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle cx="35" cy="35" r={r} fill="none"
          stroke={danger?"#ff4d6d":color} strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ - circ*(seconds/total)}
          strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div style={{
        position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"'Bebas Neue',sans-serif", fontSize:22,
        color:danger?"#ff4d6d":"#f0eeea",
        textShadow:danger?"0 0 10px rgba(255,77,109,0.7)":"none",
        animation:danger?"timerTick 1s infinite":"none",
      }}>{seconds}</div>
    </div>
  );
}

function VoteBar({ label, pct, color, isMe }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5, color:isMe?color:"#555" }}>
        <span>{label}</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:4, height:8, overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:4, width:`${pct}%`,
          background:`linear-gradient(90deg,${color},${color}88)`,
          boxShadow:isMe?`0 0 10px ${color}55`:"none",
          transition:"width 0.8s ease",
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
@keyframes fadeUp    {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn    {from{opacity:0}to{opacity:1}}
@keyframes pulse     {0%,100%{opacity:1}50%{opacity:.35}}
@keyframes glowP     {0%,100%{box-shadow:0 0 20px #00f5a044}50%{box-shadow:0 0 50px #00f5a099}}
@keyframes spinRing  {to{transform:rotate(360deg)}}
@keyframes floatUp   {0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-100px)}}
@keyframes timerTick {0%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes winPop    {0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes smileWarn {0%,100%{opacity:1}50%{opacity:0.15}}
@keyframes chatSlide {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes livePing  {0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}
@keyframes scoreFlash{0%{color:#ffd60a;transform:scale(1.3)}100%{color:inherit;transform:scale(1)}}

/* Player layout — cams stack on mobile */
.player-grid {
  display: grid;
  grid-template-rows: 1fr 1fr;
  height: calc(100vh - 58px);
}
@media(min-width:640px){
  .player-grid {
    grid-template-rows: 1fr;
    grid-template-columns: 1fr 1fr;
  }
}

/* Spectator layout — side by side always, reaction panel on right */
.spectator-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 52px;
  height: calc(100vh - 58px);
}
@media(max-width:600px){
  .spectator-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr auto;
  }
  .spec-right { display: none; }
}
`;

/* ─────────────────────────────────────────────
   SPECTATOR VIEW
   Completely separate component — no camera,
   no game logic, pure watching experience
───────────────────────────────────────────── */
function SpectatorView({ gameMode, player1, player2, onBack }) {
  const mode = MODES[gameMode] || MODES.dontlaugh;

  // Fake scores for demo — in production these come via socket broadcast
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [timer,  setTimer]  = useState(mode.duration);
  const [round,  setRound]  = useState(1);

  // Reactions that float up on screen
  const [reactions, setReactions] = useState([]);

  // Live chat messages — in production come via socket
  const [chat, setChat] = useState([
    { id:1, user:"alex_k",   flag:"🇺🇸", msg:"this is hilarious 😂",      color:"#00f5a0" },
    { id:2, user:"priya_s",  flag:"🇮🇳", msg:"left guy is cracking",       color:"#00d4ff" },
    { id:3, user:"marco_r",  flag:"🇧🇷", msg:"no way he holds it 💀",      color:"#ff4d6d" },
    { id:4, user:"dragonz",  flag:"🇨🇳", msg:"LMAOOO",                     color:"#ffd60a" },
    { id:5, user:"nite_owl", flag:"🇬🇧", msg:"right guy looking nervous",   color:"#a78bfa" },
  ]);
  const chatRef = useRef(null);

  // Countdown timer for display
  useEffect(() => {
    const iv = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(iv); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [round]);

  // Fake chat messages rolling in — in prod these are socket events
  useEffect(() => {
    const msgs = [
      { user:"fan_99",   flag:"🇰🇷", msg:"he's gonna smile any second",  color:"#00f5a0" },
      { user:"watcher",  flag:"🇩🇪", msg:"😂😂😂",                         color:"#ff4d6d" },
      { user:"lurk3r",   flag:"🇯🇵", msg:"10 points on right guy",        color:"#ffd60a" },
      { user:"spectate", flag:"🇳🇵", msg:"this is StrangerPlay at its best", color:"#00d4ff" },
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (i >= msgs.length) return;
      const msg = { ...msgs[i], id: Date.now() };
      setChat(c => [...c.slice(-20), msg]);
      i++;
      // Auto scroll chat to bottom
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  const addReaction = (emoji) => {
    const id = Date.now();
    setReactions(r => [...r, { id, emoji, x: Math.random()*80+10, side: Math.random()>0.5?"left":"right" }]);
    setTimeout(() => setReactions(r => r.filter(rx=>rx.id!==id)), 2500);
    socket.emit("reaction", { emoji });
  };

  const danger = timer <= 5;

  return (
    <div style={{ minHeight:"100vh", background:BG, color:"#f0eeea", fontFamily:"'Syne',sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>

      {/* ── NAV — spectator style ── */}
      <nav style={{ height:58, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", background:"rgba(14,14,15,0.95)", backdropFilter:"blur(24px)", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0, zIndex:100 }}>
        {/* Left: branding */}
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:26, height:26, borderRadius:7, background:"linear-gradient(135deg,#00f5a0,#00d4ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, animation:"glowP 3s infinite" }}>▶</div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, background:"linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>StrangerPlay</span>
          {/* LIVE badge */}
          <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(255,77,109,0.12)", border:"1px solid rgba(255,77,109,0.25)", borderRadius:20, padding:"3px 10px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#ff4d6d", animation:"livePing 1s infinite" }} />
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#ff4d6d", letterSpacing:1 }}>LIVE</span>
          </div>
        </div>

        {/* Center: SPORTS SCOREBOARD — player1 vs player2 */}
        <div style={{ display:"flex", alignItems:"center", gap:12, position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#00f5a0" }}>{player1?.username||"player 1"} {player1?.flag||"🌍"}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:"#00f5a0", lineHeight:1, animation: score1>0?"scoreFlash 0.4s":"none" }}>{score1}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#333", letterSpacing:2 }}>VS</div>
            {/* timer chip */}
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:danger?"#ff4d6d":"#f0eeea", background:danger?"rgba(255,77,109,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${danger?"rgba(255,77,109,0.3)":"rgba(255,255,255,0.08)"}`, borderRadius:8, padding:"2px 10px", transition:"all 0.3s" }}>
              {timer}s
            </div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#444" }}>R{round}/{TOTAL_ROUNDS}</div>
          </div>
          <div style={{ textAlign:"left" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ff4d6d" }}>{player2?.username||"player 2"} {player2?.flag||"🌍"}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:"#ff4d6d", lineHeight:1 }}>{score2}</div>
          </div>
        </div>

        {/* Right: mode + back */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:mode.color, background:`${mode.color}10`, border:`1px solid ${mode.color}25`, borderRadius:20, padding:"3px 10px" }}>
            {mode.emoji} {mode.label}
          </div>
          {onBack && <button onClick={onBack} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"6px 14px", color:"#555", fontSize:12, cursor:"pointer" }}>← leave</button>}
        </div>
      </nav>

      {/* ── BODY ── */}
      <div className="spectator-grid" style={{ flex:1, position:"relative" }}>

        {/* ── PLAYER 1 CAM (left) ── */}
        <div style={{ position:"relative", background:"#050506", borderRight:"1px solid rgba(255,255,255,0.04)", overflow:"hidden" }}>
          {/* Placeholder — in prod this is the WebRTC stream of player 1 */}
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10 }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(0,245,160,0.06)", border:"2px solid rgba(0,245,160,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>🧑</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#00f5a0" }}>{player1?.username||"player 1"}</div>
          </div>

          {/* Name tag — bottom left overlay */}
          <div style={{ position:"absolute", bottom:12, left:12, display:"flex", alignItems:"center", gap:7, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(12px)", borderRadius:10, padding:"6px 12px", border:"1px solid rgba(0,245,160,0.2)" }}>
            <span style={{ fontSize:14 }}>{player1?.flag||"🌍"}</span>
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#00f5a0", fontWeight:600 }}>{player1?.username||"player 1"}</div>
              <div style={{ fontSize:10, color:rankColor(player1?.points||0) }}>{getRank(player1?.points||0)} · {(player1?.points||0).toLocaleString()} pts</div>
            </div>
          </div>

          {/* Score badge — top left */}
          <div style={{ position:"absolute", top:12, left:12, fontFamily:"'Bebas Neue',sans-serif", fontSize:40, color:"#00f5a0", textShadow:"0 0 20px rgba(0,245,160,0.5)", lineHeight:1 }}>{score1}</div>

          {/* Floating reactions on this player's side */}
          {reactions.filter(r=>r.side==="left").map(r=>(
            <div key={r.id} style={{ position:"absolute", bottom:"25%", left:`${r.x*0.4}%`, fontSize:32, animation:"floatUp 2.5s forwards", pointerEvents:"none", zIndex:10 }}>{r.emoji}</div>
          ))}
        </div>

        {/* ── PLAYER 2 CAM (right) ── */}
        <div style={{ position:"relative", background:"#060507", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10 }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(255,77,109,0.06)", border:"2px solid rgba(255,77,109,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>🧑</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#ff4d6d" }}>{player2?.username||"player 2"}</div>
          </div>

          {/* Name tag — bottom right overlay */}
          <div style={{ position:"absolute", bottom:12, right:12, display:"flex", alignItems:"center", gap:7, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(12px)", borderRadius:10, padding:"6px 12px", border:"1px solid rgba(255,77,109,0.2)", flexDirection:"row-reverse" }}>
            <span style={{ fontSize:14 }}>{player2?.flag||"🌍"}</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ff4d6d", fontWeight:600 }}>{player2?.username||"player 2"}</div>
              <div style={{ fontSize:10, color:rankColor(player2?.points||0) }}>{getRank(player2?.points||0)} · {(player2?.points||0).toLocaleString()} pts</div>
            </div>
          </div>

          {/* Score badge — top right */}
          <div style={{ position:"absolute", top:12, right:12, fontFamily:"'Bebas Neue',sans-serif", fontSize:40, color:"#ff4d6d", textShadow:"0 0 20px rgba(255,77,109,0.5)", lineHeight:1 }}>{score2}</div>

          {/* Floating reactions */}
          {reactions.filter(r=>r.side==="right").map(r=>(
            <div key={r.id} style={{ position:"absolute", bottom:"25%", left:`${r.x*0.4+20}%`, fontSize:32, animation:"floatUp 2.5s forwards", pointerEvents:"none", zIndex:10 }}>{r.emoji}</div>
          ))}
        </div>

        {/* ── RIGHT REACTION STRIP — vertical emoji buttons ── */}
        <div className="spec-right" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:"8px 4px", background:"rgba(14,14,15,0.9)", borderLeft:"1px solid rgba(255,255,255,0.05)" }}>
          {["😂","🔥","💀","🤣","👏","😮","🎭","⚡"].map(e=>(
            <button key={e} onClick={()=>addReaction(e)} style={{ width:40, height:40, borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform 0.15s, background 0.15s" }}
              onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.2)"; ev.currentTarget.style.background="rgba(255,255,255,0.1)";}}
              onMouseLeave={ev=>{ev.currentTarget.style.transform="scale(1)"; ev.currentTarget.style.background="rgba(255,255,255,0.04)";}}
            >{e}</button>
          ))}
        </div>

        {/* ── LIVE CHAT — slides up from bottom over both cams ── */}
        <div style={{ position:"absolute", bottom:0, left:0, width:"40%", maxWidth:280, padding:"8px 12px 16px", pointerEvents:"none", zIndex:20 }}>
          <div ref={chatRef} style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:220, overflow:"hidden" }}>
            {chat.slice(-8).map((m,i)=>(
              <div key={m.id} style={{ display:"flex", alignItems:"flex-start", gap:6, animation:"chatSlide 0.3s both", animationDelay:`${i*0.04}s` }}>
                <span style={{ fontSize:12, flexShrink:0 }}>{m.flag}</span>
                <div style={{ background:"rgba(8,8,9,0.7)", backdropFilter:"blur(8px)", borderRadius:8, padding:"4px 9px", maxWidth:"100%" }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:m.color, fontWeight:600 }}>{m.user} </span>
                  <span style={{ fontSize:12, color:"#ccc" }}>{m.msg}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── GAME PROMPT TICKER — center bottom ── */}
        <div style={{ position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", whiteSpace:"nowrap", background:"rgba(0,0,0,0.82)", backdropFilter:"blur(16px)", border:`1px solid ${mode.color}33`, borderRadius:12, padding:"8px 18px", zIndex:25 }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:mode.color, letterSpacing:2, marginRight:8 }}>{mode.emoji}</span>
          <span style={{ fontSize:12, color:"#aaa" }}>{mode.desc}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PLAYER VIEW — main game component
   This is for the two people PLAYING
───────────────────────────────────────────── */
export default function GameScreen({
  gameMode    = "dontlaugh",
  roomId,
  role,
  opponent    = { username:"stranger", flag:"🌍", points:0 },
  entryFee    = 3,
  myPoints    = 0,
  myUsername  = "you",
  myFlag      = "🌍",
  onBack,
  onMatchEnd,
  // Set isPlayer=false to render SpectatorView instead
  isPlayer    = true,
  // Spectator-only props
  player1,
  player2,
}) {
  // Route to spectator layout immediately — no camera, no game logic
  if (!isPlayer) {
    return <SpectatorView gameMode={gameMode} player1={player1||opponent} player2={player2} onBack={onBack} />;
  }

  const mode = MODES[gameMode] || MODES.dontlaugh;

  /* ── STATE ── */
  const [phase,         setPhase]        = useState("loading");
  const [loadStatus,    setLoadStatus]   = useState("Asking for camera...");
  const [timer,         setTimer]        = useState(mode.duration);
  const [round,         setRound]        = useState(1);
  const [myRoundScores, setMyRoundScores]= useState([]);
  const [roundResult,   setRoundResult]  = useState(null);
  const [matchWon,      setMatchWon]     = useState(null);
  const [promptIdx,     setPromptIdx]    = useState(0);
  const [smileDetected, setSmileDetected]= useState(false);
  const [myVotePct,     setMyVotePct]    = useState(0);
  const [oppVotePct,    setOppVotePct]   = useState(0);
  const [voting,        setVoting]       = useState(false);
  const [mirrorPhase,   setMirrorPhase]  = useState("pose");
  const [myMirrorScore, setMyMirrorScore]= useState(null);
  const [reactions,     setReactions]    = useState([]);
  const [myScore,       setMyScore]      = useState(0);
  const [oppScore,      setOppScore]     = useState(0);
  const [oppLeft,       setOppLeft]      = useState(false);
  const [muted,         setMuted]        = useState(false);
  const [camOff,        setCamOff]       = useState(false);

  /* ── REFS ── */
  const myVideoRef    = useRef(null);   // your camera — shown BIG
  const oppVideoRef   = useRef(null);   // opponent camera — shown BIG
  const hiddenRef     = useRef(null);   // hidden video BlazeFace reads
  const overlayRef    = useRef(null);   // face landmark canvas
  const animRef       = useRef(null);
  const faceIvRef     = useRef(null);
  const timerIvRef    = useRef(null);
  const modelRef      = useRef(null);
  const streamRef     = useRef(null);
  const pcRef         = useRef(null);
  const phaseRef      = useRef("loading");
  const roundRef      = useRef(1);
  const poseLMRef     = useRef(null);

  // faceTrack: async interval writes → rAF reads (never mix)
  const faceTrack = useRef({ cx:0, cy:0, faceW:80, faceH:80, landmarks:null, mouthOpen:0, found:false });

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roundRef.current = round; }, [round]);

  /* ─────────────────────────────────────────────
     WEBRTC PEER CONNECTION
     STUN = free Google servers that tell each browser its public IP
     Without STUN two browsers behind routers can't find each other
  ───────────────────────────────────────────── */
  useEffect(() => {
    if (!roomId) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls:"stun:stun.l.google.com:19302" },
        { urls:"stun:stun1.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;

    // Remote stream arrived — opponent's camera
    pc.ontrack = (event) => {
      if (oppVideoRef.current && event.streams[0]) {
        oppVideoRef.current.srcObject = event.streams[0];
      }
    };

    // ICE candidate discovered — relay to opponent via server
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("webrtc:ice", { roomId, candidate:event.candidate });
    };

    // Receive offer (we are answerer)
    socket.on("webrtc:offer", async ({ sdp }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { roomId, sdp: pc.localDescription });
    });

    // Receive answer (we are offerer)
    socket.on("webrtc:answer", async ({ sdp }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    // ICE from opponent
    socket.on("webrtc:ice", async ({ candidate }) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    // Opponent quit mid-match
    socket.on("opponent:left", () => {
      setOppLeft(true);
      endMatch(true);
    });

    return () => {
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice");
      socket.off("opponent:left");
      pc.close();
    };
  }, [roomId]); // eslint-disable-line

  /* ─────────────────────────────────────────────
     CAMERA + FACE MODEL SETUP
  ───────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Request both video AND audio — opponent needs to hear you
        const s = await navigator.mediaDevices.getUserMedia({
          video:{ width:640, height:480, facingMode:"user" },
          audio:true,
        });
        if (!mounted) return;
        streamRef.current = s;

        // Hidden video — BlazeFace reads this for face detection
        if (hiddenRef.current) {
          hiddenRef.current.srcObject = s;
          await hiddenRef.current.play();
        }

        // Visible self-cam — this is YOUR camera shown big on screen
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = s;
          await myVideoRef.current.play();
        }

        // Add tracks to WebRTC — this is what the opponent sees/hears
        if (pcRef.current) {
          s.getTracks().forEach(track => pcRef.current.addTrack(track, s));

          // Offerer goes first — creates the SDP offer
          if (role === "offer") {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            socket.emit("webrtc:offer", { roomId, sdp: pcRef.current.localDescription });
          }
        }
      } catch {
        setLoadStatus("Camera blocked. Allow access and refresh.");
        return;
      }

      setLoadStatus("Loading face tracker...");
      await loadScript(CDN_TF);
      await loadScript(CDN_BLAZE);
      if (!window._faceModel) window._faceModel = await window.blazeface.load();
      if (!mounted) return;
      modelRef.current = window._faceModel;
      setLoadStatus("Ready.");
      setPhase("intro");
      setTimeout(() => { if (mounted) startRound(1); }, INTRO_DURATION);
    })();
    return () => { mounted = false; cleanup(); };
  }, []); // eslint-disable-line

  function cleanup() {
    cancelAnimationFrame(animRef.current);
    clearInterval(faceIvRef.current);
    clearInterval(timerIvRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }

  /* ─────────────────────────────────────────────
     FACE DETECTION — async setInterval, writes to ref
     NEVER inside rAF — this lesson was hard learned
  ───────────────────────────────────────────── */
  function startFaceInterval() {
    clearInterval(faceIvRef.current);
    faceIvRef.current = setInterval(async () => {
      if (!modelRef.current || !hiddenRef.current || hiddenRef.current.readyState < 2) return;
      try {
        const preds = await modelRef.current.estimateFaces(hiddenRef.current, false);
        if (preds.length > 0) {
          const f = preds[0];
          const [x1,y1] = f.topLeft, [x2,y2] = f.bottomRight;
          const lm = f.landmarks || [];
          faceTrack.current = {
            cx:(x1+x2)/2, cy:(y1+y2)/2, faceW:x2-x1, faceH:y2-y1,
            landmarks:lm, mouthOpen:getMouthOpenness(lm), found:true,
          };
        } else {
          faceTrack.current.found = false;
        }
      } catch {}
    }, FACE_INTERVAL);
  }

  /* ─────────────────────────────────────────────
     OVERLAY rAF — sync, reads faceTrack ref
     This draws the glowing face ring on YOUR camera
  ───────────────────────────────────────────── */
  function startRenderLoop() {
    cancelAnimationFrame(animRef.current);
    const render = () => {
      const canvas = overlayRef.current;
      if (!canvas) { animRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const ft = faceTrack.current;
      const vw = hiddenRef.current?.videoWidth  || 640;
      const vh = hiddenRef.current?.videoHeight || 480;

      if (ft.found && ft.faceW > 0) {
        const mx = W - ft.cx*(W/vw);
        const my = ft.cy*(H/vh);
        const fw = ft.faceW*(W/vw);
        const smiling = ft.mouthOpen > SMILE_THRESHOLD;
        const col = smiling ? "#ff4d6d" : "#00f5a0";

        ctx.beginPath();
        ctx.arc(mx, my, fw/2+10, 0, Math.PI*2);
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        ctx.shadowColor = col; ctx.shadowBlur = 18;
        ctx.stroke(); ctx.shadowBlur = 0;

        ctx.fillStyle = "#00d4ff";
        (ft.landmarks||[]).forEach(([lx,ly]) => {
          ctx.beginPath();
          ctx.arc(W - lx*(W/vw), ly*(H/vh), 3, 0, Math.PI*2);
          ctx.fill();
        });

        if (phaseRef.current === "playing" && gameMode === "dontlaugh") {
          setSmileDetected(smiling);
        }
      }
      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);
  }

  /* ─────────────────────────────────────────────
     ROUND SYSTEM
  ───────────────────────────────────────────── */
  function startRound(n) {
    const prompts = mode.prompts || mode.poses || [];
    setPromptIdx(Math.floor(Math.random() * prompts.length));
    setTimer(mode.duration);
    setRound(n);
    setSmileDetected(false);
    setVoting(false);
    setMyVotePct(0); setOppVotePct(0);
    setMirrorPhase("pose");
    setMyMirrorScore(null);
    poseLMRef.current = null;
    setPhase("playing");

    socket.emit("round:start", { roomId, round:n, mode:gameMode });
    startFaceInterval();
    startRenderLoop();

    clearInterval(timerIvRef.current);
    let t = mode.duration;
    timerIvRef.current = setInterval(() => {
      t--; setTimer(t);
      if (t <= 0) { clearInterval(timerIvRef.current); handleRoundEnd("timeout"); }
    }, 1000);
  }

  function handleRoundEnd(reason, winner=null) {
    clearInterval(timerIvRef.current);
    clearInterval(faceIvRef.current);
    cancelAnimationFrame(animRef.current);
    setSmileDetected(false);

    let iWon;
    if      (reason==="smiled")                             iWon = false;
    else if (reason==="timeout" && gameMode==="dontlaugh")  iWon = true;
    else iWon = winner!==null ? winner : Math.random()>0.5;

    const result = iWon ? "win" : "loss";
    setRoundResult(result);
    if (iWon) setMyScore(s=>s+1); else setOppScore(s=>s+1);
    setPhase("roundResult");

    setMyRoundScores(prev => {
      const next = [...prev, result];
      socket.emit("round:end", { roomId, round:roundRef.current, result });
      const wins = next.filter(r=>r==="win").length;
      const losses = next.filter(r=>r==="loss").length;
      const done = wins>=2 || losses>=2 || next.length>=TOTAL_ROUNDS;
      setTimeout(() => {
        if (done) endMatch(wins>=losses);
        else startRound(roundRef.current+1);
      }, RESULT_DURATION);
      return next;
    });
  }

  useEffect(() => {
    if (smileDetected && phaseRef.current==="playing" && gameMode==="dontlaugh") {
      handleRoundEnd("smiled");
    }
  }, [smileDetected]); // eslint-disable-line

  function endMatch(won) {
    setMatchWon(won);
    setPhase("matchResult");
    socket.emit("match:end", { roomId, won, entryFee, gameMode });
    if (onMatchEnd) onMatchEnd(won, entryFee);
  }

  function triggerVote() {
    clearInterval(timerIvRef.current);
    setVoting(true);
    let elapsed = 0;
    const iv = setInterval(() => {
      elapsed++;
      const me = 35+Math.random()*30;
      setMyVotePct(me); setOppVotePct(100-me);
      if (elapsed>=VOTE_DURATION) {
        clearInterval(iv);
        const final = 35+Math.random()*35;
        setMyVotePct(final); setOppVotePct(100-final);
        handleRoundEnd("vote", final>=50);
      }
    }, 1000);
  }

  function captureMyPose() {
    poseLMRef.current = faceTrack.current.landmarks;
    setMirrorPhase("copy");
    let t = 5; setTimer(5);
    const iv = setInterval(() => {
      t--; setTimer(t);
      if (t<=0) {
        clearInterval(iv);
        const sc = mirrorScore(poseLMRef.current, faceTrack.current.landmarks);
        setMyMirrorScore(sc);
        handleRoundEnd("mirror", sc>=50);
      }
    }, 1000);
  }

  function addReaction(emoji) {
    const id = Date.now();
    setReactions(r=>[...r,{id,emoji,x:Math.random()*70+10}]);
    setTimeout(()=>setReactions(r=>r.filter(rx=>rx.id!==id)),2500);
    socket.emit("reaction", { roomId, emoji });
  }

  function toggleMute() {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => t.enabled = muted);
    setMuted(m=>!m);
  }

  function toggleCam() {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach(t => t.enabled = camOff);
    setCamOff(c=>!c);
  }

  function playAgain() {
    setMyRoundScores([]); setMyScore(0); setOppScore(0);
    setMatchWon(null); setRoundResult(null);
    setPhase("intro");
    setTimeout(()=>startRound(1), INTRO_DURATION);
  }

  const prompts = mode.prompts || mode.poses || [];
  const currentPrompt = prompts[promptIdx] || prompts[0] || "";
  const danger = timer <= 5;

  /* ─────────────────────────────────────────────
     PLAYER RENDER
     Layout: two big cams side by side (desktop) or stacked (mobile)
     No tiny pip — both cams are full and equal
  ───────────────────────────────────────────── */
  return (
    <div style={{ height:"100vh", background:BG, color:"#f0eeea", fontFamily:"'Syne',sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{CSS}</style>

      {/* Hidden video — face detection only */}
      <video ref={hiddenRef} style={{ position:"fixed", opacity:0, pointerEvents:"none", width:1, height:1 }} muted playsInline />

      {/* ══════ NAV ══════ */}
      <nav style={{ flexShrink:0, height:58, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 clamp(10px,3vw,24px)", background:"rgba(14,14,15,0.95)", backdropFilter:"blur(24px)", borderBottom:"1px solid rgba(255,255,255,0.06)", zIndex:100 }}>
        {/* Left: logo + game label */}
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:26, height:26, borderRadius:7, background:"linear-gradient(135deg,#00f5a0,#00d4ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, animation:"glowP 3s infinite" }}>▶</div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, background:"linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>StrangerPlay</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#333", marginLeft:4 }}>// {mode.label}</span>
        </div>

        {/* Center: score + timer — the sports scoreboard */}
        <div style={{ display:"flex", alignItems:"center", gap:14, position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#00f5a0" }}>{myUsername}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"#00f5a0", lineHeight:1 }}>{myScore}</div>
          </div>
          <TimerRing seconds={timer} total={mode.duration} color={mode.color} />
          <div style={{ textAlign:"left" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#ff4d6d" }}>{opponent.username}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"#ff4d6d", lineHeight:1 }}>{oppScore}</div>
          </div>
        </div>

        {/* Right: round dots + pts + back */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <RoundDots total={TOTAL_ROUNDS} scores={myRoundScores} />
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a", background:"rgba(255,214,10,0.07)", border:"1px solid rgba(255,214,10,0.14)", borderRadius:20, padding:"3px 10px" }}>{myPoints}pts</div>
          {onBack && <button onClick={()=>{cleanup();onBack();}} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"6px 14px", color:"#555", fontSize:12, cursor:"pointer" }}>← exit</button>}
        </div>
      </nav>

      {/* ══════ DUAL CAM GRID ══════
          Both cameras are equal size — no tiny PIP
          Desktop: side by side
          Mobile:  stacked vertically (opponent top, you bottom)
      */}
      <div className="player-grid" style={{ flex:1, position:"relative" }}>

        {/* ── OPPONENT CAM (left on desktop, top on mobile) ── */}
        <div style={{ position:"relative", background:"#050506", overflow:"hidden", borderRight:"1px solid rgba(255,255,255,0.04)" }}>
          {/* Opponent video stream — fills entire half */}
          <video ref={oppVideoRef} autoPlay playsInline
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
          />

          {/* Connecting placeholder — hidden once stream arrives */}
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, pointerEvents:"none", zIndex:2 }}>
            {oppLeft ? (
              <>
                <div style={{ fontSize:44 }}>👋</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#ff4d6d" }}>{opponent.username} left</div>
                <div style={{ fontSize:11, color:"#444" }}>you win by default</div>
              </>
            ) : (
              <>
                <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(255,77,109,0.06)", border:"2px solid rgba(255,77,109,0.18)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🧑</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#ff4d6d" }}>{opponent.username} {opponent.flag}</div>
                <div style={{ fontSize:10, color:"#333" }}>connecting...</div>
              </>
            )}
          </div>

          {/* Opponent name tag — bottom left */}
          <div style={{ position:"absolute", bottom:80, left:12, display:"flex", alignItems:"center", gap:8, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(12px)", borderRadius:10, padding:"7px 12px", border:"1px solid rgba(255,77,109,0.2)", zIndex:5 }}>
            <span style={{ fontSize:16 }}>{opponent.flag}</span>
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#ff4d6d", fontWeight:600 }}>{opponent.username}</div>
              <div style={{ fontSize:10, color:rankColor(opponent.points) }}>{getRank(opponent.points)} · {(opponent.points||0).toLocaleString()} pts</div>
            </div>
          </div>

          {/* Reactions floating on opponent's side */}
          {reactions.map(r=>(
            <div key={r.id} style={{ position:"absolute", bottom:"30%", left:`${r.x}%`, fontSize:30, animation:"floatUp 2.5s forwards", pointerEvents:"none", zIndex:10 }}>{r.emoji}</div>
          ))}

          {/* Round result overlay — only on opponent side */}
          {phase==="roundResult" && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(8,8,9,0.82)", zIndex:15, animation:"fadeIn 0.3s both" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(44px,10vw,72px)", letterSpacing:3, color:roundResult==="win"?"#00f5a0":"#ff4d6d", textShadow:`0 0 40px ${roundResult==="win"?"rgba(0,245,160,0.7)":"rgba(255,77,109,0.7)"}`, animation:"winPop 0.5s both" }}>
                {roundResult==="win"?"WIN 🎉":"LOSS 💀"}
              </div>
            </div>
          )}
        </div>

        {/* ── YOUR CAM (right on desktop, bottom on mobile) ── */}
        <div style={{ position:"relative", background:"#060507", overflow:"hidden" }}>
          {/* Your video — fills entire half, mirrored like a selfie cam */}
          <video ref={myVideoRef} autoPlay muted playsInline
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)", display:camOff?"none":"block" }}
          />
          {camOff && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#080809" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:44, marginBottom:10 }}>📷</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#333" }}>camera off</div>
              </div>
            </div>
          )}

          {/* Face landmark overlay — drawn on your cam */}
          <canvas ref={overlayRef} width={640} height={480}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:3, transform:"scaleX(-1)" }}
          />

          {/* Smile detected flash border */}
          {smileDetected && (
            <div style={{ position:"absolute", inset:0, border:"4px solid #ff4d6d", boxShadow:"inset 0 0 50px rgba(255,77,109,0.4)", animation:"smileWarn 0.3s infinite", pointerEvents:"none", zIndex:6 }} />
          )}

          {/* YOU smiled warning text */}
          {gameMode==="dontlaugh" && smileDetected && (
            <div style={{ position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(32px,8vw,56px)", color:"#ff4d6d", textShadow:"0 0 30px rgba(255,77,109,0.9)", animation:"smileWarn 0.3s infinite", whiteSpace:"nowrap", zIndex:8, pointerEvents:"none" }}>
              YOU SMILED 😂
            </div>
          )}

          {/* Your name tag — bottom right */}
          <div style={{ position:"absolute", bottom:80, right:12, display:"flex", alignItems:"center", gap:8, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(12px)", borderRadius:10, padding:"7px 12px", border:"1px solid rgba(0,245,160,0.2)", flexDirection:"row-reverse", zIndex:5 }}>
            <span style={{ fontSize:16 }}>{myFlag}</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#00f5a0", fontWeight:600 }}>{myUsername}</div>
              <div style={{ fontSize:10, color:rankColor(myPoints) }}>{getRank(myPoints)} · {myPoints.toLocaleString()} pts</div>
            </div>
          </div>

          {/* ── GAME PROMPT — overlaid on your cam, bottom center ── */}
          {phase==="playing" && (
            <div style={{ position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)", width:"calc(100% - 24px)", zIndex:7 }}>

              {/* Don't Laugh / Vibe Check / Hot Take prompt */}
              {(gameMode==="dontlaugh"||gameMode==="vibecheck"||gameMode==="hottake") && !voting && (
                <div style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(16px)", borderRadius:14, padding:"12px 16px", border:`1px solid ${mode.color}33` }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:mode.color, letterSpacing:2, marginBottom:5 }}>
                    {gameMode==="dontlaugh"?"IMAGINE THIS:":gameMode==="hottake"?"HOT TAKE:":"YOUR VIBE:"}
                  </div>
                  <div style={{ fontSize:"clamp(12px,2.5vw,15px)", fontWeight:600, color:"#f0eeea", lineHeight:1.5 }}>{currentPrompt}</div>
                </div>
              )}

              {/* Mirror Me controls */}
              {gameMode==="mirrorme" && (
                <div style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(16px)", borderRadius:14, padding:"12px 16px", border:`1px solid ${mode.color}33` }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:mode.color, letterSpacing:2, marginBottom:5 }}>
                    {mirrorPhase==="pose"?"MAKE THIS FACE:":"NOW COPY IT:"}
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#f0eeea", marginBottom:mirrorPhase==="pose"?10:0 }}>{currentPrompt}</div>
                  {mirrorPhase==="pose" && (
                    <button onClick={captureMyPose} style={{ background:`linear-gradient(135deg,${mode.color},#00d4ff)`, color:"#0a0a0a", border:"none", borderRadius:8, padding:"8px 20px", fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:2, cursor:"pointer" }}>
                      CAPTURE POSE
                    </button>
                  )}
                  {myMirrorScore!==null && (
                    <div style={{ marginTop:6, fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:mode.color }}>Accuracy: {myMirrorScore}/100</div>
                  )}
                </div>
              )}

              {/* Crowd vote trigger */}
              {(gameMode==="vibecheck"||gameMode==="hottake") && !voting && timer<=mode.duration-5 && (
                <button onClick={triggerVote} style={{ marginTop:8, width:"100%", background:`linear-gradient(135deg,${mode.color},#a064ff)`, color:"#0a0a0a", border:"none", borderRadius:12, padding:"12px 0", fontFamily:"'Bebas Neue',sans-serif", fontSize:17, letterSpacing:2, cursor:"pointer" }}>
                  START CROWD VOTE
                </button>
              )}

              {/* Vote bars */}
              {voting && (
                <div style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(16px)", borderRadius:14, padding:14, border:`1px solid ${mode.color}33` }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#444", letterSpacing:2, marginBottom:10 }}>CROWD VOTE</div>
                  <VoteBar label={`${myUsername} ${myFlag}`}       pct={myVotePct}  color="#00f5a0" isMe />
                  <VoteBar label={`${opponent.username} ${opponent.flag}`} pct={oppVotePct} color="#ff4d6d" />
                </div>
              )}
            </div>
          )}

          {/* ── INTRO OVERLAY on your cam ── */}
          {phase==="intro" && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, background:"rgba(8,8,9,0.78)", zIndex:10, animation:"fadeIn 0.3s both" }}>
              <div style={{ fontSize:52 }}>{mode.emoji}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,6vw,44px)", letterSpacing:3, color:mode.color, textShadow:`0 0 30px ${mode.color}` }}>{mode.label.toUpperCase()}</div>
              <div style={{ fontSize:13, color:"#555", textAlign:"center", maxWidth:260, lineHeight:1.6, padding:"0 20px" }}>{mode.desc}</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#333", letterSpacing:2, animation:"pulse 1.5s infinite" }}>starting round 1...</div>
            </div>
          )}

          {/* ── LOADING OVERLAY ── */}
          {phase==="loading" && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:"rgba(8,8,9,0.96)", zIndex:10 }}>
              <div style={{ width:50, height:50, borderRadius:"50%", border:"2px solid transparent", borderTopColor:"#00f5a0", borderRightColor:"#00d4ff", animation:"spinRing 1s linear infinite" }} />
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, color:"#00f5a0" }}>SETTING UP</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#444", textAlign:"center", maxWidth:240, padding:"0 20px" }}>{loadStatus}</div>
            </div>
          )}
        </div>

        {/* ── BOTTOM CONTROL BAR — fixed over both cams ── */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:68, display:"flex", alignItems:"center", justifyContent:"center", gap:14, background:"linear-gradient(to top, rgba(8,8,9,0.95), transparent)", zIndex:20, padding:"0 20px" }}>

          {/* Mute */}
          <button onClick={toggleMute} style={{ width:48, height:48, borderRadius:"50%", background:muted?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.08)", border:`1.5px solid ${muted?"rgba(255,77,109,0.5)":"rgba(255,255,255,0.12)"}`, color:"#f0eeea", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
            {muted?"🔇":"🎤"}
          </button>

          {/* Cam toggle */}
          <button onClick={toggleCam} style={{ width:48, height:48, borderRadius:"50%", background:camOff?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.08)", border:`1.5px solid ${camOff?"rgba(255,77,109,0.5)":"rgba(255,255,255,0.12)"}`, color:"#f0eeea", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
            {camOff?"🚫":"📷"}
          </button>

          {/* Reaction buttons */}
          {["😂","🔥","😮"].map(e=>(
            <button key={e} onClick={()=>addReaction(e)} style={{ width:44, height:44, borderRadius:"50%", background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.1)", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform 0.15s" }}
              onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.2)"}
              onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}
            >{e}</button>
          ))}

          {/* Hang up — big red, center */}
          <button onClick={()=>{cleanup();if(roomId)socket.emit("match:leave",{roomId});if(onBack)onBack();}} style={{ width:58, height:58, borderRadius:"50%", background:"#ff4d6d", border:"none", fontSize:22, cursor:"pointer", boxShadow:"0 0 28px rgba(255,77,109,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}>📵</button>

          {/* Entry fee pot */}
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a", background:"rgba(255,214,10,0.07)", border:"1px solid rgba(255,214,10,0.18)", borderRadius:20, padding:"5px 12px" }}>
            🏆 {entryFee*2} pts
          </div>
        </div>
      </div>

      {/* ══════ MATCH RESULT FULLSCREEN ══════ */}
      {phase==="matchResult" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(8,8,9,0.96)", backdropFilter:"blur(20px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, zIndex:500, animation:"fadeIn 0.4s both" }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(56px,12vw,96px)", letterSpacing:4, lineHeight:1, color:matchWon?"#00f5a0":"#ff4d6d", textShadow:`0 0 60px ${matchWon?"rgba(0,245,160,0.7)":"rgba(255,77,109,0.7)"}`, animation:"winPop 0.6s both" }}>
            {matchWon?"YOU WIN 🎉":"YOU LOSE 💀"}
          </div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
            {[["rounds won",myScore,"#00f5a0"],["rounds lost",oppScore,"#ff4d6d"],["pts pot",entryFee*2,"#ffd60a"]].map(([l,v,c])=>(
              <div key={l} style={{ textAlign:"center", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"14px 20px" }}>
                <div style={{ fontSize:10, color:"#444", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:44, color:c, lineHeight:1 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, color:matchWon?"#ffd60a":"#ff4d6d", background:matchWon?"rgba(255,214,10,0.08)":"rgba(255,77,109,0.08)", border:`1px solid ${matchWon?"rgba(255,214,10,0.2)":"rgba(255,77,109,0.2)"}`, borderRadius:12, padding:"11px 28px" }}>
            {matchWon?`+${entryFee} pts earned`:`-${entryFee} pts lost`}
          </div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
            <button onClick={playAgain} style={{ background:"linear-gradient(135deg,#00f5a0,#00d4ff)", color:"#0a0a0a", border:"none", borderRadius:12, padding:"13px 32px", fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:2, cursor:"pointer", boxShadow:"0 0 30px rgba(0,245,160,0.35)" }}>PLAY AGAIN</button>
            {onBack && <button onClick={()=>{cleanup();onBack();}} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"13px 24px", color:"#555", fontSize:14, cursor:"pointer" }}>Exit</button>}
          </div>
        </div>
      )}
    </div>
  );
}
