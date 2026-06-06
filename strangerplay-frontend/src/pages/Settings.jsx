import { useState, useRef, useEffect } from "react";

/* ─────────────────────────────────────────────
   SETTINGS PAGE
   // the page nobody opens until something breaks
   
   TEACH: This page has a sidebar nav + content panel pattern.
   Key concepts:
   - Controlled inputs: <input value={x} onChange={e => setX(e.target.value)} />
   - Toggle switches: custom built with CSS + state
   - Section components: each settings section is its own function
   - Danger zone: destructive actions always need a confirmation step
   - Form pattern: never use <form> in React artifacts; use state + onClick
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

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    to { background-position: -200% center; }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 18px rgba(0,245,160,0.2); }
    50%      { box-shadow: 0 0 38px rgba(0,245,160,0.5); }
  }
  @keyframes orbFloat {
    0%,100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(-28px) scale(1.04); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes toastOut {
    to { opacity: 0; transform: translateY(20px) scale(0.95); }
  }
  @keyframes dangerPulse {
    0%,100% { border-color: rgba(255,77,109,0.3); }
    50%      { border-color: rgba(255,77,109,0.7); }
  }

  .settings-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    color: #f0eeea;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    padding: 11px 14px;
    width: 100%;
    outline: none;
    transition: border 0.2s, box-shadow 0.2s;
  }
  .settings-input:focus {
    border-color: rgba(0,245,160,0.35);
    box-shadow: 0 0 0 3px rgba(0,245,160,0.08);
  }
  .settings-input::placeholder { color: #444; }

  .settings-select {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    color: #f0eeea;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    padding: 11px 14px;
    width: 100%;
    outline: none;
    cursor: pointer;
    appearance: none;
    transition: border 0.2s;
  }
  .settings-select:focus { border-color: rgba(0,245,160,0.35); }
  .settings-select option { background: #1c1d1e; }

  .nav-item {
    cursor: pointer;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    transition: all 0.2s;
    border-radius: 10px;
  }
  .nav-item:hover { background: rgba(255,255,255,0.04) !important; }

  .save-btn {
    background: linear-gradient(135deg,#00f5a0,#00d4ff);
    border: none; border-radius: 10px;
    color: #0a0a0a; font-family: 'Bebas Neue',sans-serif;
    font-size: 16px; letter-spacing: 1.5px;
    padding: 12px 28px; cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  .save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .save-btn:active { transform: translateY(0); }

  .danger-btn {
    background: rgba(255,77,109,0.08);
    border: 1px solid rgba(255,77,109,0.25);
    border-radius: 10px;
    color: #ff4d6d;
    font-family: 'Syne',sans-serif;
    font-size: 13px; font-weight: 600;
    padding: 10px 20px; cursor: pointer;
    transition: all 0.2s;
  }
  .danger-btn:hover {
    background: rgba(255,77,109,0.15);
    border-color: rgba(255,77,109,0.5);
  }

  .section-divider {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.05);
    margin: 24px 0;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  @media (max-width: 768px) {
    .settings-layout { flex-direction: column !important; }
    .settings-sidebar { flex-direction: row !important; flex-wrap: wrap; gap: 8px !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; padding-bottom: 16px !important; }
    .settings-sidebar .nav-item { flex: 1; min-width: 80px; text-align: center !important; padding: 8px 12px !important; }
    .nav-item-label { display: none; }
    .settings-content { padding: 24px 0 !important; }
  }
`;

const BG = `linear-gradient(to right,
  #141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,
  #1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,
  #262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,
  #303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

/* ── Initial state for all settings ── */
/*
  TEACH: All settings live in one big state object.
  Updating nested state: spread the object, then spread the section.
  Example: setSettings(prev => ({ ...prev, account: { ...prev.account, username: "new" } }))
  This is called "immutable update pattern" — never mutate state directly.
*/
const DEFAULT_SETTINGS = {
  account: {
    username: "raj_np",
    email: "raj@example.com",
    bio: "nepal 🇳🇵 · bronze climbing",
    country: "Nepal",
    language: "en",
  },
  privacy: {
    profilePublic: true,
    showOnline: true,
    allowChallenges: true,
    allowSpectators: true,
    showCountry: true,
    allowClips: true,
    showHistory: false,
  },
  notifications: {
    matchFound: true,
    friendOnline: true,
    pointMilestone: true,
    weeklyRecap: false,
    newReward: true,
    crowdReactions: false,
    marketing: false,
  },
  appearance: {
    accentColor: "#00f5a0",
    reducedMotion: false,
    compactMode: false,
    theme: "dark",
  },
  audio: {
    soundEffects: true,
    crowdNoise: true,
    matchPing: true,
    volume: 80,
  },
  danger: {
    confirmReset: false,
    confirmDelete: false,
  },
};

