import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════
   Profile.jsx — full rebuild against the locked design system.

   Identity for this page specifically: if LoginSignup is "your
   ticket in," Profile is "your laminated backstage pass once
   you're inside." Same ticket-stub/ink-stamp language, applied to
   a credential card instead of an admission ticket. Avatar sits in
   a stamped ring (not a spinning neon gradient), rank shows as a
   tag pulled from the real server-computed tier, not a fabricated
   "#42 GLOBAL" number that didn't correspond to anything.

   REAL DATA vs PLACEHOLDER — read this before you ask "why 0":
     Real, from the `user` prop (server.js → safeUser()):
       username, bio, points, wins, gamesPlayed, followers,
       following, flag, country, rank, createdAt.
     Still placeholder (same as Main.jsx's leaderboard/watch-live
     fake data — flagged the same way, fix when there's a route):
       per-game breakdown (no /api/games/breakdown endpoint yet),
       badges (no badge system server-side yet),
       friends list (no follow system server-side yet).
     Match history placeholder too, even though GET /api/matches/:userId
     already exists on the backend — wiring it up is a real fetch,
     which is exactly the kind of "functional" work we're parking
     for another day. Swap MATCHES for a real fetch when you're ready.

   THREE THINGS I CHANGED ON PURPOSE:
   1. Killed the fake "#42 GLOBAL" rank tag — it was a hardcoded
      number with zero backing data. Replaced with user.rank, which
      server.js already computes for real from actual points.
   2. Dropped the 4th stat card ("Countries / strangers met") — it
      always showed 0 with no real metric behind it. Three honest
      stats beat four where one is fake.
   3. Wired the ⚙️ settings button and the 🔗 share button — both
      were dead clicks before (no onClick at all on settings, no-op
      on share). Settings now actually navigates; share now actually
      copies a profile link to your clipboard. Neither touches your
      backend, so both stay in scope for a design-only day.
   "Challenge" on the Friends tab stays a ghost button for now — real
   challenge-a-friend needs the matchmaking system we're deferring.
═══════════════════════════════════════════════════════════════ */

const DS = {
  void:    "#0d0b08",
  surface: "#161310",
  surface2:"#1d1812",
  rim:     "#2b251d",
  rimHov:  "#473b2a",
  plat:    "#f4ede1",
  ash:     "#8a7d68",
  ghost:   "#352d22",
  signal:  "#c97b3d",
  live:    "#d6452f",
  ice:     "#7a8f7c",
  gold:    "#e0b454",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: ${DS.void};
    color: ${DS.plat};
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
    background-image:
      radial-gradient(ellipse 900px 600px at 15% -10%, ${DS.signal}14, transparent 60%),
      radial-gradient(ellipse 700px 500px at 100% 30%, ${DS.live}0d, transparent 55%);
  }
  body::after {
    content: '';
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    opacity: 0.05; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  ::-webkit-scrollbar       { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${DS.rim}; border-radius: 99px; }

  @keyframes pf-up    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pf-pop   { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
  @keyframes pf-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes pf-bar   { from{width:0} }
  @keyframes pf-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }

  .pf-up { animation: pf-up 0.5s cubic-bezier(0.16,1,0.3,1) both; }

  .sp-btn-primary {
    background: ${DS.void}; color: ${DS.signal};
    border: 1.5px solid ${DS.signal}; border-radius: 3px;
    font-family: 'Fraunces', serif; font-weight: 600; font-style: italic;
    font-size: 13px; letter-spacing: 0.3px; cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s, background 0.18s, color 0.18s;
    box-shadow: 4px 4px 0 0 ${DS.signal}30;
  }
  .sp-btn-primary:hover { background: ${DS.signal}; color: ${DS.void}; transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 ${DS.signal}55; }
  .sp-btn-primary:active { transform: translate(0,0); box-shadow: 2px 2px 0 0 ${DS.signal}55; }

  .sp-btn-ghost {
    background: transparent; color: ${DS.ash};
    border: 1px dashed ${DS.rimHov}; border-radius: 3px;
    font-family: 'Inter', sans-serif; font-weight: 500; font-size: 13px;
    cursor: pointer; transition: border-color 0.15s, color 0.15s, letter-spacing 0.15s;
  }
  .sp-btn-ghost:hover { border-color: ${DS.signal}; border-style: solid; color: ${DS.plat}; letter-spacing: 0.4px; }
  .sp-icon-btn {
    background: ${DS.surface}; border: 1px solid ${DS.rim}; border-radius: 3px;
    width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
    font-size: 15px; cursor: pointer; transition: border-color 0.15s;
  }
  .sp-icon-btn:hover { border-color: ${DS.signal}55; }

  .sp-input {
    background: transparent; border: none; border-bottom: 1.5px solid ${DS.rim};
    padding: 8px 2px; color: ${DS.plat}; font-family: 'Inter', sans-serif;
    font-size: 14px; outline: none; transition: border-color 0.25s; width: 100%;
  }
  .sp-input:focus { border-bottom-color: ${DS.signal}; }

  .sp-card {
    background: ${DS.surface}; border: 1px solid ${DS.rim}; border-radius: 2px;
    box-shadow: 5px 5px 0 0 ${DS.ghost};
    transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s, border-color 0.25s;
  }
  .sp-card:hover { transform: translate(-3px,-3px); box-shadow: 8px 8px 0 0 ${DS.signal}40; border-color: ${DS.rimHov}; }

  .sp-tag {
    display: inline-block; background: ${DS.surface2}; border: 1px dashed ${DS.rim};
    padding: 3px 10px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
    color: ${DS.ash}; letter-spacing: 0.3px;
  }

  .sp-mode-rail {
    display: inline-flex; background: ${DS.void}; border: 1px solid ${DS.rim};
    border-radius: 3px; padding: 3px; gap: 2px;
  }
  .sp-mode-btn {
    padding: 9px 18px; border-radius: 2px; border: none;
    font-family: 'Fraunces', serif; font-style: italic; font-weight: 600; font-size: 13px;
    cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); letter-spacing: 0.3px;
  }
  .sp-mode-btn.on  { background: ${DS.signal}; color: ${DS.void}; }
  .sp-mode-btn.off { background: transparent; color: ${DS.ash}; }
  .sp-mode-btn.off:hover { color: ${DS.plat}; }

  .pf-stat-bar { height: 4px; background: ${DS.rim}; overflow: hidden; }
  .pf-stat-bar-fill { height: 100%; animation: pf-bar 1.1s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.35s; }

  .pf-row:hover { background: ${DS.surface} !important; }

  @media (max-width: 640px) {
    .pf-header   { flex-direction: column !important; align-items: center !important; text-align: center; }
    .pf-meta-row { justify-content: center !important; }
    .pf-actions  { justify-content: center !important; }
    .pf-stats-grid { grid-template-columns: 1fr 1fr !important; }
    .pf-friends-grid { grid-template-columns: 1fr !important; }
    .pf-history-row { grid-template-columns: 36px 1fr 56px !important; }
    .pf-history-hide { display: none !important; }
  }
`;

function AmbientGrid() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      backgroundImage: `linear-gradient(${DS.rim} 1px, transparent 1px), linear-gradient(90deg, ${DS.rim} 1px, transparent 1px)`,
      backgroundSize: "80px 80px", opacity: 0.3,
      maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
      WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
    }} />
  );
}

function BrassText({ children }) {
  return (
    <span style={{
      background: `linear-gradient(90deg, ${DS.signal} 0%, ${DS.gold} 45%, ${DS.signal} 100%)`,
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
      animation: "pf-shimmer 5s linear infinite",
    }}>{children}</span>
  );
}

/* ── credential avatar — ink-stamped ring, not a spinning neon halo ── */
function CredentialAvatar() {
  return (
    <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        border: `1.5px solid ${DS.signal}`, boxShadow: `0 0 0 4px ${DS.void}, 0 0 0 5px ${DS.rim}`,
      }} />
      <div style={{
        position: "absolute", inset: 6, borderRadius: "50%",
        background: DS.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38,
      }}>🧑</div>
      <div style={{
        position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: "50%",
        background: DS.signal, border: `2px solid ${DS.void}`, animation: "pf-pulse 2s infinite",
      }} />
    </div>
  );
}

/* ── reward-tier ring — honest mechanic: progress to the real 100pt
     first-unlock threshold from the product spec, not invented XP math ── */
function TierRing({ points, rank }) {
  const pct = Math.min(points / 100, 1);
  const r = 38, circ = 2 * Math.PI * r;
  const unlocked = points >= 100;
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div style={{ position: "relative", width: 92, height: 92 }}>
        <svg width="92" height="92" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="46" cy="46" r={r} fill="none" stroke={DS.rim} strokeWidth="4" />
          <circle cx="46" cy="46" r={r} fill="none" stroke={DS.signal} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ - circ * pct} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 19, color: DS.gold }}>{points}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: DS.ash, letterSpacing: 0.5 }}>PTS</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: DS.ash, letterSpacing: 0.5 }}>
        {unlocked ? "tier unlocked" : `${100 - points} to first reward`}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, pct, delay = 0 }) {
  return (
    <div className="sp-card pf-up" style={{ animationDelay: `${delay}s`, padding: "20px 18px" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 36, lineHeight: 1, color: DS.plat, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: DS.ash, marginBottom: pct != null ? 12 : 0 }}>{sub}</div>}
      {pct != null && (
        <div className="pf-stat-bar">
          <div className="pf-stat-bar-fill" style={{ width: `${pct}%`, background: DS.signal }} />
        </div>
      )}
    </div>
  );
}

const BADGES = [
  { emoji: "🔥", name: "Hot Streak",   desc: "5 wins in a row",        color: DS.live,   earned: true  },
  { emoji: "😐", name: "Straight Face",desc: "Survived a full round",  color: DS.signal, earned: true  },
  { emoji: "👑", name: "Crowned",      desc: "Reach Diamond tier",     color: DS.gold,   earned: false },
  { emoji: "🌍", name: "Globetrotter", desc: "10 countries connected", color: DS.ice,    earned: true  },
  { emoji: "⚡", name: "Speed Demon",  desc: "First answer under 2s",  color: DS.signal, earned: true  },
  { emoji: "💀", name: "Ruthless",     desc: "50 Hot Take wins",       color: DS.live,   earned: false },
  { emoji: "🎯", name: "Sharp Eye",    desc: "90%+ Mirror Me accuracy",color: DS.ice,    earned: false },
  { emoji: "🤝", name: "Social",       desc: "100 strangers met",      color: DS.gold,   earned: true  },
];

function Badge({ emoji, name, desc, color, earned, delay }) {
  return (
    <div className="pf-up" style={{ animationDelay: `${delay}s`, animationName: "pf-pop", animationDuration: "0.45s", animationTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
      <div style={{
        background: earned ? DS.surface : DS.surface2,
        border: `1px ${earned ? "solid" : "dashed"} ${earned ? color + "55" : DS.rim}`,
        padding: "18px 12px", textAlign: "center", position: "relative",
        filter: earned ? "none" : "grayscale(0.6) opacity(0.45)",
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 13, color: earned ? color : DS.ash, marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 10.5, color: DS.ash, lineHeight: 1.4 }}>{desc}</div>
        {!earned && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 10, color: DS.ghost }}>🔒</div>}
      </div>
    </div>
  );
}

/* placeholder — real roster names, real shape, swap for GET /api/matches/:userId */
const MATCHES = [
  { opponent: "alex_k",   flag: "🇺🇸", game: "Don't Laugh",     result: "W", pts: +15, duration: "2m 14s", ago: "2h ago" },
  { opponent: "priya_s",  flag: "🇮🇳", game: "Hot Take",        result: "W", pts: +20, duration: "3m 51s", ago: "4h ago" },
  { opponent: "marco_r",  flag: "🇧🇷", game: "Echo",            result: "L", pts:  -5, duration: "1m 38s", ago: "6h ago" },
  { opponent: "yuki_jp",  flag: "🇯🇵", game: "Finish My Story", result: "W", pts: +18, duration: "4m 02s", ago: "1d ago" },
  { opponent: "ghost_00", flag: "🇩🇪", game: "Vibe Check",      result: "L", pts:  -5, duration: "2m 55s", ago: "1d ago" },
  { opponent: "luna_mx",  flag: "🇲🇽", game: "Mirror Me",       result: "W", pts: +15, duration: "3m 11s", ago: "2d ago" },
];

function MatchRow({ opponent, flag, game, result, pts, duration, ago, delay }) {
  const win = result === "W";
  return (
    <div className="pf-row pf-history-row pf-up" style={{
      animationDelay: `${delay}s`,
      display: "grid", gridTemplateColumns: "36px 1fr 90px 64px 64px", alignItems: "center", gap: 10,
      padding: "13px 18px", borderBottom: `1px solid ${DS.rim}`, transition: "background 0.15s",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: win ? DS.signal + "14" : DS.live + "14",
        border: `1px solid ${win ? DS.signal : DS.live}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 12,
        color: win ? DS.signal : DS.live,
      }}>{result}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{flag} {opponent}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.ash }}>{game}</div>
      </div>
      <div className="pf-history-hide" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: DS.ash }}>⏱ {duration}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: pts > 0 ? DS.signal : DS.live }}>{pts > 0 ? `+${pts}` : pts}</div>
      <div className="pf-history-hide" style={{ fontSize: 11, color: DS.ghost }}>{ago}</div>
    </div>
  );
}

