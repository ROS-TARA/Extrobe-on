import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────
   REWARDS PAGE
   // what you get for not being bad at this
   
   TEACH: This page shows the 100-point reward system.
   Key concepts used here:
   - useState for tab/hover state
   - Array.map() for rendering reward cards
   - CSS animations via inline keyframe injection
   - Conditional rendering with ternary operators
   - Progress bar math: (points / threshold) * 100
───────────────────────────────────────────── */

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
    to { background-position: -200% center; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes orbFloat {
    0%,100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(-28px) scale(1.04); }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 20px rgba(0,245,160,0.25); }
    50%      { box-shadow: 0 0 50px rgba(0,245,160,0.55); }
  }
  @keyframes lockPop {
    0%   { transform: scale(0.6) rotate(-8deg); opacity: 0; }
    70%  { transform: scale(1.1) rotate(2deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes scanline {
    0%   { top: -4px; }
    100% { top: 100%; }
  }
  @keyframes barGrow {
    from { width: 0; }
  }
  @keyframes tickerMove {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0); }
    50%       { opacity: 1; transform: scale(1); }
  }
  @keyframes rewardReveal {
    from { opacity: 0; transform: translateY(30px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes goldShimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes borderGlow {
    0%,100% { border-color: rgba(255,214,10,0.2); }
    50%      { border-color: rgba(255,214,10,0.6); }
  }

  .fade-up { animation: fadeUp 0.5s both; }

  .reward-card {
    transition: transform 0.25s, box-shadow 0.25s;
    cursor: pointer;
  }
  .reward-card:hover {
    transform: translateY(-4px);
  }
  .reward-card.locked:hover {
    transform: translateY(-2px);
  }

  .tier-btn {
    cursor: pointer;
    border: none;
    background: none;
    transition: all 0.2s;
  }
  .tier-btn:hover { opacity: 0.9; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  @media (max-width: 768px) {
    .rewards-grid { grid-template-columns: 1fr !important; }
    .milestone-track { flex-direction: column !important; }
    .milestone-line { width: 2px !important; height: 40px !important; }
  }
  @media (min-width: 769px) and (max-width: 1100px) {
    .rewards-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
`;

const BG = `linear-gradient(to right,
  #141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,
  #1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,
  #262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,
  #303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

/* ── User State (replace with real auth context later) ── */
const USER = { name: "raj_np", flag: "🇳🇵", points: 74, rank: "Bronze III", rankNext: "Silver I" };

/* ── Reward tiers ── */
/*
  TEACH: Each object in this array is one reward card.
  'threshold' = points needed to unlock it.
  'tier' = visual color tier (bronze/silver/gold/diamond)
  'perks' = array of strings shown inside the card.
  This is a pure data structure — the JSX just loops over it.
*/
const REWARD_TIERS = [
  {
    id: "bronze",
    threshold: 100,
    tier: "bronze",
    label: "Bronze Cache",
    emoji: "🪙",
    tagline: "// your first win, officially",
    color: "#cd7f32",
    glow: "rgba(205,127,50,0.35)",
    border: "rgba(205,127,50,0.3)",
    perks: [
      { icon: "🎨", text: "Animated bronze avatar ring" },
      { icon: "🔈", text: "3 custom sound effects in-call" },
      { icon: "🃏", text: "5 reaction emotes unlocked" },
      { icon: "🏷️", text: "Bronze rank badge on profile" },
    ],
  },
  {
    id: "silver",
    threshold: 500,
    tier: "silver",
    label: "Silver Drop",
    emoji: "🥈",
    tagline: "// people are starting to notice",
    color: "#b0bec5",
    glow: "rgba(176,190,197,0.3)",
    border: "rgba(176,190,197,0.25)",
    perks: [
      { icon: "🌀", text: "Animated silver ring + glow trail" },
      { icon: "🎙️", text: "Voice changer toggle in-call (3 modes)" },
      { icon: "🃏", text: "12 reaction emotes unlocked" },
      { icon: "📎", text: "Clip & share button (30-sec auto-clip)" },
      { icon: "🕶️", text: "Username color: silver chrome" },
    ],
  },
  {
    id: "gold",
    threshold: 1000,
    tier: "gold",
    label: "Gold Vault",
    emoji: "🏆",
    tagline: "// this is where it gets real",
    color: "#ffd60a",
    glow: "rgba(255,214,10,0.4)",
    border: "rgba(255,214,10,0.35)",
    perks: [
      { icon: "✨", text: "Animated gold ring + particle burst on win" },
      { icon: "🎬", text: "Crowd can clip & share your moments" },
      { icon: "🏆", text: "Leaderboard gold crown icon" },
      { icon: "🃏", text: "All 28 reaction emotes + custom one" },
      { icon: "🚀", text: "Priority matchmaking queue" },
      { icon: "🎮", text: "Early access to new game modes" },
    ],
  },
  {
    id: "diamond",
    threshold: 5000,
    tier: "diamond",
    label: "Diamond Protocol",
    emoji: "💎",
    tagline: "// top 1%. no explanation needed.",
    color: "#00d4ff",
    glow: "rgba(0,212,255,0.4)",
    border: "rgba(0,212,255,0.3)",
    perks: [
      { icon: "💎", text: "Diamond animated ring + screen aura" },
      { icon: "🌍", text: "Featured on global homepage for 24h" },
      { icon: "🎙️", text: "Host your own crowd rooms (up to 500)" },
      { icon: "🏷️", text: "Custom username tag & profile banner" },
      { icon: "💬", text: "Your highlights in StrangerPlay's socials" },
      { icon: "🛡️", text: "Verified creator badge" },
      { icon: "📊", text: "Full match analytics dashboard" },
    ],
  },
];

/* ── Milestone track ── */
const MILESTONES = [
  { pts: 0,    label: "Start",      color: "#444" },
  { pts: 100,  label: "🪙 Bronze",  color: "#cd7f32" },
  { pts: 500,  label: "🥈 Silver",  color: "#b0bec5" },
  { pts: 1000, label: "🏆 Gold",    color: "#ffd60a" },
  { pts: 5000, label: "💎 Diamond", color: "#00d4ff" },
];

/* ── Shimmer text ── */
function ShimmerText({ children, color1 = "#00f5a0", color2 = "#00d4ff" }) {
  return (
    <span style={{
      background: `linear-gradient(90deg, ${color1}, ${color2}, ${color1})`,
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      animation: "shimmer 3s linear infinite",
      display: "inline-block",
    }}>{children}</span>
  );
}

/* ── Gold shimmer for gold tier ── */
function GoldText({ children }) {
  return (
    <span style={{
      background: "linear-gradient(90deg, #ffd60a, #ffaa00, #ffd60a)",
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      animation: "goldShimmer 2.5s linear infinite",
      display: "inline-block",
    }}>{children}</span>
  );
}

/* ── Floating orb ── */
function Orb({ x, y, size, color, delay = 0, dur = 7 }) {
  return (
    <div style={{
      position: "fixed", left: `${x}%`, top: `${y}%`,
      width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${color}33, transparent 70%)`,
      filter: "blur(60px)",
      animation: `orbFloat ${dur}s ease-in-out ${delay}s infinite`,
      pointerEvents: "none", zIndex: 0,
    }} />
  );
}

/* ── Progress bar ── */
function ProgressBar({ value, max, color, delay = 0 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 99,
        width: `${pct}%`,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 10px ${color}55`,
        animation: `barGrow 1.2s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
      }} />
    </div>
  );
}

/* ── Single reward card ── */
function RewardCard({ tier, userPoints, delay = 0, onSelect }) {
  const unlocked = userPoints >= tier.threshold;
  const current = userPoints < tier.threshold &&
    (REWARD_TIERS.findIndex(t => t.id === tier.id) === 0 ||
      userPoints >= REWARD_TIERS[REWARD_TIERS.findIndex(t => t.id === tier.id) - 1].threshold);

  /*
    TEACH: "unlocked" and "current" are derived booleans.
    Derived = calculated from existing state, not stored separately.
    Rule: never store what you can calculate.
  */

  return (
    <div
      className={`reward-card${unlocked ? "" : " locked"}`}
      onClick={() => onSelect(tier)}
      style={{
        background: unlocked
          ? `linear-gradient(135deg, ${tier.color}0a, rgba(255,255,255,0.025))`
          : "rgba(255,255,255,0.018)",
        border: `1px solid ${unlocked ? tier.border : "rgba(255,255,255,0.06)"}`,
        borderRadius: 18,
        padding: "28px 24px",
        position: "relative",
        overflow: "hidden",
        animation: `rewardReveal 0.55s ${delay}s both`,
        ...(current ? { animation: `rewardReveal 0.55s ${delay}s both, borderGlow 2.5s 0.55s infinite` } : {}),
      }}
    >
      {/* Scanline effect on unlocked cards */}
      {unlocked && (
        <div style={{
          position: "absolute", left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${tier.color}40, transparent)`,
          animation: "scanline 4s linear infinite",
          pointerEvents: "none",
        }} />
      )}

      {/* Lock overlay on locked cards */}
      {!unlocked && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 17,
          background: "rgba(10,10,12,0.45)",
          display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
          padding: 14, pointerEvents: "none", zIndex: 2,
        }}>
          <span style={{ fontSize: 18, opacity: 0.3 }}>🔒</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 32, marginBottom: 6, filter: unlocked ? "none" : "grayscale(0.7) opacity(0.5)", animation: unlocked ? `lockPop 0.5s ${delay + 0.1}s both` : "none" }}>
            {tier.emoji}
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22, letterSpacing: 1.5,
            color: unlocked ? tier.color : "#444",
          }}>
            {tier.id === "gold" && unlocked ? <GoldText>{tier.label}</GoldText> : tier.label}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#444", marginTop: 4 }}>
            {tier.tagline}
          </div>
        </div>

        <div style={{
          background: unlocked ? `${tier.color}15` : "rgba(255,255,255,0.04)",
          border: `1px solid ${unlocked ? tier.border : "rgba(255,255,255,0.07)"}`,
          borderRadius: 10, padding: "6px 12px", textAlign: "right",
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: unlocked ? tier.color : "#333", letterSpacing: 1 }}>
            {tier.threshold.toLocaleString()}
          </div>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 1.5, textTransform: "uppercase" }}>pts</div>
        </div>
      </div>

      {/* Progress (only on current / next tier) */}
      {!unlocked && current && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>your progress</span>
            <span style={{ color: tier.color }}>{userPoints} / {tier.threshold}</span>
          </div>
          <ProgressBar value={userPoints} max={tier.threshold} color={tier.color} delay={delay + 0.3} />
          <div style={{ fontSize: 10, color: "#444", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            {tier.threshold - userPoints} pts to unlock
          </div>
        </div>
      )}

      {/* Perks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tier.perks.map((perk, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            opacity: unlocked ? 1 : 0.35,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{perk.icon}</span>
            <span style={{ fontSize: 12.5, color: unlocked ? "#c8c5bf" : "#555", lineHeight: 1.4 }}>{perk.text}</span>
            {unlocked && <span style={{ marginLeft: "auto", fontSize: 11, color: tier.color, flexShrink: 0 }}>✓</span>}
          </div>
        ))}
      </div>

      {/* Unlocked badge */}
      {unlocked && (
        <div style={{
          marginTop: 20,
          background: `${tier.color}15`,
          border: `1px solid ${tier.border}`,
          borderRadius: 8, padding: "8px 14px",
          display: "flex", alignItems: "center", gap: 8,
          animation: `lockPop 0.5s ${delay + 0.25}s both`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: tier.color, boxShadow: `0 0 8px ${tier.color}` }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: tier.color }}>UNLOCKED — active on your profile</span>
        </div>
      )}
    </div>
  );
}

