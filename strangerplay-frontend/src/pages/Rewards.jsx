import { useState, useEffect, useRef } from "react";
import { tint } from "./theme";

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
    background: var(--sp-void);
    color: var(--sp-plat);
    font-family: 'Inter', sans-serif;
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
    0%,100% { border-color: color-mix(in srgb, var(--sp-gold) 20%, transparent); }
    50%      { border-color: color-mix(in srgb, var(--sp-gold) 60%, transparent); }
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
  ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--sp-plat) 10%, transparent); border-radius: 2px; }

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
  var(--sp-void) 0%,var(--sp-void) 12.5%,var(--sp-surface) 12.5%,var(--sp-surface) 25%,
  var(--sp-surface2) 25%,var(--sp-surface2) 37.5%,var(--sp-surface) 37.5%,var(--sp-surface) 50%,
  var(--sp-surface) 50%,var(--sp-surface) 62.5%,var(--sp-surface2) 62.5%,var(--sp-surface2) 75%,
  var(--sp-surface2) 75%,var(--sp-surface2) 87.5%,var(--sp-surface2) 87.5%,var(--sp-surface2) 100%)`;

/* ── User State (replace with real auth context later) ── */

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
    color: "var(--sp-gold)",
    glow: "color-mix(in srgb, var(--sp-gold) 40%, transparent)",
    border: "color-mix(in srgb, var(--sp-gold) 35%, transparent)",
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
    color: "color-mix(in srgb, var(--sp-signal) 55%, #6fd8ff)",
    glow: "rgba(0,212,255,0.4)",
    border: "rgba(0,212,255,0.3)",
    perks: [
      { icon: "💎", text: "Diamond animated ring + screen aura" },
      { icon: "🌍", text: "Featured on global homepage for 24h" },
      { icon: "🎙️", text: "Host your own crowd rooms (up to 500)" },
      { icon: "🏷️", text: "Custom username tag & profile banner" },
      { icon: "💬", text: "Your highlights in Tranzle's socials" },
      { icon: "🛡️", text: "Verified creator badge" },
      { icon: "📊", text: "Full match analytics dashboard" },
    ],
  },
];

/* ── Milestone track ── */
const MILESTONES = [
  { pts: 0,    label: "Start",      color: "var(--sp-ghost)" },
  { pts: 100,  label: "🪙 Bronze",  color: "#cd7f32" },
  { pts: 500,  label: "🥈 Silver",  color: "#b0bec5" },
  { pts: 1000, label: "🏆 Gold",    color: "var(--sp-gold)" },
  { pts: 5000, label: "💎 Diamond", color: "color-mix(in srgb, var(--sp-signal) 55%, #6fd8ff)" },
];

/* ── Shimmer text ── */
function ShimmerText({ children, color1 = "var(--sp-signal)", color2 = "color-mix(in srgb, var(--sp-signal) 55%, #6fd8ff)" }) {
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
      background: "linear-gradient(90deg, var(--sp-gold), #ffaa00, var(--sp-gold))",
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
      background: `radial-gradient(circle at 35% 35%, ${tint(color,"33")}, transparent 70%)`,
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
    <div style={{ height: 6, borderRadius: 99, background: "color-mix(in srgb, var(--sp-plat) 7%, transparent)", overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 99,
        width: `${pct}%`,
        background: `linear-gradient(90deg, ${tint(color,"88")}, ${color})`,
        boxShadow: `0 0 10px ${tint(color,"55")}`,
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
          ? `linear-gradient(135deg, ${tint(tier.color,"0a")}, color-mix(in srgb, var(--sp-plat) 2.5%, transparent))`
          : "color-mix(in srgb, var(--sp-plat) 1.8%, transparent)",
        border: `1px solid ${unlocked ? tier.border : "color-mix(in srgb, var(--sp-plat) 6%, transparent)"}`,
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
          background: `linear-gradient(90deg, transparent, ${tint(tier.color,"40")}, transparent)`,
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
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 22, letterSpacing: 1.5,
            color: unlocked ? tier.color : "var(--sp-ghost)",
          }}>
            {tier.id === "gold" && unlocked ? <GoldText>{tier.label}</GoldText> : tier.label}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--sp-ghost)", marginTop: 4 }}>
            {tier.tagline}
          </div>
        </div>

        <div style={{
          background: unlocked ? `${tint(tier.color,"15")}` : "color-mix(in srgb, var(--sp-plat) 4%, transparent)",
          border: `1px solid ${unlocked ? tier.border : "color-mix(in srgb, var(--sp-plat) 7%, transparent)"}`,
          borderRadius: 10, padding: "6px 12px", textAlign: "right",
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, color: unlocked ? tier.color : "var(--sp-rim)", letterSpacing: 1 }}>
            {tier.threshold.toLocaleString()}
          </div>
          <div style={{ fontSize: 9, color: "var(--sp-ghost)", letterSpacing: 1.5, textTransform: "uppercase" }}>pts</div>
        </div>
      </div>

      {/* Progress (only on current / next tier) */}
      {!unlocked && current && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--sp-ghost)", marginBottom: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>your progress</span>
            <span style={{ color: tier.color }}>{userPoints} / {tier.threshold}</span>
          </div>
          <ProgressBar value={userPoints} max={tier.threshold} color={tier.color} delay={delay + 0.3} />
          <div style={{ fontSize: 10, color: "var(--sp-ghost)", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            {Math.max(0, tier.threshold - userPoints)} pts to unlock
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
            <span style={{ fontSize: 12.5, color: unlocked ? "var(--sp-ash)" : "var(--sp-ghost)", lineHeight: 1.4 }}>{perk.text}</span>
            {unlocked && <span style={{ marginLeft: "auto", fontSize: 11, color: tier.color, flexShrink: 0 }}>✓</span>}
          </div>
        ))}
      </div>

      {/* Unlocked badge */}
      {unlocked && (
        <div style={{
          marginTop: 20,
          background: `${tint(tier.color,"15")}`,
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
function MilestoneTrack({ userPoints, rank }) {
  return (
    <div style={{
      background: "color-mix(in srgb, var(--sp-plat) 2%, transparent)",
      border: "1px solid color-mix(in srgb, var(--sp-plat) 6%, transparent)",
      borderRadius: 16, padding: "24px 28px",
      marginBottom: 48,
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--sp-ghost)", letterSpacing: 3, marginBottom: 24, textTransform: "uppercase" }}>
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
                  background: reached ? `${tint(m.color,"20")}` : "color-mix(in srgb, var(--sp-plat) 4%, transparent)",
                  border: `2px solid ${reached ? m.color : "color-mix(in srgb, var(--sp-plat) 8%, transparent)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, boxShadow: reached ? `0 0 16px ${tint(m.color,"44")}` : "none",
                  animation: isCurrent ? "glowPulse 2s infinite" : "none",
                  transition: "all 0.3s",
                }}>
                  {reached ? "✓" : i === 0 ? "●" : "○"}
                </div>
                <div style={{ fontSize: 11, color: reached ? m.color : "var(--sp-ghost)", whiteSpace: "nowrap", textAlign: "center" }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--sp-rim)" }}>
                  {m.pts === 0 ? "—" : m.pts.toLocaleString()}
                </div>
              </div>

              {/* Line between nodes */}
              {i < MILESTONES.length - 1 && (
                <div className="milestone-line" style={{
                  flex: 1, height: 2, margin: "0 8px", marginBottom: 28,
                  background: `linear-gradient(90deg, ${reached ? m.color : "color-mix(in srgb, var(--sp-plat) 6%, transparent)"}, ${userPoints >= MILESTONES[i + 1].pts ? MILESTONES[i + 1].color : "color-mix(in srgb, var(--sp-plat) 6%, transparent)"})`,
                  borderRadius: 1,
                  transition: "background 0.4s",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current position label */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid color-mix(in srgb, var(--sp-plat) 5%, transparent)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sp-signal)", boxShadow: "0 0 10px var(--sp-signal)", animation: "glowPulse 1.5s infinite" }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--sp-ghost)" }}>
          you are here → <span style={{ color: "var(--sp-signal)" }}>{userPoints} pts</span> · {rank} · next tier at <span style={{ color: "color-mix(in srgb, var(--sp-signal) 55%, #6fd8ff)" }}>100 pts</span>
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
        background: "var(--sp-void)",
        border: `1px solid ${tier.border}`,
        borderRadius: 20, padding: "36px 32px",
        maxWidth: 480, width: "100%",
        position: "relative",
        boxShadow: `0 0 60px ${tier.glow}`,
        animation: "rewardReveal 0.35s both",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        {/* Scanline */}
        <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${tint(tier.color,"50")}, transparent)`, animation: "scanline 3s linear infinite", pointerEvents: "none" }} />

        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "color-mix(in srgb, var(--sp-plat) 6%, transparent)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "var(--sp-ghost)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

        <div style={{ fontSize: 48, marginBottom: 12 }}>{tier.emoji}</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, letterSpacing: 2, color: tier.color, marginBottom: 4 }}>
          {tier.label}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--sp-ghost)", marginBottom: 28 }}>
          {tier.tagline}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tier.perks.map((perk, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              background: "color-mix(in srgb, var(--sp-plat) 3%, transparent)",
              border: "1px solid color-mix(in srgb, var(--sp-plat) 6%, transparent)",
              borderRadius: 10, padding: "12px 16px",
              opacity: unlocked ? 1 : 0.4,
              animation: `fadeUp 0.4s ${i * 0.06}s both`,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{perk.icon}</span>
              <span style={{ fontSize: 13, color: "var(--sp-ash)", lineHeight: 1.5 }}>{perk.text}</span>
              {unlocked && <span style={{ marginLeft: "auto", color: tier.color, fontSize: 14, flexShrink: 0 }}>✓</span>}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: "16px 20px", background: unlocked ? `${tint(tier.color,"10")}` : "color-mix(in srgb, var(--sp-plat) 4%, transparent)", border: `1px solid ${unlocked ? tier.border : "color-mix(in srgb, var(--sp-plat) 6%, transparent)"}`, borderRadius: 12 }}>
          {unlocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tier.color, boxShadow: `0 0 10px ${tier.color}` }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: tier.color }}>All perks active on your profile</span>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--sp-ghost)", marginBottom: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>progress to unlock</span>
                <span style={{ color: tier.color }}>{userPoints} / {tier.threshold} pts</span>
              </div>
              <ProgressBar value={userPoints} max={tier.threshold} color={tier.color} />
              <div style={{ fontSize: 11, color: "var(--sp-ghost)", marginTop: 8 }}>
                {Math.max(0, tier.threshold - userPoints)} more points needed — keep playing
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

/* ═══════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════ */
export default function Rewards({ onNavigate, user, points }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const [filterUnlocked, setFilterUnlocked] = useState("all"); // "all" | "unlocked" | "locked"

  /*
    TEACH: onNavigate is a prop passed from the parent (Tranzle_Main).
    Props flow DOWN from parent to child. This lets child components
    trigger page navigation without owning the state themselves.
    If this page is viewed standalone (no parent), onNavigate is undefined — 
    the buttons just don't do anything harmful.
  */

  const userPoints = typeof points === "number" ? points : (user && user.points) || 0;
  const rank = (user && user.rank) || "Bronze I";

  const filtered = REWARD_TIERS.filter(t => {
    if (filterUnlocked === "unlocked") return userPoints >= t.threshold;
    if (filterUnlocked === "locked") return userPoints < t.threshold;
    return true;
  });

  return (
    <div style={{ position: "relative", maxWidth: 1100, margin: "0 auto" }}>
      <style>{css}</style>

      {/* Background orbs */}

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "clamp(80px,12vw,120px) clamp(16px,5vw,60px) 120px" }}>

        {/* Header */}
        <div style={{ marginBottom: 48, animation: "fadeUp 0.5s both" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--sp-ghost)", letterSpacing: 4, textTransform: "uppercase", marginBottom: 10 }}>
            // what you unlock for not being bad at this
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(48px,10vw,88px)", letterSpacing: 2, lineHeight: 0.95, marginBottom: 16 }}>
            <ShimmerText>REWARDS</ShimmerText>
          </h1>
          <p style={{ fontSize: "clamp(13px,2vw,15px)", color: "var(--sp-ghost)", maxWidth: 480, lineHeight: 1.6 }}>
            Play games. Win points. Hit thresholds. Unlock perks that actually matter — not fake digital stickers.
          </p>
        </div>

        {/* User progress snapshot */}
        <div style={{
          background: "color-mix(in srgb, var(--sp-plat) 2.5%, transparent)",
          border: "1px solid color-mix(in srgb, var(--sp-plat) 6%, transparent)",
          borderRadius: 16, padding: "20px 24px",
          marginBottom: 36,
          display: "flex", alignItems: "center", gap: 20,
          flexWrap: "wrap",
          animation: "fadeUp 0.5s 0.1s both",
        }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, color: "var(--sp-gold)", lineHeight: 1, textShadow: "0 0 24px color-mix(in srgb, var(--sp-gold) 40%, transparent)" }}>
            {userPoints}
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--sp-ash)", marginBottom: 4 }}>your points · {rank}</div>
            <div style={{ width: 220 }}>
              <ProgressBar value={userPoints} max={100} color="var(--sp-gold)" delay={0.3} />
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--sp-ghost)", marginTop: 6 }}>
              {Math.max(0, 100 - userPoints)} pts to first reward (Bronze Cache)
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onNavigate && (
              <button
                onClick={() => onNavigate("play")}
                style={{
                  background: "linear-gradient(135deg,var(--sp-signal),color-mix(in srgb, var(--sp-signal) 55%, #6fd8ff))",
                  border: "none", borderRadius: 10,
                  color: "#fff", fontFamily: "'Space Grotesk',sans-serif",
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

        {/* Milestone track */}
        <MilestoneTrack userPoints={userPoints} rank={rank} />

        {/* Filter buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32, flexWrap: "wrap", animation: "fadeUp 0.5s 0.2s both" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--sp-ghost)", marginRight: 4 }}>show:</span>
          {[["all", "All tiers"], ["unlocked", "Unlocked"], ["locked", "Locked"]].map(([val, label]) => (
            <button
              key={val}
              className="tier-btn"
              onClick={() => setFilterUnlocked(val)}
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12,
                color: filterUnlocked === val ? "#fff" : "var(--sp-ghost)",
                background: filterUnlocked === val ? "var(--sp-signal)" : "color-mix(in srgb, var(--sp-plat) 4%, transparent)",
                border: `1px solid ${filterUnlocked === val ? "var(--sp-signal)" : "color-mix(in srgb, var(--sp-plat) 7%, transparent)"}`,
                fontFamily: "'Inter', sans-serif", fontWeight: 600,
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
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--sp-rim)", marginBottom: 10 }}>
            // points earned by winning wagers in live games. no purchases. no shortcuts.
          </div>
          <div style={{ fontSize: 12, color: "var(--sp-ghost)" }}>
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
