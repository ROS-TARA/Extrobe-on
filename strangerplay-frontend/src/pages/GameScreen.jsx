import { useState, useEffect, useRef, useCallback } from "react";

// ─── What is socket.js doing here? ───────────────────────────────────────────
// We import the singleton socket connection we created in socket.js.
// A singleton means: one socket for the whole app — no matter how many
// components import it, they all share the same connection. This prevents
// opening 5 sockets when you render 5 components.
import { socket } from "../socket";

/* ─────────────────────────────────────────────
   GAME DEFINITIONS
   Each game has: id, emoji, title, color, rounds,
   duration per round (seconds), and a prompt generator.
   Adding a new game = just add an entry here. Nothing else changes.
───────────────────────────────────────────── */
const GAMES = {
  dont_laugh: {
    id: "dont_laugh", emoji: "😐", title: "DON'T LAUGH", color: "#00f5a0",
    rounds: 3, roundDuration: 30,
    desc: "keep a straight face. first to crack loses the round.",
    prompts: [
      "your opponent is now doing their best impression of a disappointed grandma",
      "imagine your opponent just sat on a whoopee cushion at a job interview",
      "your opponent must now explain cryptocurrency to a golden retriever",
      "your opponent is auditioning for a dramatic soap opera. about soup.",
      "your opponent just realized they've been mispronouncing 'quinoa' for 10 years",
    ],
  },
  mirror_me: {
    id: "mirror_me", emoji: "🪞", title: "MIRROR ME", color: "#00d4ff",
    rounds: 3, roundDuration: 20,
    desc: "copy your opponent's expression exactly. crowd votes on who matched best.",
    prompts: [
      "do: surprised pikachu face",
      "do: trying-not-to-cry face at a wedding",
      "do: you just bit into a lemon face",
      "do: pretending to understand what someone said face",
      "do: realizing the milk expired yesterday face",
    ],
  },
  vibe_check: {
    id: "vibe_check", emoji: "🎭", title: "VIBE CHECK", color: "#ff4d6d",
    rounds: 3, roundDuration: 25,
    desc: "embody the character. crowd picks the winner.",
    prompts: [
      "you are a robot who just discovered feelings for the first time",
      "you are a grandma explaining tiktok to her cat",
      "you are a news anchor reporting that cheese is now illegal",
      "you are a demon who is actually very polite and apologetic",
      "you are a medieval knight reviewing a modern smartphone",
    ],
  },
  hot_take: {
    id: "hot_take", emoji: "🌶️", title: "HOT TAKE", color: "#ffd60a",
    rounds: 4, roundDuration: 15,
    desc: "react to the take in 5 seconds. crowd judges your reaction.",
    prompts: [
      "cereal is just cold soup and we've been lying to ourselves",
      "elevators should have a standing-only lane",
      "people who use speaker phone in public deserve a timeout",
      "the side dish is always better than the main course",
      "we should have to pass a test before we're allowed to have opinions",
      "alarm clocks are the worst invention in human history",
    ],
  },
  finish_my_story: {
    id: "finish_my_story", emoji: "📖", title: "FINISH MY STORY", color: "#a064ff",
    rounds: 2, roundDuration: 45,
    desc: "one starts. one ends. crowd rates the combo.",
    prompts: [
      "i was walking my dog when i noticed the dog was walking me back…",
      "the package arrived exactly as ordered. except it was alive…",
      "she opened the fridge and found a note that read 'we need to talk'…",
      "on the last day of work, the office printer finally spoke…",
    ],
  },
  speed_roast: {
    id: "speed_roast", emoji: "🔥", title: "SPEED ROAST", color: "#ff9f43",
    rounds: 2, roundDuration: 30,
    desc: "30 seconds. two strangers. crowd picks who got cooked.",
    prompts: [
      "roast: your opponent's wifi name",
      "roast: your opponent's sleep schedule based on their vibe",
      "roast: your opponent's main personality trait right now",
      "roast: the last app your opponent probably opened",
    ],
  },
};

const CROWD_EMOJIS = ["😂", "🔥", "💀", "😭", "👑", "🤌", "😤", "🫡", "🥹", "💅"];

