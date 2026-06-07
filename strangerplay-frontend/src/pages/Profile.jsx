import { useState, useEffect } from "react";

/* ─── SHARED STYLES (same design language as main app) ─── */
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
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes orbFloat {
    0%,100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(-30px) scale(1.05); }
  }
  @keyframes badgePop {
    0%   { transform: scale(0.7); opacity: 0; }
    70%  { transform: scale(1.08); }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes barGrow {
    from { width: 0; }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 20px rgba(0,245,160,0.3); }
    50%      { box-shadow: 0 0 40px rgba(0,245,160,0.6); }
  }
  @keyframes scanline {
    0%   { top: -4px; }
    100% { top: 100%; }
  }

  .fade-up { animation: fadeUp 0.55s both; }

  .stat-bar {
    height: 5px;
    border-radius: 99px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }
  .stat-bar-fill {
    height: 100%;
    border-radius: 99px;
    animation: barGrow 1.2s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: 0.4s;
  }

  .badge-item {
    animation: badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
  }

  .match-row:hover {
    background: rgba(255,255,255,0.04) !important;
  }
  .tab-btn {
    transition: all 0.25s;
    cursor: pointer;
    border: none;
    background: none;
  }
  .tab-btn:hover { color: #f0eeea; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;

/* ─── SHIMMER TEXT ─── */
function Shimmer({ children, style = {} }) {
  return (
    <span style={{
      background: "linear-gradient(90deg,#00f5a0 0%,#00d4ff 30%,#fff 50%,#00d4ff 70%,#00f5a0 100%)",
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: "shimmer 3s linear infinite",
      ...style,
    }}>{children}</span>
  );
}

/* ─── ORB ─── */
function Orb({ color, size, top, left, delay = 0 }) {
  return (
    <div style={{
      position: "fixed", top, left, width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 30% 30%, ${color}40, transparent 70%)`,
      filter: "blur(70px)",
      animation: `orbFloat 9s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      zIndex: 0, pointerEvents: "none",
    }} />
  );
}

/* ─── AVATAR ─── */
function Avatar() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", width: 110, height: 110,
        borderRadius: "50%", cursor: "pointer", flexShrink: 0,
      }}
    >
      {/* rotating gradient ring */}
      <div style={{
        position: "absolute", inset: -3, borderRadius: "50%",
        background: "conic-gradient(#00f5a0, #00d4ff, #ff4d6d, #ffd60a, #00f5a0)",
        animation: "spin 4s linear infinite",
        zIndex: 0,
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        position: "absolute", inset: 2, borderRadius: "50%",
        background: "#141415", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 48,
        transition: "transform 0.3s",
        transform: hovered ? "scale(1.07)" : "scale(1)",
      }}>🧑‍💻</div>

      {/* edit overlay */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 2, borderRadius: "50%",
          background: "rgba(0,0,0,0.5)", zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>✏️</div>
      )}

      {/* online dot */}
      <div style={{
        position: "absolute", bottom: 6, right: 6, zIndex: 3,
        width: 14, height: 14, borderRadius: "50%",
        background: "#00f5a0", border: "2px solid #0e0e0f",
        animation: "glowPulse 2s infinite",
      }} />
    </div>
  );
}

/* ─── STAT CARD ─── */
function StatCard({ label, value, sub, color = "#00f5a0", pct, delay = 0, icon }) {
  return (
    <div className="fade-up" style={{
      animationDelay: `${delay}s`,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 18, padding: "22px 20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 16, right: 16,
        fontSize: 22, opacity: 0.18,
      }}>{icon}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, color: "#444",
        letterSpacing: 2, textTransform: "uppercase",
        marginBottom: 10,
      }}>{label}</div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 42, lineHeight: 1,
        color, textShadow: `0 0 24px ${color}44`,
        marginBottom: 6,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#555", marginBottom: pct != null ? 12 : 0 }}>{sub}</div>}
      {pct != null && (
        <div className="stat-bar">
          <div className="stat-bar-fill" style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
          }} />
        </div>
      )}
    </div>
  );
}