/* placeholder — no follow system server-side yet */
const FRIENDS = [
  { name: "alex_k",   flag: "🇺🇸", pts: 2840, online: true  },
  { name: "priya_s",  flag: "🇮🇳", pts: 1920, online: true  },
  { name: "marco_r",  flag: "🇧🇷", pts: 3410, online: false },
  { name: "yuki_jp",  flag: "🇯🇵", pts: 5102, online: true  },
  { name: "luna_mx",  flag: "🇲🇽", pts: 890,  online: false },
  { name: "ghost_00", flag: "🇩🇪", pts: 4270, online: true  },
];

function FriendCard({ name, flag, pts, online, delay }) {
  return (
    <div className="sp-card pf-up" style={{ animationDelay: `${delay}s`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: DS.surface2, border: `1px solid ${DS.rim}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>🧑</div>
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: online ? DS.signal : DS.ghost, border: `2px solid ${DS.surface}` }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{flag} {name}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.ash }}>{pts.toLocaleString()} pts</div>
      </div>
      {/* gated behind the matchmaking system we're deferring — see file header */}
      <button className="sp-btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>challenge</button>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN EXPORT — same props/data contract as before
   Props: onNavigate(page), user (safeUser shape), points (override)
──────────────────────────────────────────────── */
export default function Profile({ onNavigate, user, points: propPoints }) {
  const [tab, setTab]           = useState("stats");
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied]     = useState(false);

  const [username, setUsername] = useState(user?.username || "guest");
  const [bio, setBio]           = useState(user?.bio || "here to embarrass strangers");

  const points      = propPoints ?? user?.points ?? 0;
  const wins        = user?.wins ?? 0;
  const gamesPlayed = user?.gamesPlayed ?? 0;
  const followers   = user?.followers ?? 0;
  const following   = user?.following ?? 0;
  const flag        = user?.flag ?? "🌍";
  const rank        = user?.rank ?? "Bronze I"; // real, server-computed — see calculateRank() in server.js
  const joined      = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  const goBack = () => onNavigate ? onNavigate("home") : window.history.back();

  function copyLink() {
    const url = `${window.location.origin}/u/${username}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const tabs = ["stats", "badges", "history", "friends"];

  return (
    <>
      <style>{css}</style>
      <AmbientGrid />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", paddingTop: 84, paddingBottom: 80 }}>

        <div style={{ padding: "0 clamp(16px,4vw,48px)", maxWidth: 980, margin: "0 auto" }}>
          <button className="sp-btn-ghost" style={{ padding: "7px 16px", marginBottom: 24 }} onClick={goBack}>← back</button>

          {/* ── CREDENTIAL HEADER ── */}
          <div className="pf-header pf-up" style={{
            display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 28,
            paddingBottom: 28, borderBottom: `1px solid ${DS.rim}`, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 22, flexWrap: "wrap" }}>
              <CredentialAvatar />
              <div>
                <div className="pf-meta-row" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  {editMode ? (
                    <input className="sp-input" value={username} onChange={e => setUsername(e.target.value)}
                      style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 28, maxWidth: 220 }} />
                  ) : (
                    <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 34, letterSpacing: -0.5 }}>
                      <BrassText>{username}</BrassText>
                    </h1>
                  )}
                  <span style={{ fontSize: 20 }}>{flag}</span>
                  <span className="sp-tag" style={{ color: DS.gold, borderColor: DS.gold + "44" }}>{rank}</span>
                </div>

                {editMode ? (
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
                    className="sp-input" style={{ maxWidth: 380, resize: "none", marginBottom: 14 }} />
                ) : (
                  <div style={{ fontSize: 13.5, color: DS.ash, marginBottom: 14, maxWidth: 380 }}>
                    {bio}{joined && <span style={{ color: DS.ghost }}> · here since {joined}</span>}
                  </div>
                )}

                <div className="pf-meta-row" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {[[following, "following"], [followers, "followers"], [wins, "wins"], [gamesPlayed, "games"]].map(([val, lbl]) => (
                    <div key={lbl}>
                      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic", fontSize: 18, color: DS.plat, marginRight: 5 }}>{val}</span>
                      <span style={{ fontSize: 11.5, color: DS.ash }}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TierRing points={points} rank={rank} />
          </div>

          {/* ── ACTIONS ── */}
          <div className="pf-actions pf-up" style={{ display: "flex", gap: 8, marginTop: 18, alignItems: "center" }}>
            <button className="sp-btn-primary" style={{ padding: "9px 20px" }} onClick={() => setEditMode(e => !e)}>
              {editMode ? "Save →" : "Edit profile"}
            </button>
            <button className="sp-icon-btn" onClick={copyLink} title="Copy profile link">{copied ? "✓" : "🔗"}</button>
            <button className="sp-icon-btn" onClick={() => onNavigate && onNavigate("settings")} title="Settings">⚙️</button>
            {editMode && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.ghost, marginLeft: 4 }}>
                // saved locally for now — account sync is next
              </span>
            )}
          </div>

          {/* ── TABS ── */}
          <div style={{ marginTop: 30, marginBottom: 26 }}>
            <div className="sp-mode-rail">
              {tabs.map(t => (
                <button key={t} className={`sp-mode-btn ${tab === t ? "on" : "off"}`} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── STATS ── */}
          {tab === "stats" && (
            <div>
              <div className="pf-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
                <StatCard label="Total Points" value={points} sub={points < 100 ? `${100 - points} to first reward` : "reward tier unlocked"} pct={Math.min(points, 100)} delay={0} />
                <StatCard label="Games Played" value={gamesPlayed} sub={gamesPlayed ? "keep the streak going" : "play your first match"} pct={Math.min(gamesPlayed * 10, 100)} delay={0.06} />
                <StatCard label="Win Rate" value={gamesPlayed ? `${Math.round((wins / gamesPlayed) * 100)}%` : "—"} sub={gamesPlayed ? `${wins}W / ${gamesPlayed - wins}L` : "no matches yet"} pct={gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0} delay={0.12} />
              </div>

              <div className="sp-card pf-up" style={{ animationDelay: "0.18s", padding: 22 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.ash, letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
                  // game breakdown — sample, real per-game stats coming
                </div>
                {[
                  { name: "Echo",            played: 3, wins: 2, color: DS.signal },
                  { name: "Don't Laugh",     played: 4, wins: 2, color: DS.gold   },
                  { name: "Mirror Me",       played: 2, wins: 0, color: DS.live   },
                  { name: "Vibe Check",      played: 2, wins: 1, color: DS.ice    },
                  { name: "Finish My Story", played: 1, wins: 1, color: DS.signal },
                ].map((g, i) => (
                  <div key={g.name} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>{g.name}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.ash }}>{g.wins}W / {g.played - g.wins}L</span>
                    </div>
                    <div className="pf-stat-bar">
                      <div className="pf-stat-bar-fill" style={{ width: `${(g.wins / g.played) * 100 || 6}%`, background: g.color, animationDelay: `${0.4 + i * 0.08}s` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BADGES ── */}
          {tab === "badges" && (
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.ash, letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
                // {BADGES.filter(b => b.earned).length} of {BADGES.length} earned
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(128px,1fr))", gap: 12 }}>
                {BADGES.map((b, i) => <Badge key={b.name} {...b} delay={i * 0.05} />)}
              </div>
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === "history" && (
            <div className="sp-card pf-up" style={{ overflow: "hidden" }}>
              <div className="pf-history-row" style={{
                display: "grid", gridTemplateColumns: "36px 1fr 90px 64px 64px", gap: 10,
                padding: "11px 18px", borderBottom: `1px solid ${DS.rim}`,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: DS.ash, letterSpacing: 1.5, textTransform: "uppercase",
              }}>
                <span /><span>Opponent</span><span className="pf-history-hide">Time</span><span>Pts</span><span className="pf-history-hide">When</span>
              </div>
              {MATCHES.map((m, i) => <MatchRow key={i} {...m} delay={i * 0.06} />)}
            </div>
          )}

          {/* ── FRIENDS ── */}
          {tab === "friends" && (
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: DS.ash, letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
                // {following} following
              </div>
              <div className="pf-friends-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {FRIENDS.map((f, i) => <FriendCard key={f.name} {...f} delay={i * 0.06} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}