const BG = `linear-gradient(to right,
  #141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,
  #1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,
  #262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,
  #303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

/* ─────────────────────────────────────────────
   STYLES — injected once into <head>
   Same pattern as all other pages in this project.
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@400;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { color: #f0eeea; font-family: 'Syne', sans-serif; }

@keyframes fadeUp      { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn      { from{opacity:0} to{opacity:1} }
@keyframes floatUp     { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-110px) scale(1.4)} }
@keyframes pulse       { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.85)} }
@keyframes glowPulse   { 0%,100%{box-shadow:0 0 20px #00f5a044} 50%{box-shadow:0 0 55px #00f5a099} }
@keyframes cdPop       { 0%{transform:scale(2.2);opacity:0} 20%{opacity:1;transform:scale(1)} 80%{opacity:1;transform:scale(1)} 100%{transform:scale(.4);opacity:0} }
@keyframes shimmer     { to{background-position:200% center} }
@keyframes timerPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
@keyframes ringRotate  { to{transform:rotate(360deg)} }
@keyframes slideInLeft { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
@keyframes slideInRight{ from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
@keyframes resultPop   { 0%{transform:scale(0) rotate(-8deg);opacity:0} 60%{transform:scale(1.06) rotate(2deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
@keyframes scanline    { 0%{top:-4px} 100%{top:100%} }
@keyframes crowdBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }

/* video feeds */
.gs-video-me, .gs-video-opp {
  width: 100%; height: 100%; object-fit: cover;
  border-radius: 12px; display: block;
  transform: scaleX(-1); /* mirror own feed */
}
.gs-video-opp { transform: scaleX(1); }

/* countdown digit */
.gs-cd {
  position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; z-index: 20; pointer-events: none;
}
.gs-cd-num {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(96px, 20vw, 180px);
  color: #00f5a0;
  text-shadow: 0 0 60px #00f5a0aa, 0 0 120px #00f5a055;
  animation: cdPop 1s ease forwards;
}

/* round prompt banner */
.gs-prompt {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(11px, 2vw, 14px);
  color: rgba(240,238,234,.7);
  text-align: center;
  line-height: 1.5;
  letter-spacing: 0.02em;
  animation: fadeUp .4s ease forwards;
}

/* timer ring SVG */
.gs-timer-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
.gs-timer-num {
  position: absolute;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 32px;
  letter-spacing: 1px;
}

/* score badges */
.gs-score-badge {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(28px, 6vw, 48px);
  letter-spacing: 2px;
}

/* crowd bar */
.gs-crowd-emoji {
  font-size: 22px;
  cursor: pointer;
  transition: transform .1s;
  animation: crowdBounce 2s ease-in-out infinite;
}
.gs-crowd-emoji:hover { transform: scale(1.35); }

/* responsive */
@media (max-width: 768px) {
  .gs-split { flex-direction: column !important; }
  .gs-split > * { flex: none !important; height: 38vh !important; }
  .gs-sidebar { display: none !important; }
  .gs-bottom-crowd { display: flex !important; }
  .gs-meta-row { flex-direction: column !important; gap: 12px !important; }
}
`;

/* ─────────────────────────────────────────────
   PARTICLE FIELD — same as rest of the app
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
    const count = window.innerWidth < 768 ? 40 : 80;
    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      dx: (Math.random() - .5) * .2, dy: (Math.random() - .5) * .2,
      r: Math.random() * 1.2 + .3, a: Math.random() * .4 + .1,
      c: Math.random() > .5 ? "#00f5a0" : "#00d4ff",
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

/* ─────────────────────────────────────────────
   TIMER RING
   SVG circle that drains as time counts down.
   strokeDashoffset is what controls how "full" the ring looks —
   we lerp it from 0 → circumference as time runs out.
───────────────────────────────────────────── */
function TimerRing({ seconds, total, color, size = 72, danger = false }) {
  const R = (size / 2) - 5;
  // circumference = 2πr — the total length of the circle's perimeter
  const circ = 2 * Math.PI * R;
  // how much of the ring to "hide" based on time remaining
  const offset = circ * (1 - seconds / total);
  const col = danger ? "#ff4d6d" : color;
  return (
    <div className="gs-timer-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* background track */}
        <circle cx={size/2} cy={size/2} r={R} fill="none"
          stroke="rgba(255,255,255,.06)" strokeWidth={4} />
        {/* progress arc */}
        <circle cx={size/2} cy={size/2} r={R} fill="none"
          stroke={col} strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 1s linear, stroke .3s",
            filter: `drop-shadow(0 0 6px ${col}88)`,
          }}
        />
      </svg>
      {/* the number in the center */}
      <span className="gs-timer-num" style={{ color: col, animation: danger ? "timerPulse .6s ease-in-out infinite" : "none" }}>
        {seconds}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FLOATING CROWD REACTION
   Each emoji animates up and fades. We give it a random
   left position so they spread across the screen.