/* ── Toggle Switch ── */
/*
  TEACH: This is a "controlled component" — the switch's
  visual state is always driven by the `value` prop.
  When clicked, it calls onChange (the parent's setter).
  The parent owns the truth; the toggle just displays it.
*/
function Toggle({ value, onChange, color = "#00f5a0", disabled = false }) {
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        background: value ? color : "rgba(255,255,255,0.07)",
        border: `1px solid ${value ? color + "80" : "rgba(255,255,255,0.1)"}`,
        position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.25s, border 0.25s",
        opacity: disabled ? 0.4 : 1,
        boxShadow: value ? `0 0 10px ${color}44` : "none",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: value ? 22 : 2,
        width: 18, height: 18, borderRadius: "50%",
        background: value ? "#0a0a0a" : "#555",
        transition: "left 0.25s, background 0.25s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }} />
    </div>
  );
}

/* ── Field wrapper ── */
function Field({ label, description, children, danger = false }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: description ? 4 : 8, gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: danger ? "#ff4d6d" : "#c8c5bf", marginBottom: description ? 2 : 0 }}>{label}</div>
          {description && <div style={{ fontSize: 11, color: "#444", lineHeight: 1.4 }}>{description}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Section header ── */
function SectionHead({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1.5, color: "#f0eeea" }}>{title}</h2>
      </div>
      {subtitle && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#444", letterSpacing: 2 }}>{subtitle}</div>}
      <hr className="section-divider" style={{ marginTop: 16 }} />
    </div>
  );
}

/* ── Volume slider ── */
function VolumeSlider({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
      <span style={{ fontSize: 12, color: "#444", width: 20 }}>🔇</span>
      <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <input
          type="range" min={0} max={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#00f5a0", cursor: "pointer" }}
        />
      </div>
      <span style={{ fontSize: 12, color: "#444" }}>🔊</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#555", width: 28, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

/* ── Toast notification ── */
function Toast({ message, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,245,160,0.12)", border: "1px solid rgba(0,245,160,0.3)",
      borderRadius: 10, padding: "12px 24px", zIndex: 1000,
      fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#00f5a0",
      backdropFilter: "blur(12px)",
      animation: visible ? "toastIn 0.3s both" : "toastOut 0.3s both forwards",
      display: "flex", alignItems: "center", gap: 10,
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}>
      <span>✓</span> {message}
    </div>
  );
}

/* ── SECTION: Account ── */
function AccountSection({ data, onChange }) {
  return (
    <div style={{ animation: "slideIn 0.3s both" }}>
      <SectionHead icon="👤" title="Account" subtitle="// the basics" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7 }}>Username</label>
          <input
            className="settings-input"
            value={data.username}
            onChange={e => onChange("username", e.target.value)}
            placeholder="your_handle"
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7 }}>Email</label>
          <input
            className="settings-input"
            type="email"
            value={data.email}
            onChange={e => onChange("email", e.target.value)}
            placeholder="you@email.com"
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7 }}>Bio</label>
        <textarea
          className="settings-input"
          value={data.bio}
          onChange={e => onChange("bio", e.target.value)}
          placeholder="say something real"
          rows={3}
          style={{ resize: "vertical", minHeight: 72 }}
        />
        <div style={{ fontSize: 10, color: "#333", marginTop: 4, textAlign: "right" }}>{data.bio.length} / 80</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7 }}>Country</label>
          <div style={{ position: "relative" }}>
            <select
              className="settings-select"
              value={data.country}
              onChange={e => onChange("country", e.target.value)}
            >
              {["Nepal","USA","India","UK","Brazil","Germany","Japan","Korea","Nigeria","France"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#555", pointerEvents: "none", fontSize: 12 }}>▾</span>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7 }}>Language</label>
          <div style={{ position: "relative" }}>
            <select
              className="settings-select"
              value={data.language}
              onChange={e => onChange("language", e.target.value)}
            >
              {[["en","English"],["ne","Nepali"],["hi","Hindi"],["es","Spanish"],["fr","French"],["de","German"],["ja","Japanese"],["ko","Korean"]].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#555", pointerEvents: "none", fontSize: 12 }}>▾</span>
          </div>
        </div>
      </div>

      <hr className="section-divider" />
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 7 }}>Change Password</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="settings-input" type="password" placeholder="current password" />
          <input className="settings-input" type="password" placeholder="new password" />
          <input className="settings-input" type="password" placeholder="confirm new password" />
        </div>
      </div>
    </div>
  );
}