/* ─── BADGE ─── */
const BADGES = [
  { emoji: "🔥", name: "Hot Streak",   desc: "5 wins in a row",        color: "#ff6b35", earned: true },
  { emoji: "😂", name: "Don't Laugh",  desc: "Survived 30s",           color: "#ffd60a", earned: true },
  { emoji: "👑", name: "Crown",        desc: "Top 10 leaderboard",     color: "#ffd60a", earned: false },
  { emoji: "🌍", name: "Globetrotter", desc: "10 countries connected", color: "#00d4ff", earned: true },
  { emoji: "⚡", name: "Speed Demon",  desc: "First answer < 2s",      color: "#00f5a0", earned: true },
  { emoji: "💀", name: "Ruthless",     desc: "50 roast battles won",   color: "#ff4d6d", earned: false },
  { emoji: "🎯", name: "Sharp Eye",    desc: "90%+ trivia accuracy",   color: "#a78bfa", earned: false },
  { emoji: "🤝", name: "Social",       desc: "100 strangers met",      color: "#00d4ff", earned: true },
];

function Badge({ emoji, name, desc, color, earned, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="badge-item"
      style={{ animationDelay: `${delay}s` }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        background: earned
          ? hov ? `linear-gradient(135deg,${color}18,${color}08)` : "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.01)",
        border: `1px solid ${earned ? (hov ? color + "55" : color + "22") : "rgba(255,255,255,0.04)"}`,
        borderRadius: 16, padding: "18px 14px",
        textAlign: "center", cursor: "default",
        transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        transform: hov && earned ? "translateY(-5px) scale(1.04)" : "translateY(0) scale(1)",
        filter: earned ? "none" : "grayscale(1) opacity(0.3)",
        position: "relative",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{emoji}</div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 14, letterSpacing: 1.5,
          color: earned ? color : "#444",
          marginBottom: 4,
        }}>{name}</div>
        <div style={{ fontSize: 11, color: "#444", lineHeight: 1.4 }}>{desc}</div>
        {!earned && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            fontSize: 11, color: "#333",
          }}>🔒</div>
        )}
      </div>
    </div>
  );
}

/* ─── MATCH HISTORY ROW ─── */
const MATCHES = [
  { opponent: "alex_k",   flag: "🇺🇸", game: "Don't Laugh",    result: "W", pts: +15, duration: "2m 14s", ago: "2h ago" },
  { opponent: "priya_s",  flag: "🇮🇳", game: "Roast Battle",   result: "W", pts: +20, duration: "3m 51s", ago: "4h ago" },
  { opponent: "marco_r",  flag: "🇧🇷", game: "Word Sprint",    result: "L", pts:  -5, duration: "1m 38s", ago: "6h ago" },
  { opponent: "yuki_jp",  flag: "🇯🇵", game: "Accent Acting",  result: "W", pts: +18, duration: "4m 02s", ago: "1d ago" },
  { opponent: "ghost_00", flag: "🇩🇪", game: "Trivia Duel",    result: "L", pts:  -5, duration: "2m 55s", ago: "1d ago" },
  { opponent: "luna_mx",  flag: "🇲🇽", game: "Don't Laugh",    result: "W", pts: +15, duration: "3m 11s", ago: "2d ago" },
];