───────────────────────────────────────────── */
function FloatEmoji({ id, emoji, x }) {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: `${x}%`,
      fontSize: 28, animation: "floatUp 2.2s ease-out forwards",
      pointerEvents: "none", zIndex: 10,
      filter: "drop-shadow(0 0 8px rgba(0,245,160,.5))",
    }}>
      {emoji}
    </div>
  );
}

/* ─────────────────────────────────────────────
   VIDEO TILE
   Wraps a video element + player name + a scanline effect.
   The scanline is purely aesthetic — a thin line that
   sweeps down the video making it feel like a live feed.
───────────────────────────────────────────── */
function VideoTile({ videoRef, label, flag, score, color, side, speaking }) {
  return (
    <div style={{
      flex: 1, position: "relative", borderRadius: 14,
      border: `1.5px solid ${speaking ? color : "rgba(255,255,255,.08)"}`,
      overflow: "hidden", background: "#0a0a0b",
      boxShadow: speaking ? `0 0 32px ${color}44` : "none",
      transition: "border-color .3s, box-shadow .3s",
      animation: side === "left" ? "slideInLeft .5s ease" : "slideInRight .5s ease",
    }}>
      <video ref={videoRef}
        className={side === "left" ? "gs-video-me" : "gs-video-opp"}
        autoPlay playsInline muted={side === "left"} />

      {/* scanline sweep — purely visual */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2,
        background: `linear-gradient(to right, transparent, ${color}44, transparent)`,
        animation: "scanline 3s linear infinite",
        zIndex: 3, pointerEvents: "none",
      }} />

      {/* name + score chip */}
      <div style={{
        position: "absolute", bottom: 12, left: 12,
        display: "flex", alignItems: "center", gap: 8, zIndex: 4,
      }}>
        <div style={{
          background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)",
          border: `1px solid rgba(255,255,255,.1)`, borderRadius: 8,
          padding: "4px 10px",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          color: "#f0eeea", display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>{flag}</span>
          <span>{label}</span>
        </div>
        <div style={{
          background: `${color}22`, border: `1px solid ${color}66`,
          borderRadius: 8, padding: "4px 10px",
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
          color, letterSpacing: 1,
        }}>
          {score}
        </div>
      </div>

      {/* LIVE dot */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 4,
        display: "flex", alignItems: "center", gap: 5,
        background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "3px 8px",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%", background: "#ff4d6d",
          animation: "pulse 1.2s ease-in-out infinite",
        }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#ff4d6d", letterSpacing: 1 }}>LIVE</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROUND RESULT OVERLAY
   Shown for 2 seconds between rounds.
   winner = "me" | "them" | "draw"
───────────────────────────────────────────── */
function RoundResult({ winner, myName, oppName, game }) {
  const messages = {
    me: ["you survived", "clean", "they cracked first", "carry"],
    them: ["oof", "got cooked", "try next round", "close one"],
    draw: ["no one wins", "mutual suffering", "crowd is confused", "honestly fair"],
  };
  const picks = messages[winner] || messages.draw;
  const msg = picks[Math.floor(Math.random() * picks.length)];
  const color = winner === "me" ? "#00f5a0" : winner === "them" ? "#ff4d6d" : "#ffd60a";

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,.82)", backdropFilter: "blur(12px)",
    }}>
      <div style={{
        textAlign: "center", animation: "resultPop .5s cubic-bezier(.34,1.56,.64,1) forwards",
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(56px,12vw,100px)",
          color, textShadow: `0 0 60px ${color}88`,
          lineHeight: 1, marginBottom: 12,
        }}>
          {winner === "me" ? "ROUND WON" : winner === "them" ? "ROUND LOST" : "DRAW"}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
          color: "rgba(240,238,234,.5)", letterSpacing: 2, textTransform: "uppercase",
        }}>
          // {msg}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MATCH RESULT SCREEN
   Shown when all rounds are done.