/* ── SECTION: Privacy ── */
function PrivacySection({ data, onChange }) {
  const rows = [
    { key: "profilePublic",    label: "Public profile",       desc: "Anyone can view your stats and history" },
    { key: "showOnline",       label: "Show online status",   desc: "Friends can see when you're active" },
    { key: "allowChallenges",  label: "Allow challenges",     desc: "Friends can challenge you to a game directly" },
    { key: "allowSpectators",  label: "Allow spectators",     desc: "Other users can watch your live games" },
    { key: "showCountry",      label: "Show country flag",    desc: "Your flag appears next to your name in-game" },
    { key: "allowClips",       label: "Allow crowd clipping", desc: "Spectators can clip and share your moments" },
    { key: "showHistory",      label: "Show match history",   desc: "Make your game history visible on your profile" },
  ];

  return (
    <div style={{ animation: "slideIn 0.3s both" }}>
      <SectionHead icon="🛡️" title="Privacy" subtitle="// who sees what" />
      {rows.map(r => (
        <Field key={r.key} label={r.label} description={r.desc}>
          <Toggle value={data[r.key]} onChange={v => onChange(r.key, v)} />
        </Field>
      ))}
    </div>
  );
}

/* ── SECTION: Notifications ── */
function NotificationsSection({ data, onChange }) {
  const rows = [
    { key: "matchFound",      label: "Match found",          desc: "Ping when a game partner is found for you", color: "#00f5a0" },
    { key: "friendOnline",    label: "Friend online",        desc: "Notify when a friend comes online", color: "#00d4ff" },
    { key: "pointMilestone",  label: "Point milestone",      desc: "Alert when you're close to a reward tier", color: "#ffd60a" },
    { key: "newReward",       label: "New reward unlocked",  desc: "Celebrate when you hit a threshold", color: "#ffd60a" },
    { key: "weeklyRecap",     label: "Weekly recap",         desc: "Your wins, losses, and stats every Sunday", color: "#00d4ff" },
    { key: "crowdReactions",  label: "Crowd reactions",      desc: "See when the crowd reacts to your game", color: "#ff4d6d" },
    { key: "marketing",       label: "Updates & news",       desc: "Occasional product updates (rare)", color: "#555" },
  ];

  return (
    <div style={{ animation: "slideIn 0.3s both" }}>
      <SectionHead icon="🔔" title="Notifications" subtitle="// what's allowed to interrupt you" />
      {rows.map(r => (
        <Field key={r.key} label={r.label} description={r.desc}>
          <Toggle value={data[r.key]} onChange={v => onChange(r.key, v)} color={r.color} />
        </Field>
      ))}
    </div>
  );
}