function MatchRow({ opponent, flag, game, result, pts, duration, ago, delay }) {
  const win = result === "W";
  return (
    <div className="match-row fade-up" style={{
      animationDelay: `${delay}s`,
      display: "grid",
      gridTemplateColumns: "42px 1fr minmax(80px,130px) 60px 70px",
      alignItems: "center", gap: 12,
      padding: "14px 20px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      transition: "background 0.2s",
    }}>
      {/* result badge */}
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: win ? "rgba(0,245,160,0.1)" : "rgba(255,77,109,0.1)",
        border: `1px solid ${win ? "#00f5a0" : "#ff4d6d"}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Bebas Neue',sans-serif", fontSize: 14,
        color: win ? "#00f5a0" : "#ff4d6d", letterSpacing: 1,
      }}>{result}</div>

      {/* opponent */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
          {flag} {opponent}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 11, color: "#555",
        }}>{game}</div>
      </div>

      {/* duration */}
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#555" }}>
        ⏱ {duration}
      </div>

      {/* pts */}
      <div style={{
        fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
        color: pts > 0 ? "#00f5a0" : "#ff4d6d",
        fontWeight: 600,
      }}>{pts > 0 ? `+${pts}` : pts}</div>

      {/* ago */}
      <div style={{ fontSize: 12, color: "#444" }}>{ago}</div>

      {/* replay */}
      <div style={{
        fontSize: 11, color: "#444",
        fontFamily: "'JetBrains Mono',monospace",
        cursor: "pointer", transition: "color 0.2s",
      }}
        onMouseEnter={e => e.currentTarget.style.color = "#00d4ff"}
        onMouseLeave={e => e.currentTarget.style.color = "#444"}
      >replay →</div>
    </div>
  );
}

/* ─── MAIN PROFILE COMPONENT ─── */
export default function Profile({ onNavigate, user, points: propPoints }) {
  const [tab, setTab] = useState("stats");
  const [editMode, setEditMode] = useState(false);

  // Pull data from the passed-in user object (set after login/signup).
  // Fall back to defaults so the page never crashes if user is null.
  // user object from server: { username, name, email, points, wins, gamesPlayed, flag, country }
  const [username, setUsername] = useState(user?.username || "guest");
  const [bio, setBio] = useState(user?.bio || "here to embarrass strangers 👾");

  // Real stats from the user object — all start at 0 for new accounts.
  const points      = propPoints     ?? user?.points      ?? 0;
  const wins        = user?.wins        ?? 0;
  const gamesPlayed = user?.gamesPlayed ?? 0;
  const followers   = user?.followers   ?? 0;  // starts at 0, grows as people follow
  const following   = user?.following   ?? 0;
  const flag        = user?.flag        ?? "🌍";
  const country     = user?.country     ?? "";

  // goBack — if onNavigate is passed (from StrangerPlay_Main), use it.
  // Otherwise fall back to browser history. This is called "prop drilling"
  // — the parent controls navigation, the child just calls the function.
  const goBack = () => onNavigate ? onNavigate("home") : window.history.back();

  const tabs = ["stats", "badges", "history", "friends"];

  return (
    <>
      <style>{css}</style>

      {/* background orbs */}
      <Orb color="#00f5a0" size="500px" top="-100px" left="-100px" delay={0} />
      <Orb color="#00d4ff" size="400px" top="40%" left="70%" delay={3} />
      <Orb color="#ff4d6d" size="350px" top="80%" left="10%" delay={5} />

      {/* 
        No top nav here — StrangerPlay_Main already has one fixed at top.
        No bottom nav here — StrangerPlay_Main renders it (with includes() guard).
        Profile just needs paddingTop: 64 (nav height) and paddingBottom: 80 (bottom nav height).
      */}
      <div style={{
        position: "relative", zIndex: 1, minHeight: "100vh",
        background: `linear-gradient(to right,
          #141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,
          #1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,
          #262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,
          #303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`,
        paddingTop: 64,   // height of StrangerPlay_Main top nav
        paddingBottom: 80, // height of bottom nav
      }}>

        {/* ── BACK BUTTON (mobile friendly) ── */}
        <div style={{
          padding: "12px clamp(16px,4vw,48px) 0",
          maxWidth: 1000, margin: "0 auto",
        }}>
          <button onClick={goBack} style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "7px 16px",
            color: "#555", fontFamily: "'JetBrains Mono',monospace",
            fontSize: 12, cursor: "pointer", letterSpacing: 1,
          }}>← back</button>
        </div>

        {/* ── PROFILE HEADER ── */}
        <div style={{ padding: "20px clamp(16px,4vw,48px) 0", maxWidth: 1000, margin: "0 auto" }}>
          <div className="fade-up" style={{
            display: "flex", alignItems: "flex-end", gap: "clamp(16px,3vw,32px)",
            flexWrap: "wrap",   // wraps on mobile so avatar stacks above text
            paddingBottom: 32,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <Avatar />

            <div style={{ flex: 1, minWidth: 200 }}>
              {/* username row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
                {editMode ? (

                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(0,245,160,0.4)",
                      borderRadius: 8, padding: "4px 12px",
                      fontFamily: "'Bebas Neue',sans-serif",
                      fontSize: 38, letterSpacing: 2, color: "#f0eeea",
                      outline: "none",
                    }}
                  />
                ) : (
                  <h1 style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: 44, letterSpacing: 2, lineHeight: 1,
                  }}>
                    <Shimmer>{username}</Shimmer>
                  </h1>
                )}
                <span style={{ fontSize: 22 }}>{flag}</span>

                {/* rank badge */}
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                  background: "rgba(255,214,10,0.08)",
                  border: "1px solid rgba(255,214,10,0.2)",
                  color: "#ffd60a", borderRadius: 20, padding: "4px 12px",
                  letterSpacing: 1,
                }}>#42 GLOBAL</div>
              </div>

              {/* bio */}
              {editMode ? (
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%", maxWidth: 460,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(0,245,160,0.3)",
                    borderRadius: 8, padding: "8px 12px",
                    color: "#aaa", fontFamily: "'Syne',sans-serif", fontSize: 14,
                    outline: "none", resize: "none",
                  }}
                />
              ) : (
                <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>{bio}</div>
              )}

              {/* follower counts — all start at 0 for new accounts */}
              <div style={{ display: "flex", gap: 28, marginBottom: 18 }}>
                {[[following, "following"], [followers, "followers"], [wins, "wins"], [gamesPlayed, "games"]].map(([val, lbl]) => (
                  <div key={lbl}>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: "#f0eeea", marginRight: 4 }}>{val}</span>
                    <span style={{ fontSize: 12, color: "#555" }}>{lbl}</span>
                  </div>
                ))}
              </div>

              {/* action buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setEditMode(!editMode)} style={{
                  background: editMode ? "linear-gradient(135deg,#00f5a0,#00d4ff)" : "rgba(255,255,255,0.05)",
                  border: editMode ? "none" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "10px 22px",
                  color: editMode ? "#0a0a0a" : "#f0eeea",
                  fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  {editMode ? "✓ Save Profile" : "✏️ Edit Profile"}
                </button>
                <button style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "10px 18px",
                  color: "#666", fontSize: 18, cursor: "pointer",
                }}>🔗</button>
                <button style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "10px 18px",
                  color: "#666", fontSize: 18, cursor: "pointer",
                }}>⚙️</button>
              </div>
            </div>

            {/* XP ring (right side) */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke="url(#xpGrad)" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 42 * Math.min(points/100,1)} ${2 * Math.PI * 42}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="xpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00f5a0" />
                    <stop offset="100%" stopColor="#00d4ff" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ marginTop: -72, marginBottom: 52, textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: "#ffd60a" }}>{points}</div>
                <div style={{ fontSize: 10, color: "#444", letterSpacing: 1 }}>/ 100 XP</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#444", letterSpacing: 1 }}>LVL 4</div>
            </div>
          </div>

          {/* ── TABS ── */}
          <div style={{
            display: "flex", gap: 4, marginTop: 28, marginBottom: 32,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            {tabs.map(t => (
              <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{
                padding: "10px 22px",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 12, letterSpacing: 2, textTransform: "uppercase",
                color: tab === t ? "#00f5a0" : "#444",
                borderBottom: tab === t ? "2px solid #00f5a0" : "2px solid transparent",
                marginBottom: -1,
              }}>{t}</button>
            ))}
          </div>

          {/* ── STATS TAB ── */}
          {tab === "stats" && (
            <div>
              {/* top 4 stat cards — values come from props, not hardcoded */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 16, marginBottom: 24 }}>
                <StatCard label="Total Points" value={String(points)}  sub={`${Math.max(0,100-points)} until reward 🎁`}  color="#ffd60a" pct={Math.min(points,100)}  delay={0}    icon="⚡" />
                <StatCard label="Games Played" value={String(gamesPlayed)}   sub="avg 2m 51s per game" color="#00d4ff" pct={Math.min(gamesPlayed*10,100)}   delay={0.07} icon="🎮" />
                <StatCard label="Total Wins"   value={String(wins)}   sub={gamesPlayed ? `${Math.round(wins/gamesPlayed*100)}% win rate` : "play to start"}        color="#00f5a0" pct={gamesPlayed ? Math.round(wins/gamesPlayed*100) : 0}  delay={0.14} icon="🏆" />
                <StatCard label="Countries"    value="0"   sub="strangers met"       color="#a78bfa" pct={0}  delay={0.21} icon="🌍" />
              </div>

              {/* game breakdown */}
              <div className="fade-up" style={{
                animationDelay: "0.28s",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 18, padding: 24,
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 11, color: "#444", letterSpacing: 2,
                  textTransform: "uppercase", marginBottom: 20,
                }}>// game breakdown</div>
                {[
                  { name: "Don't Laugh",   played: 4, wins: 2, color: "#ffd60a" },
                  { name: "Roast Battle",  played: 2, wins: 1, color: "#ff4d6d" },
                  { name: "Word Sprint",   played: 2, wins: 0, color: "#00d4ff" },
                  { name: "Accent Acting", played: 1, wins: 0, color: "#a78bfa" },
                ].map((g, i) => (
                  <div key={g.name} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                      <span style={{
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#555",
                      }}>{g.wins}W / {g.played - g.wins}L</span>
                    </div>
                    <div className="stat-bar">
                      <div className="stat-bar-fill" style={{
                        width: `${(g.wins / g.played) * 100 || 8}%`,
                        background: `linear-gradient(90deg,${g.color},${g.color}88)`,
                        animationDelay: `${0.5 + i * 0.1}s`,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BADGES TAB ── */}
          {tab === "badges" && (
            <div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11, color: "#444", letterSpacing: 2,
                textTransform: "uppercase", marginBottom: 20,
              }}>// {BADGES.filter(b => b.earned).length} of {BADGES.length} earned</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 14 }}>
                {BADGES.map((b, i) => <Badge key={b.name} {...b} delay={i * 0.06} />)}
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === "history" && (
            <div className="fade-up" style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 18, overflow: "hidden",
            }}>
              {/* header row */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "42px 1fr minmax(80px,130px) 60px 70px",
                gap: 12, padding: "12px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11, color: "#333", letterSpacing: 2, textTransform: "uppercase",
                overflowX: "auto",
              }}>
                <span></span><span>Opponent</span><span>Game</span>
                <span>Pts</span><span>Pts Δ</span>
              </div>
              {MATCHES.map((m, i) => <MatchRow key={i} {...m} delay={i * 0.07} />)}
            </div>
          )}

          {/* ── FRIENDS TAB ── */}
          {tab === "friends" && (
            <div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11, color: "#444", letterSpacing: 2,
                textTransform: "uppercase", marginBottom: 20,
              }}>// 128 following</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { name: "alex_k",   flag: "🇺🇸", pts: 2840, online: true },
                  { name: "priya_s",  flag: "🇮🇳", pts: 1920, online: true },
                  { name: "marco_r",  flag: "🇧🇷", pts: 3410, online: false },
                  { name: "yuki_jp",  flag: "🇯🇵", pts: 5102, online: true },
                  { name: "luna_mx",  flag: "🇲🇽", pts: 890,  online: false },
                  { name: "ghost_00", flag: "🇩🇪", pts: 4270, online: true },
                ].map((f, i) => (
                  <div key={f.name} className="fade-up" style={{
                    animationDelay: `${i * 0.07}s`,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 16, padding: "16px 20px",
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{ position: "relative" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: "rgba(255,255,255,0.06)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22,
                      }}>🧑</div>
                      <div style={{
                        position: "absolute", bottom: 1, right: 1,
                        width: 10, height: 10, borderRadius: "50%",
                        background: f.online ? "#00f5a0" : "#333",
                        border: "2px solid #141415",
                      }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{f.flag} {f.name}</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11, color: "#555",
                      }}>{f.pts} pts</div>
                    </div>
                    <button style={{
                      background: "rgba(0,245,160,0.07)",
                      border: "1px solid rgba(0,245,160,0.2)",
                      borderRadius: 10, padding: "7px 14px",
                      color: "#00f5a0", fontSize: 12,
                      fontFamily: "'JetBrains Mono',monospace",
                      cursor: "pointer",
                    }}>challenge</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav is rendered by StrangerPlay_Main — not here */}
      </div>
    </>
  );
}