/* ── Milestone track ── */
/*
  TEACH: This component maps over the MILESTONES array to draw a visual
  progress timeline. It uses index to determine if each milestone is
  "past", "current", or "future" relative to the user's points.
*/
function MilestoneTrack({ userPoints }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: "24px 28px",
      marginBottom: 48,
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#444", letterSpacing: 3, marginBottom: 24, textTransform: "uppercase" }}>
        // your journey
      </div>

      {/* Desktop: horizontal track */}
      <div className="milestone-track" style={{ display: "flex", alignItems: "center" }}>
        {MILESTONES.map((m, i) => {
          const reached = userPoints >= m.pts;
          const isCurrent = i < MILESTONES.length - 1 &&
            userPoints >= m.pts && userPoints < MILESTONES[i + 1].pts;

          return (
            <div key={m.pts} style={{ display: "flex", alignItems: "center", flex: i < MILESTONES.length - 1 ? 1 : 0 }}>
              {/* Node */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: reached ? `${m.color}20` : "rgba(255,255,255,0.04)",
                  border: `2px solid ${reached ? m.color : "rgba(255,255,255,0.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, boxShadow: reached ? `0 0 16px ${m.color}44` : "none",
                  animation: isCurrent ? "glowPulse 2s infinite" : "none",
                  transition: "all 0.3s",
                }}>
                  {reached ? "✓" : i === 0 ? "●" : "○"}
                </div>
                <div style={{ fontSize: 11, color: reached ? m.color : "#444", whiteSpace: "nowrap", textAlign: "center" }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#333" }}>
                  {m.pts === 0 ? "—" : m.pts.toLocaleString()}
                </div>
              </div>

              {/* Line between nodes */}
              {i < MILESTONES.length - 1 && (
                <div className="milestone-line" style={{
                  flex: 1, height: 2, margin: "0 8px", marginBottom: 28,
                  background: `linear-gradient(90deg, ${reached ? m.color : "rgba(255,255,255,0.06)"}, ${userPoints >= MILESTONES[i + 1].pts ? MILESTONES[i + 1].color : "rgba(255,255,255,0.06)"})`,
                  borderRadius: 1,
                  transition: "background 0.4s",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current position label */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00f5a0", boxShadow: "0 0 10px #00f5a0", animation: "glowPulse 1.5s infinite" }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#666" }}>
          you are here → <span style={{ color: "#00f5a0" }}>{userPoints} pts</span> · {USER.rank} · next tier at <span style={{ color: "#00d4ff" }}>100 pts</span>
        </span>
      </div>
    </div>
  );
}

/* ── Detail Modal ── */
function RewardModal({ tier, userPoints, onClose }) {
  const unlocked = userPoints >= tier.threshold;

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        background: "#141415",
        border: `1px solid ${tier.border}`,
        borderRadius: 20, padding: "36px 32px",
        maxWidth: 480, width: "100%",
        position: "relative",
        boxShadow: `0 0 60px ${tier.glow}`,
        animation: "rewardReveal 0.35s both",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        {/* Scanline */}
        <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${tier.color}50, transparent)`, animation: "scanline 3s linear infinite", pointerEvents: "none" }} />

        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#777", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

        <div style={{ fontSize: 48, marginBottom: 12 }}>{tier.emoji}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: tier.color, marginBottom: 4 }}>
          {tier.label}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#555", marginBottom: 28 }}>
          {tier.tagline}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tier.perks.map((perk, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "12px 16px",
              opacity: unlocked ? 1 : 0.4,
              animation: `fadeUp 0.4s ${i * 0.06}s both`,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{perk.icon}</span>
              <span style={{ fontSize: 13, color: "#c8c5bf", lineHeight: 1.5 }}>{perk.text}</span>
              {unlocked && <span style={{ marginLeft: "auto", color: tier.color, fontSize: 14, flexShrink: 0 }}>✓</span>}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: "16px 20px", background: unlocked ? `${tier.color}10` : "rgba(255,255,255,0.04)", border: `1px solid ${unlocked ? tier.border : "rgba(255,255,255,0.06)"}`, borderRadius: 12 }}>
          {unlocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tier.color, boxShadow: `0 0 10px ${tier.color}` }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: tier.color }}>All perks active on your profile</span>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>progress to unlock</span>
                <span style={{ color: tier.color }}>{userPoints} / {tier.threshold} pts</span>
              </div>
              <ProgressBar value={userPoints} max={tier.threshold} color={tier.color} />
              <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>
                {tier.threshold - userPoints} more points needed — keep playing
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ticker ── */
/*
  TEACH: The ticker creates a scrolling news-feed style strip.
  It uses CSS animation (tickerMove) to slide content left infinitely.
  The trick: duplicate the content so it loops seamlessly.
*/
function Ticker() {
  const items = ["shadow_x just hit Diamond 💎", "foxgirl99 unlocked Gold perks 🏆", "marco_r is at 98 pts — almost there 🔥", "priya_s earned 12 pts in Floppy Race 🎮", "3,841 active players rn 👀", "dragonz climbed to rank #4 🚀", "You're 26 pts from Bronze 🪙"];
  const text = items.join("   ·   ");

  return (
    <div style={{ overflow: "hidden", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "10px 0", marginBottom: 48, position: "relative" }}>
      <div style={{ display: "flex", width: "max-content", animation: "tickerMove 30s linear infinite" }}>
        {[text, text].map((t, i) => (
          <span key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#444", whiteSpace: "nowrap", paddingRight: 60 }}>
            {t.split("·").map((item, j) => (
              <span key={j}>
                <span style={{ color: "#555" }}>{item}</span>
                {j < items.length - 1 && <span style={{ color: "#333", margin: "0 16px" }}>·</span>}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════ */
export default function Rewards({ onNavigate }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const [filterUnlocked, setFilterUnlocked] = useState("all"); // "all" | "unlocked" | "locked"

  /*
    TEACH: onNavigate is a prop passed from the parent (StrangerPlay_Main).
    Props flow DOWN from parent to child. This lets child components
    trigger page navigation without owning the state themselves.
    If this page is viewed standalone (no parent), onNavigate is undefined — 
    the buttons just don't do anything harmful.
  */

  const userPoints = USER.points;

  const filtered = REWARD_TIERS.filter(t => {
    if (filterUnlocked === "unlocked") return userPoints >= t.threshold;
    if (filterUnlocked === "locked") return userPoints < t.threshold;
    return true;
  });

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: BG }}>
      <style>{css}</style>

      {/* Background orbs */}
      <Orb x={-5} y={10}  size={500} color="#00f5a0" delay={0} dur={9} />
      <Orb x={80} y={60}  size={400} color="#00d4ff" delay={2} dur={11} />
      <Orb x={50} y={-10} size={350} color="#ffd60a" delay={4} dur={8} />

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "clamp(80px,12vw,120px) clamp(16px,5vw,60px) 120px" }}>

        {/* Header */}
        <div style={{ marginBottom: 48, animation: "fadeUp 0.5s both" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#444", letterSpacing: 4, textTransform: "uppercase", marginBottom: 10 }}>
            // what you unlock for not being bad at this
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(48px,10vw,88px)", letterSpacing: 2, lineHeight: 0.95, marginBottom: 16 }}>
            <ShimmerText>REWARDS</ShimmerText>
          </h1>
          <p style={{ fontSize: "clamp(13px,2vw,15px)", color: "#555", maxWidth: 480, lineHeight: 1.6 }}>
            Play games. Win points. Hit thresholds. Unlock perks that actually matter — not fake digital stickers.
          </p>
        </div>

        {/* User progress snapshot */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: "20px 24px",
          marginBottom: 36,
          display: "flex", alignItems: "center", gap: 20,
          flexWrap: "wrap",
          animation: "fadeUp 0.5s 0.1s both",
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#ffd60a", lineHeight: 1, textShadow: "0 0 24px rgba(255,214,10,0.4)" }}>
            {userPoints}
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>your points · {USER.rank}</div>
            <div style={{ width: 220 }}>
              <ProgressBar value={userPoints} max={100} color="#ffd60a" delay={0.3} />
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#444", marginTop: 6 }}>
              {100 - userPoints} pts to first reward (Bronze Cache)
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onNavigate && (
              <button
                onClick={() => onNavigate("play")}
                style={{
                  background: "linear-gradient(135deg,#00f5a0,#00d4ff)",
                  border: "none", borderRadius: 10,
                  color: "#0a0a0a", fontFamily: "'Bebas Neue',sans-serif",
                  fontSize: 15, letterSpacing: 1.5,
                  padding: "10px 22px", cursor: "pointer",
                  boxShadow: "0 0 16px rgba(0,245,160,0.3)",
                  animation: "glowPulse 3s infinite",
                }}
              >PLAY NOW →</button>
            )}
          </div>
        </div>

        {/* Ticker */}
        <Ticker />

        {/* Milestone track */}
        <MilestoneTrack userPoints={userPoints} />

        {/* Filter buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32, flexWrap: "wrap", animation: "fadeUp 0.5s 0.2s both" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#444", marginRight: 4 }}>show:</span>
          {[["all", "All tiers"], ["unlocked", "Unlocked"], ["locked", "Locked"]].map(([val, label]) => (
            <button
              key={val}
              className="tier-btn"
              onClick={() => setFilterUnlocked(val)}
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12,
                color: filterUnlocked === val ? "#0a0a0a" : "#555",
                background: filterUnlocked === val ? "#00f5a0" : "rgba(255,255,255,0.04)",
                border: `1px solid ${filterUnlocked === val ? "#00f5a0" : "rgba(255,255,255,0.07)"}`,
                fontFamily: "'Syne', sans-serif", fontWeight: 600,
              }}
            >{label}</button>
          ))}
        </div>

        {/* Reward cards grid */}
        <div
          className="rewards-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, animation: "fadeUp 0.5s 0.25s both" }}
        >
          {filtered.map((tier, i) => (
            <RewardCard
              key={tier.id}
              tier={tier}
              userPoints={userPoints}
              delay={i * 0.08}
              onSelect={setSelectedTier}
            />
          ))}
        </div>

        {/* Bottom note */}
        <div style={{ marginTop: 56, textAlign: "center", animation: "fadeUp 0.5s 0.4s both" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#333", marginBottom: 10 }}>
            // points earned by winning wagers in live games. no purchases. no shortcuts.
          </div>
          <div style={{ fontSize: 12, color: "#3a3a3a" }}>
            Rewards are automatically applied to your account when you cross each threshold.
          </div>
        </div>

      </div>

      {/* Modal */}
      {selectedTier && (
        <RewardModal tier={selectedTier} userPoints={userPoints} onClose={() => setSelectedTier(null)} />
      )}
    </div>
  );
}