/* ── SECTION: Appearance ── */
function AppearanceSection({ data, onChange }) {
  const accents = ["#00f5a0", "#00d4ff", "#ff4d6d", "#ffd60a", "#a78bfa", "#f472b6"];

  return (
    <div style={{ animation: "slideIn 0.3s both" }}>
      <SectionHead icon="🎨" title="Appearance" subtitle="// make it yours" />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Accent color</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {accents.map(c => (
            <button
              key={c}
              onClick={() => onChange("accentColor", c)}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: c, border: `3px solid ${data.accentColor === c ? "#fff" : "transparent"}`,
                cursor: "pointer", boxShadow: data.accentColor === c ? `0 0 14px ${c}` : "none",
                transition: "all 0.2s", outline: "none",
              }}
            />
          ))}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#444", marginTop: 8 }}>
          current: <span style={{ color: data.accentColor }}>{data.accentColor}</span>
        </div>
      </div>

      <hr className="section-divider" />

      <Field label="Reduce motion" description="Fewer animations — better for focus or accessibility">
        <Toggle value={data.reducedMotion} onChange={v => onChange("reducedMotion", v)} />
      </Field>
      <Field label="Compact mode" description="Tighter spacing on cards and panels">
        <Toggle value={data.compactMode} onChange={v => onChange("compactMode", v)} />
      </Field>

      <hr className="section-divider" />
      <div>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Theme</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["dark","🌑 Dark"],["amoled","⚫ AMOLED"],["dim","🌒 Dim"]].map(([v,l]) => (
            <button
              key={v}
              onClick={() => onChange("theme", v)}
              style={{
                padding: "10px 18px", borderRadius: 10, fontSize: 13,
                background: data.theme === v ? "rgba(0,245,160,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${data.theme === v ? "rgba(0,245,160,0.4)" : "rgba(255,255,255,0.07)"}`,
                color: data.theme === v ? "#00f5a0" : "#555",
                cursor: "pointer", fontFamily: "'Syne',sans-serif", fontWeight: 600,
                transition: "all 0.2s",
              }}
            >{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── SECTION: Audio ── */
function AudioSection({ data, onChange }) {
  const rows = [
    { key: "soundEffects", label: "Sound effects",   desc: "In-game sounds, button clicks, reactions" },
    { key: "crowdNoise",   label: "Crowd noise",      desc: "Ambient crowd audio during live matches" },
    { key: "matchPing",    label: "Match found ping", desc: "Audio alert when a game starts" },
  ];

  return (
    <div style={{ animation: "slideIn 0.3s both" }}>
      <SectionHead icon="🔊" title="Audio" subtitle="// how loud do you want this" />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Master volume</div>
        <VolumeSlider value={data.volume} onChange={v => onChange("volume", v)} />
      </div>

      <hr className="section-divider" />

      {rows.map(r => (
        <Field key={r.key} label={r.label} description={r.desc}>
          <Toggle value={data[r.key]} onChange={v => onChange(r.key, v)} />
        </Field>
      ))}
    </div>
  );
}

/* ── SECTION: Danger Zone ── */
function DangerSection({ data, onChange, onToast }) {
  /*
    TEACH: Destructive actions need a 2-step confirmation.
    Step 1: user clicks the red button → state flips to "confirm mode"
    Step 2: a second button appears asking "are you sure?"
    If they click that, the action fires.
    This prevents accidental account deletion.
  */
  return (
    <div style={{ animation: "slideIn 0.3s both" }}>
      <SectionHead icon="⚠️" title="Danger Zone" subtitle="// you probably shouldn't be here" />

      {/* Reset stats */}
      <div style={{
        background: "rgba(255,77,109,0.05)",
        border: "1px solid rgba(255,77,109,0.15)",
        borderRadius: 14, padding: "20px 24px",
        marginBottom: 16,
        animation: data.confirmReset ? "dangerPulse 1.5s infinite" : "none",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ff4d6d", marginBottom: 4 }}>Reset all stats</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 16, lineHeight: 1.5 }}>
          Clears your points, match history, and rank. Your account stays. Cannot be undone.
        </div>
        {!data.confirmReset ? (
          <button className="danger-btn" onClick={() => onChange("confirmReset", true)}>Reset my stats</button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="danger-btn" style={{ background: "#ff4d6d", color: "#fff", border: "none" }}
              onClick={() => { onChange("confirmReset", false); onToast("Stats reset. Starting from 0."); }}>
              Yes, reset everything
            </button>
            <button className="danger-btn" style={{ color: "#888", borderColor: "rgba(255,255,255,0.1)" }}
              onClick={() => onChange("confirmReset", false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Delete account */}
      <div style={{
        background: "rgba(255,77,109,0.05)",
        border: "1px solid rgba(255,77,109,0.15)",
        borderRadius: 14, padding: "20px 24px",
        animation: data.confirmDelete ? "dangerPulse 1.5s infinite" : "none",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ff4d6d", marginBottom: 4 }}>Delete account</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 16, lineHeight: 1.5 }}>
          Permanently deletes your account, stats, badges, and everything tied to it. Truly gone.
        </div>
        {!data.confirmDelete ? (
          <button className="danger-btn" onClick={() => onChange("confirmDelete", true)}>Delete my account</button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="settings-input"
              placeholder={`type "raj_np" to confirm`}
              style={{ borderColor: "rgba(255,77,109,0.4)" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button className="danger-btn" style={{ background: "#ff4d6d", color: "#fff", border: "none" }}
                onClick={() => { onChange("confirmDelete", false); onToast("Account deletion requested."); }}>
                Delete permanently
              </button>
              <button className="danger-btn" style={{ color: "#888", borderColor: "rgba(255,255,255,0.1)" }}
                onClick={() => onChange("confirmDelete", false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar nav ── */
const NAV_ITEMS = [
  { id: "account",       icon: "👤", label: "Account" },
  { id: "privacy",       icon: "🛡️", label: "Privacy" },
  { id: "notifications", icon: "🔔", label: "Notifications" },
  { id: "appearance",    icon: "🎨", label: "Appearance" },
  { id: "audio",         icon: "🔊", label: "Audio" },
  { id: "danger",        icon: "⚠️", label: "Danger" },
];

/* ══════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════ */
export default function Settings({ onNavigate }) {
  const [activeSection, setActiveSection] = useState("account");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const toastTimer = useRef(null);

  /* Generic updater for any section */
  const update = (section) => (key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  /* Save handler */
  const handleSave = () => {
    showToast("Settings saved.");
    // In real app: POST /api/user/settings with settings state
  };

  /* Toast helper */
  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast({ visible: true, message: msg });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: BG }}>
      <style>{css}</style>

      {/* Background orbs */}
      <div style={{ position: "fixed", left: "-5%", top: "15%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,245,160,0.05) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", animation: "orbFloat 9s ease-in-out infinite" }} />
      <div style={{ position: "fixed", right: "-5%", bottom: "20%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", animation: "orbFloat 11s ease-in-out 2s infinite" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "clamp(80px,12vw,120px) clamp(16px,5vw,60px) 120px" }}>

        {/* Header */}
        <div style={{ marginBottom: 40, animation: "fadeUp 0.5s both" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#444", letterSpacing: 4, textTransform: "uppercase", marginBottom: 10 }}>
            // the page nobody opens until something breaks
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(44px,8vw,72px)", letterSpacing: 2, lineHeight: 1 }}>
            <span style={{ background: "linear-gradient(90deg,#00f5a0,#00d4ff,#00f5a0)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 3s linear infinite", display: "inline-block" }}>SETTINGS</span>
          </h1>
        </div>

        {/* Layout: sidebar + content */}
        <div className="settings-layout" style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>

          {/* Sidebar */}
          <div className="settings-sidebar" style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 100, borderRight: "1px solid rgba(255,255,255,0.05)", paddingRight: 24 }}>
            {NAV_ITEMS.map(item => {
              const active = activeSection === item.id;
              const isDanger = item.id === "danger";
              return (
                <button
                  key={item.id}
                  className="nav-item"
                  onClick={() => setActiveSection(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px",
                    background: active ? (isDanger ? "rgba(255,77,109,0.08)" : "rgba(0,245,160,0.08)") : "transparent",
                    color: active ? (isDanger ? "#ff4d6d" : "#00f5a0") : "#555",
                    fontSize: 13, fontWeight: 600,
                    borderLeft: active ? `2px solid ${isDanger ? "#ff4d6d" : "#00f5a0"}` : "2px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span className="nav-item-label">{item.label}</span>
                </button>
              );
            })}

            {/* Save button in sidebar */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button className="save-btn" onClick={handleSave} style={{ width: "100%", animation: "glowPulse 3s infinite" }}>
                SAVE
              </button>
            </div>
          </div>

          {/* Content panel */}
          <div className="settings-content" style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
            <div style={{
              background: "rgba(255,255,255,0.018)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 18, padding: "32px 28px",
            }}>
              {activeSection === "account"       && <AccountSection       data={settings.account}       onChange={update("account")} />}
              {activeSection === "privacy"       && <PrivacySection       data={settings.privacy}       onChange={update("privacy")} />}
              {activeSection === "notifications" && <NotificationsSection data={settings.notifications} onChange={update("notifications")} />}
              {activeSection === "appearance"    && <AppearanceSection    data={settings.appearance}    onChange={update("appearance")} />}
              {activeSection === "audio"         && <AudioSection         data={settings.audio}         onChange={update("audio")} />}
              {activeSection === "danger"        && <DangerSection        data={settings.danger}        onChange={update("danger")}   onToast={showToast} />}

              {/* Save row at bottom of content */}
              {activeSection !== "danger" && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <button className="save-btn" onClick={handleSave}>SAVE CHANGES</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast.message && <Toast message={toast.message} visible={toast.visible} />}
    </div>
  );
}