───────────────────────────────────────────── */
function MatchResult({ myScore, oppScore, myName, oppName, game, pointsWon, pointsWagered, onBack, onRematch }) {
  const won = myScore > oppScore;
  const draw = myScore === oppScore;
  const color = won ? "#00f5a0" : draw ? "#ffd60a" : "#ff4d6d";

  // What did we learn?
  // When you map over an array, React needs each child to have a unique `key`
  // so it can efficiently update only what changed instead of re-rendering everything.
  const stats = [
    { label: "rounds won",   val: myScore },
    { label: "rounds lost",  val: oppScore },
    { label: "pts wagered",  val: pointsWagered },
    { label: won ? "pts gained" : "pts lost", val: won ? `+${pointsWon}` : `-${pointsWagered}`, highlight: true },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: BG, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 32,
      padding: "0 24px",
    }}>
      <ParticleField />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 480, width: "100%" }}>
        {/* verdict */}
        <div style={{
          fontFamily: "'Bebas Neue',sans-serif",
          fontSize: "clamp(72px,18vw,140px)",
          color, lineHeight: .9, marginBottom: 6,
          textShadow: `0 0 80px ${color}66`,
          animation: "resultPop .6s cubic-bezier(.34,1.56,.64,1) forwards",
        }}>
          {won ? "YOU WIN" : draw ? "DRAW" : "YOU LOSE"}
        </div>

        <div style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
          color: "rgba(240,238,234,.4)", letterSpacing: 2, marginBottom: 36,
        }}>
          // {game.title.toLowerCase()} · {myScore}–{oppScore}
        </div>

        {/* stat grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32,
        }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: s.highlight ? `${color}11` : "rgba(255,255,255,.04)",
              border: `1px solid ${s.highlight ? color + "44" : "rgba(255,255,255,.07)"}`,
              borderRadius: 10, padding: "14px 16px",
            }}>
              <div style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 28, color: s.highlight ? color : "#f0eeea",
                letterSpacing: 1,
              }}>{s.val}</div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                color: "rgba(240,238,234,.4)", letterSpacing: 1, marginTop: 2,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onRematch} style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2,
            padding: "13px 32px", borderRadius: 10, border: "none", cursor: "pointer",
            background: color, color: "#0a0a0b",
            boxShadow: `0 0 30px ${color}55`,
            transition: "transform .15s, box-shadow .15s",
          }}
            onMouseEnter={e => { e.target.style.transform = "scale(1.04)"; }}
            onMouseLeave={e => { e.target.style.transform = "scale(1)"; }}
          >REMATCH</button>

          <button onClick={onBack} style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2,
            padding: "13px 32px", borderRadius: 10, cursor: "pointer",
            background: "transparent",
            border: "1.5px solid rgba(255,255,255,.15)",
            color: "rgba(240,238,234,.7)",
            transition: "border-color .2s, color .2s",
          }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(255,255,255,.4)"; e.target.style.color = "#f0eeea"; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,.15)"; e.target.style.color = "rgba(240,238,234,.7)"; }}
          >EXIT</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CROWD SIDEBAR
   Right panel with spectator count + live emoji reactions.
   On mobile it becomes a bottom strip (controlled by CSS class).
───────────────────────────────────────────── */
function CrowdSidebar({ reactions, spectators, onSendReaction, gameColor, mobile = false }) {
  return (
    <div style={{
      width: mobile ? "100%" : 200,
      height: mobile ? 60 : "100%",
      background: "rgba(0,0,0,.35)", backdropFilter: "blur(12px)",
      border: `1px solid rgba(255,255,255,.06)`,
      borderRadius: mobile ? "0 0 14px 14px" : 14,
      display: "flex", flexDirection: mobile ? "row" : "column",
      alignItems: "center", padding: mobile ? "0 16px" : "16px 12px",
      gap: mobile ? 8 : 16, overflow: "hidden", position: "relative",
    }}>
      {/* spectator count */}
      <div style={{
        fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
        color: "rgba(240,238,234,.4)", letterSpacing: 1, whiteSpace: "nowrap",
      }}>
        👁 {spectators.toLocaleString()} watching
      </div>

      {/* divider */}
      {!mobile && <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,.05)" }} />}

      {/* recent reactions feed — scrollable on desktop */}
      {!mobile && (
        <div style={{
          flex: 1, width: "100%", overflowY: "auto",
          display: "flex", flexDirection: "column-reverse", gap: 6,
        }}>
          {reactions.slice(-20).reverse().map((r, i) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 6,
              animation: "fadeUp .3s ease",
              opacity: Math.max(0.2, 1 - i * 0.07),
            }}>
              <span style={{ fontSize: 18 }}>{r.emoji}</span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                color: "rgba(240,238,234,.35)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{r.user}</span>
            </div>
          ))}
        </div>
      )}

      {/* divider */}
      {!mobile && <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,.05)" }} />}

      {/* quick react buttons */}
      <div style={{
        display: "flex", flexWrap: mobile ? "nowrap" : "wrap",
        gap: mobile ? 4 : 6, justifyContent: "center",
      }}>
        {CROWD_EMOJIS.slice(0, mobile ? 6 : 10).map(e => (
          <button key={e} className="gs-crowd-emoji"
            onClick={() => onSendReaction(e)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 4,
              borderRadius: 6, transition: "background .15s",
            }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,.07)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "none"}
          >{e}</button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT — GameScreen
   Props:
     game       — one of the GAMES keys, e.g. "dont_laugh"
     onBack     — fn() called when user exits
     myName     — logged-in user's name
     myFlag     — emoji flag e.g. "🇳🇵"
     myPoints   — current point balance
     oppName    — matched stranger's username
     oppFlag    — their flag
     pointsWagered — how many pts were staked (from matchmaking)
───────────────────────────────────────────── */
export default function GameScreen({
  game: gameId = "dont_laugh",
  onBack,
  myName = "raj_np",
  myFlag = "🇳🇵",
  myPoints = 74,
  oppName = "stranger_7829",
  oppFlag = "🇧🇷",
  pointsWagered = 3,
}) {
  const game = GAMES[gameId] || GAMES.dont_laugh;

  // ── Phase state machine ────────────────────────────────────────────────────
  // "countdown" → "playing" → "round_result" → (loop) → "match_result"
  // This is the core concept of a state machine: the UI is determined entirely
  // by `phase`. You never manually show/hide things — you check the phase.
  const [phase,       setPhase]       = useState("countdown"); // countdown|playing|round_result|match_result
  const [cdNum,       setCdNum]       = useState(3);           // countdown number shown
  const [round,       setRound]       = useState(1);           // current round (1-indexed)
  const [timeLeft,    setTimeLeft]    = useState(game.roundDuration);
  const [myScore,     setMyScore]     = useState(0);           // rounds won by me
  const [oppScore,    setOppScore]    = useState(0);           // rounds won by opponent
  const [roundWinner, setRoundWinner] = useState(null);        // "me"|"them"|"draw"
  const [prompt,      setPrompt]      = useState("");          // current game prompt text
  const [reactions,   setReactions]   = useState([]);          // [{id, emoji, x, user}]
  const [floats,      setFloats]      = useState([]);          // emoji floaters on screen
  const [spectators,  setSpectators]  = useState(1247);        // fake crowd count for now
  const [speaking,    setSpeaking]    = useState("me");        // who is "active" (glowing border)
  const [myVotes,     setMyVotes]     = useState(0);           // crowd votes for me
  const [oppVotes,    setOppVotes]    = useState(0);           // crowd votes for opponent

  const myVideoRef  = useRef(null);
  const oppVideoRef = useRef(null);
  const timerRef    = useRef(null);  // holds setInterval id so we can clearInterval later
  const styleInjected = useRef(false);

  // ── Inject CSS once ───────────────────────────────────────────────────────
  // Same pattern used in every page of this project.
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const tag = document.createElement("style");
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }, []);

  // ── Pick a random prompt for this round ───────────────────────────────────
  // useCallback memoizes the function so it doesn't get recreated on every
  // render. Without this, any component that receives it as a prop would
  // also re-render every time — wasteful.
  const pickPrompt = useCallback(() => {
    const pool = game.prompts;
    setPrompt(pool[Math.floor(Math.random() * pool.length)]);
  }, [game]);

  // ── Camera setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
          myVideoRef.current.play().catch(() => {});
        }
      } catch {
        // camera denied — silently continue (game still works, no video for you)
      }
    })();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Socket: join room, listen for opponent video & reactions ─────────────
  // This is where socket.io wires in. The server manages which two players
  // are in a match room. We emit "join_game_room" so the server knows we're
  // here, then listen for events.
  useEffect(() => {
    socket.emit("join_game_room", { myName, oppName, game: gameId });

    // server broadcasts crowd reactions from other spectators
    socket.on("crowd_reaction", ({ emoji, user, x }) => {
      const id = Date.now() + Math.random();
      setReactions(r => [...r, { id, emoji, user, x: x ?? Math.random() * 80 + 5 }]);
      setFloats(f => [...f, { id, emoji, x: x ?? Math.random() * 80 + 5 }]);
      // auto-cleanup the floater after animation ends
      setTimeout(() => setFloats(f => f.filter(i => i.id !== id)), 2400);
    });

    // server tells us the opponent's round result
    socket.on("round_end", ({ winner }) => {
      endRound(winner === myName ? "me" : "them");
    });

    // server updates spectator count
    socket.on("spectator_count", ({ count }) => setSpectators(count));

    // server sends crowd vote split
    socket.on("crowd_votes", ({ forMe, forThem }) => {
      setMyVotes(forMe); setOppVotes(forThem);
    });

    return () => {
      socket.off("crowd_reaction");
      socket.off("round_end");
      socket.off("spectator_count");
      socket.off("crowd_votes");
      socket.emit("leave_game_room", { myName });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown phase ───────────────────────────────────────────────────────
  // Each time phase becomes "countdown", we tick 3→2→1→GO then start round.
  useEffect(() => {
    if (phase !== "countdown") return;
    pickPrompt();
    let n = 3; setCdNum(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) { setCdNum(n); }
      else {
        clearInterval(iv);
        setPhase("playing");
        setTimeLeft(game.roundDuration);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, pickPrompt, game.roundDuration]);

  // ── Round timer ───────────────────────────────────────────────────────────
  // setInterval fires every second. When it hits 0, the round ends.
  // We store the id in timerRef so the endRound function can cancel it
  // even from a socket event arriving early.
  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // time ran out — simulate result locally (server would normally decide)
          // In production: server emits "round_end" and we handle it via socket.
          endRound(Math.random() > .5 ? "me" : "them");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── End a round ───────────────────────────────────────────────────────────
  const endRound = useCallback((winner) => {
    clearInterval(timerRef.current);
    if (winner === "me")   setMyScore(s => s + 1);
    if (winner === "them") setOppScore(s => s + 1);
    setRoundWinner(winner);
    setPhase("round_result");

    // after 2s of showing result, either start next round or end match
    setTimeout(() => {
      setRound(r => {
        const nextRound = r + 1;
        if (nextRound > game.rounds) {
          setPhase("match_result");
        } else {
          setPhase("countdown");
        }
        return nextRound;
      });
    }, 2200);
  }, [game.rounds]);

  // ── Send a crowd reaction ─────────────────────────────────────────────────
  // When you click an emoji, we emit it to the server, which broadcasts
  // it to everyone watching. Locally we also fire the float immediately
  // so it feels instant (optimistic update).
  const sendReaction = useCallback((emoji) => {
    const x = Math.random() * 80 + 5;
    socket.emit("send_reaction", { emoji, user: myName, x });
    // optimistic: show it locally right away without waiting for server echo
    const id = Date.now() + Math.random();
    setFloats(f => [...f, { id, emoji, x }]);
    setTimeout(() => setFloats(f => f.filter(i => i.id !== id)), 2400);
  }, [myName]);

  // ── Vote for a player (crowd voting games) ────────────────────────────────
  const vote = useCallback((target) => {
    socket.emit("crowd_vote", { for: target, game: gameId });
  }, [gameId]);

  // ── Derived values ────────────────────────────────────────────────────────
  const danger   = timeLeft <= 5;                  // timer turns red last 5s
  const totalVotes = myVotes + oppVotes || 1;       // avoid divide-by-zero
  const myVotePct  = Math.round((myVotes / totalVotes) * 100);

  // ── Match result screen ───────────────────────────────────────────────────
  if (phase === "match_result") {
    const won    = myScore > oppScore;
    // calculateEntryFee logic mirrored from server.js
    // Under 100pts: flat 3pt. 100-1000: 3%. 1000-5000: 5%. 5000+: 10%
    const fee    = pointsWagered < 100 ? 3
                 : pointsWagered < 1000 ? Math.round(pointsWagered * .03)
                 : pointsWagered < 5000 ? Math.round(pointsWagered * .05)
                 : Math.round(pointsWagered * .10);
    const ptsWon = won ? pointsWagered - fee : 0;

    return (
      <MatchResult
        myScore={myScore} oppScore={oppScore}
        myName={myName} oppName={oppName}
        game={game}
        pointsWon={ptsWon} pointsWagered={pointsWagered}
        onBack={onBack}
        onRematch={() => {
          // reset all state for a fresh match
          setPhase("countdown"); setRound(1);
          setMyScore(0); setOppScore(0);
          setTimeLeft(game.roundDuration);
          setReactions([]); setFloats([]);
        }}
      />
    );
  }

  /* ─────────────────────────────────────────────
     MAIN GAME UI RENDER
  ───────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: BG,
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      <ParticleField />

      {/* floating emoji reactions that drift up */}
      <div style={{ position: "fixed", inset: 0, zIndex: 8, pointerEvents: "none" }}>
        {floats.map(f => <FloatEmoji key={f.id} {...f} />)}
      </div>

      {/* ── TOP BAR ── */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px",
        background: "rgba(0,0,0,.4)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}>
        {/* left: game title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{game.emoji}</span>
          <span style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: 22,
            color: game.color, letterSpacing: 2,
            textShadow: `0 0 20px ${game.color}66`,
          }}>{game.title}</span>
        </div>

        {/* center: round counter */}
        <div style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
          color: "rgba(240,238,234,.5)", letterSpacing: 2,
        }}>
          ROUND {Math.min(round, game.rounds)} / {game.rounds}
        </div>

        {/* right: exit button */}
        <button onClick={onBack} style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: 1,
          background: "rgba(255,77,109,.1)", border: "1px solid rgba(255,77,109,.3)",
          color: "#ff4d6d", borderRadius: 7, padding: "6px 14px", cursor: "pointer",
          transition: "background .2s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,77,109,.2)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,77,109,.1)"}
        >
          EXIT
        </button>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{
        flex: 1, display: "flex", gap: 12, padding: "12px 16px 12px",
        position: "relative", zIndex: 5, minHeight: 0,
      }}>

        {/* ── VIDEO SPLIT + CONTROLS ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>

          {/* score bar above videos */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(0,0,0,.3)", borderRadius: 10, padding: "8px 16px",
            border: "1px solid rgba(255,255,255,.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{myFlag}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#f0eeea" }}>{myName}</span>
              <span className="gs-score-badge" style={{ color: "#00f5a0" }}>{myScore}</span>
            </div>

            {/* timer in the center of score bar */}
            <TimerRing
              seconds={phase === "playing" ? timeLeft : game.roundDuration}
              total={game.roundDuration}
              color={game.color}
              size={64}
              danger={danger}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="gs-score-badge" style={{ color: "#ff4d6d" }}>{oppScore}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#f0eeea" }}>{oppName}</span>
              <span style={{ fontSize: 16 }}>{oppFlag}</span>
            </div>
          </div>

          {/* split video feeds */}
          <div className="gs-split" style={{
            display: "flex", gap: 10, flex: 1, minHeight: 0, position: "relative",
          }}>
            <VideoTile
              videoRef={myVideoRef} label={myName} flag={myFlag}
              score={myScore} color="#00f5a0" side="left" speaking={speaking === "me"}
            />
            <VideoTile
              videoRef={oppVideoRef} label={oppName} flag={oppFlag}
              score={oppScore} color="#ff4d6d" side="right" speaking={speaking === "them"}
            />

            {/* countdown overlay — only shown during countdown phase */}
            {phase === "countdown" && (
              <div className="gs-cd">
                <span className="gs-cd-num" key={cdNum}>{cdNum}</span>
              </div>
            )}

            {/* round result overlay — shown 2s between rounds */}
            {phase === "round_result" && roundWinner && (
              <RoundResult winner={roundWinner} myName={myName} oppName={oppName} game={game} />
            )}
          </div>

          {/* ── PROMPT BANNER ── */}
          <div style={{
            background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)",
            border: `1px solid ${game.color}22`, borderRadius: 10,
            padding: "12px 20px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{game.emoji}</span>
            <p className="gs-prompt">
              {prompt || game.desc}
            </p>
          </div>

          {/* ── CROWD VOTE BAR (vibe_check, hot_take, speed_roast) ── */}
          {["vibe_check","hot_take","speed_roast","mirror_me"].includes(gameId) && (
            <div style={{
              background: "rgba(0,0,0,.3)", borderRadius: 10, padding: "10px 16px",
              border: "1px solid rgba(255,255,255,.06)",
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                color: "rgba(240,238,234,.4)", letterSpacing: 2, marginBottom: 8,
              }}>CROWD VOTE</div>

              {/* vote bar */}
              <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${myVotePct}%`,
                  background: `linear-gradient(to right, #00f5a0, #00d4ff)`,
                  borderRadius: 3, transition: "width .6s ease",
                }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#00f5a0" }}>{myName} {myVotePct}%</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#ff4d6d" }}>{100 - myVotePct}% {oppName}</span>
              </div>

              {/* vote buttons (for spectators watching this screen — or for testing) */}
              <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
                <button onClick={() => vote(myName)} style={{
                  flex: 1, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: 1,
                  padding: "7px 0", borderRadius: 7, cursor: "pointer",
                  background: "rgba(0,245,160,.08)", border: "1px solid rgba(0,245,160,.25)",
                  color: "#00f5a0", transition: "background .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(0,245,160,.18)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(0,245,160,.08)"}
                >VOTE {myFlag}</button>
                <button onClick={() => vote(oppName)} style={{
                  flex: 1, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: 1,
                  padding: "7px 0", borderRadius: 7, cursor: "pointer",
                  background: "rgba(255,77,109,.08)", border: "1px solid rgba(255,77,109,.25)",
                  color: "#ff4d6d", transition: "background .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,77,109,.18)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,77,109,.08)"}
                >VOTE {oppFlag}</button>
              </div>
            </div>
          )}

          {/* ── MOBILE CROWD STRIP ── */}
          <div className="gs-bottom-crowd" style={{ display: "none" }}>
            <CrowdSidebar
              reactions={reactions} spectators={spectators}
              onSendReaction={sendReaction} gameColor={game.color}
              mobile={true}
            />
          </div>
        </div>

        {/* ── CROWD SIDEBAR (desktop only) ── */}
        <div className="gs-sidebar">
          <CrowdSidebar
            reactions={reactions} spectators={spectators}
            onSendReaction={sendReaction} gameColor={game.color}
          />
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ── */}
      <div style={{
        position: "relative", zIndex: 10,
        background: "rgba(0,0,0,.5)", backdropFilter: "blur(14px)",
        borderTop: "1px solid rgba(255,255,255,.06)",
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        flexWrap: "wrap",
      }}>
        {/* wager display */}
        <div style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
          color: "rgba(240,238,234,.4)", letterSpacing: 1, marginRight: 8,
        }}>
          // wager: <span style={{ color: "#ffd60a" }}>{pointsWagered}pts</span>
        </div>

        {/* quick react strip */}
        {["😂","🔥","💀","😭","👑"].map(e => (
          <button key={e} onClick={() => sendReaction(e)} style={{
            fontSize: 22, background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.08)", borderRadius: 8,
            padding: "7px 10px", cursor: "pointer",
            transition: "transform .12s, background .15s",
          }}
            onMouseEnter={ev => { ev.currentTarget.style.transform = "scale(1.2)"; ev.currentTarget.style.background = "rgba(255,255,255,.12)"; }}
            onMouseLeave={ev => { ev.currentTarget.style.transform = "scale(1)"; ev.currentTarget.style.background = "rgba(255,255,255,.05)"; }}
          >{e}</button>
        ))}

        {/* my points balance */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(240,238,234,.35)" }}>YOUR BAL</span>
          <span style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: 18,
            color: "#ffd60a", letterSpacing: 1,
          }}>{myPoints}pts</span>
        </div>
      </div>
    </div>
  );
}
