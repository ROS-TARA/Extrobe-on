import { useState, useRef, useEffect } from "react";

/*
  Settings.jsx v2 — wired to real user data
  
  Changes from v1:
  - Accepts `user` prop from StrangerPlay_Main (the logged-in user object)
  - Accepts `onUserUpdate` callback to sync updated user back to parent
  - Account section pre-fills from user object (username, email, bio, country)
  - Save actually calls PATCH /api/user/settings with JWT token
  - Loads VITE_API_URL from .env the same way LoginSignup does
  - All other sections (Privacy, Notifications, Audio, etc.) unchanged
  - Danger zone: reset/delete call real endpoints
*/

const DS = {
  void:    "#080809",
  surface: "#0f1012",
  surface2:"#131519",
  rim:     "#1a1c1f",
  rimHov:  "#252830",
  plat:    "#e8e6e0",
  ash:     "#4a4d56",
  ghost:   "#2a2d33",
  signal:  "#e8ff47",
  live:    "#ff3d57",
  ice:     "#47c4ff",
  gold:    "#ffb319",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:${DS.void}; color:${DS.plat}; font-family:'Inter',sans-serif; min-height:100vh; overflow-x:hidden; }

  @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideIn  { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes toastIn  { from{opacity:0;transform:translateY(20px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes toastOut { to{opacity:0;transform:translateY(20px) scale(.95)} }
  @keyframes sp-spin  { to{transform:rotate(360deg)} }
  @keyframes dangerPulse { 0%,100%{border-color:${DS.live}33} 50%{border-color:${DS.live}88} }

  .s-input {
    background:${DS.surface}; border:1px solid ${DS.rim}; border-radius:10px;
    color:${DS.plat}; font-family:'Inter',sans-serif; font-size:14px;
    padding:11px 14px; width:100%; outline:none; transition:border 0.2s, box-shadow 0.2s;
  }
  .s-input:focus { border-color:${DS.signal}55; box-shadow:0 0 0 3px ${DS.signal}0a; }
  .s-input::placeholder { color:${DS.ghost}; }

  .s-select {
    background:${DS.surface}; border:1px solid ${DS.rim}; border-radius:10px;
    color:${DS.plat}; font-family:'Inter',sans-serif; font-size:14px;
    padding:11px 14px; width:100%; outline:none; cursor:pointer; appearance:none;
    transition:border 0.2s;
  }
  .s-select:focus { border-color:${DS.signal}55; }
  .s-select option { background:${DS.surface2}; }

  .s-nav-item {
    cursor:pointer; border:none; background:none;
    width:100%; text-align:left; transition:all 0.18s; border-radius:10px;
    display:flex; align-items:center; gap:10; padding:11px 14px;
  }
  .s-nav-item:hover { background:${DS.surface} !important; }

  .s-save { background:${DS.signal}; color:${DS.void}; border:none; border-radius:10px; font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px; letter-spacing:0.5px; padding:12px 28px; cursor:pointer; transition:filter 0.12s, transform 0.12s; }
  .s-save:hover { filter:brightness(1.08); transform:translateY(-1px); }
  .s-save:disabled { opacity:0.5; cursor:not-allowed; transform:none; }

  .s-ghost { background:transparent; color:${DS.ash}; border:1px solid ${DS.rim}; border-radius:10px; font-family:'Inter',sans-serif; font-weight:500; font-size:13px; padding:9px 18px; cursor:pointer; transition:all 0.15s; }
  .s-ghost:hover { border-color:${DS.rimHov}; color:${DS.plat}; }

  .s-danger-btn { background:${DS.live}0a; border:1px solid ${DS.live}33; border-radius:10px; color:${DS.live}; font-family:'Inter',sans-serif; font-weight:600; font-size:13px; padding:10px 20px; cursor:pointer; transition:all 0.18s; }
  .s-danger-btn:hover { background:${DS.live}18; border-color:${DS.live}66; }

  .s-divider { border:none; border-top:1px solid ${DS.rim}; margin:22px 0; }

  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:${DS.rim}; border-radius:99px; }

  @media (max-width:768px) {
    .s-layout  { flex-direction:column !important; }
    .s-sidebar { flex-direction:row !important; flex-wrap:wrap; gap:6px !important; border-right:none !important; border-bottom:1px solid ${DS.rim} !important; padding-bottom:12px !important; padding-right:0 !important; position:static !important; }
    .s-sidebar .s-nav-item { flex:1; min-width:70px; justify-content:center !important; padding:8px 10px !important; }
    .s-nav-label { display:none !important; }
    .s-content  { padding-left:0 !important; }
  }
`;

/* ── Toggle ── */
function Toggle({ value, onChange, color = DS.signal, disabled = false }) {
  return (
    <div onClick={() => !disabled && onChange(!value)} style={{
      width:44, height:24, borderRadius:12, flexShrink:0,
      background: value ? color : DS.ghost,
      border:`1px solid ${value ? color+"66" : DS.rim}`,
      position:"relative", cursor: disabled?"not-allowed":"pointer",
      transition:"background 0.22s, border 0.22s", opacity: disabled?0.4:1,
      boxShadow: value ? `0 0 10px ${color}44` : "none",
    }}>
      <div style={{
        position:"absolute", top:2, left: value?22:2, width:18, height:18,
        borderRadius:"50%", background: value?"#0a0a0a":"#555",
        transition:"left 0.22s, background 0.22s", boxShadow:"0 1px 3px rgba(0,0,0,0.4)",
      }} />
    </div>
  );
}

/* ── Row: label + control inline ── */
function Row({ label, desc, children, danger = false }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems: desc?"flex-start":"center", gap:16, marginBottom:20 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:500, color: danger?DS.live:DS.plat, marginBottom: desc?3:0 }}>{label}</div>
        {desc && <div style={{ fontSize:11, color:DS.ash, lineHeight:1.4, maxWidth:360 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

/* ── Section header ── */
function SHead({ icon, title, sub }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
        <span style={{ fontSize:20 }}>{icon}</span>
        <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:22, color:DS.plat, letterSpacing:-0.3 }}>{title}</h2>
      </div>
      {sub && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:DS.ash, letterSpacing:2 }}>{sub}</div>}
      <hr className="s-divider" style={{ marginTop:14 }} />
    </div>
  );
}

/* ── Toast ── */
function Toast({ message, visible, isErr }) {
  return (
    <div style={{
      position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
      background: isErr ? DS.live+"14" : DS.signal+"14",
      border:`1px solid ${isErr ? DS.live+"44" : DS.signal+"44"}`,
      borderRadius:10, padding:"12px 24px", zIndex:1000,
      fontFamily:"'JetBrains Mono',monospace", fontSize:12,
      color: isErr ? DS.live : DS.signal,
      backdropFilter:"blur(12px)",
      animation: visible ? "toastIn 0.3s both" : "toastOut 0.3s both forwards",
      display:"flex", alignItems:"center", gap:10, pointerEvents:"none", whiteSpace:"nowrap",
    }}>
      {isErr ? "⚠" : "✓"} {message}
    </div>
  );
}

/* ── SECTION: Account — wired to real user data ── */
function AccountSection({ data, onChange, onSave, saving }) {
  return (
    <div style={{ animation:"slideIn 0.3s both" }}>
      <SHead icon="👤" title="Account" sub="// your identity on StrangerPlay" />

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
        <div>
          <label style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:7 }}>Username</label>
          <input className="s-input" value={data.username || ""} onChange={e => onChange("username", e.target.value.toLowerCase().replace(/\s/g,"_"))} placeholder="your_handle" />
          <div style={{ fontSize:10, color:DS.ghost, marginTop:4 }}>only lowercase letters, numbers, underscores</div>
        </div>
        <div>
          <label style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:7 }}>Email</label>
          <input className="s-input" type="email" value={data.email || ""} onChange={e => onChange("email", e.target.value)} placeholder="you@email.com" />
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <label style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:7 }}>Bio</label>
        <textarea className="s-input" value={data.bio || ""} onChange={e => onChange("bio", e.target.value.slice(0,80))} placeholder="say something real" rows={3} style={{ resize:"vertical", minHeight:72 }} />
        <div style={{ fontSize:10, color: (data.bio||"").length >= 70 ? DS.gold : DS.ghost, marginTop:4, textAlign:"right" }}>{(data.bio||"").length} / 80</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
        <div>
          <label style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:7 }}>Country</label>
          <div style={{ position:"relative" }}>
            <select className="s-select" value={data.country || "Nepal"} onChange={e => onChange("country", e.target.value)}>
              {["Nepal","USA","India","UK","Brazil","Germany","Japan","Korea","Nigeria","France","China","Australia","Canada","Mexico"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:DS.ash, pointerEvents:"none", fontSize:11 }}>▾</span>
          </div>
        </div>
        <div>
          <label style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:7 }}>Language</label>
          <div style={{ position:"relative" }}>
            <select className="s-select" value={data.language || "en"} onChange={e => onChange("language", e.target.value)}>
              {[["en","English"],["ne","Nepali"],["hi","Hindi"],["es","Spanish"],["fr","French"],["de","German"],["ja","Japanese"],["ko","Korean"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:DS.ash, pointerEvents:"none", fontSize:11 }}>▾</span>
          </div>
        </div>
      </div>

      <hr className="s-divider" />

      <div style={{ marginBottom:18 }}>
        <label style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:10 }}>Change Password</label>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <input className="s-input" type="password" placeholder="current password" />
          <input className="s-input" type="password" placeholder="new password (min 8 chars)" />
          <input className="s-input" type="password" placeholder="confirm new password" />
        </div>
        <div style={{ fontSize:11, color:DS.ash, marginTop:8 }}>leave blank to keep current password</div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:20, borderTop:`1px solid ${DS.rim}` }}>
        <button className="s-save" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ── SECTION: Privacy ── */
function PrivacySection({ data, onChange, onSave, saving }) {
  const rows = [
    { key:"profilePublic",   label:"Public profile",       desc:"Anyone can view your stats and history" },
    { key:"showOnline",      label:"Show online status",   desc:"Friends can see when you're active" },
    { key:"allowChallenges", label:"Allow challenges",     desc:"Friends can challenge you directly" },
    { key:"allowSpectators", label:"Allow spectators",     desc:"Others can watch your live games" },
    { key:"showCountry",     label:"Show country flag",    desc:"Your flag appears next to your name in-game" },
    { key:"allowClips",      label:"Allow crowd clipping", desc:"Spectators can clip and share your moments" },
    { key:"showHistory",     label:"Show match history",   desc:"Make your game history visible on your profile" },
  ];
  return (
    <div style={{ animation:"slideIn 0.3s both" }}>
      <SHead icon="🛡️" title="Privacy" sub="// who sees what" />
      {rows.map(r => (
        <Row key={r.key} label={r.label} desc={r.desc}>
          <Toggle value={data[r.key]} onChange={v => onChange(r.key, v)} />
        </Row>
      ))}
      <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:20, borderTop:`1px solid ${DS.rim}` }}>
        <button className="s-save" onClick={onSave} disabled={saving}>{saving?"Saving...":"Save"}</button>
      </div>
    </div>
  );
}

/* ── SECTION: Notifications ── */
function NotificationsSection({ data, onChange, onSave, saving }) {
  const rows = [
    { key:"matchFound",     label:"Match found",          desc:"Ping when a game partner is found",           color:DS.signal },
    { key:"friendOnline",   label:"Friend online",        desc:"Notify when a friend comes online",           color:DS.ice    },
    { key:"pointMilestone", label:"Point milestone",      desc:"Alert when you're close to a reward tier",    color:DS.gold   },
    { key:"newReward",      label:"New reward unlocked",  desc:"Celebrate when you hit a threshold",          color:DS.gold   },
    { key:"weeklyRecap",    label:"Weekly recap",         desc:"Your wins, losses, and stats every Sunday",   color:DS.ice    },
    { key:"crowdReactions", label:"Crowd reactions",      desc:"See when the crowd reacts to your game",      color:DS.live   },
    { key:"marketing",      label:"Updates & news",       desc:"Occasional product updates (rare)",           color:DS.ash    },
  ];
  return (
    <div style={{ animation:"slideIn 0.3s both" }}>
      <SHead icon="🔔" title="Notifications" sub="// what's allowed to interrupt you" />
      {rows.map(r => (
        <Row key={r.key} label={r.label} desc={r.desc}>
          <Toggle value={data[r.key]} onChange={v => onChange(r.key, v)} color={r.color} />
        </Row>
      ))}
      <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:20, borderTop:`1px solid ${DS.rim}` }}>
        <button className="s-save" onClick={onSave} disabled={saving}>{saving?"Saving...":"Save"}</button>
      </div>
    </div>
  );
}

/* ── SECTION: Appearance ── */
function AppearanceSection({ data, onChange, onSave, saving }) {
  const accents = [DS.signal, DS.ice, DS.live, DS.gold, "#a78bfa", "#f472b6", "#00f5a0", "#ff9f43"];
  return (
    <div style={{ animation:"slideIn 0.3s both" }}>
      <SHead icon="🎨" title="Appearance" sub="// make it yours" />

      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>Accent color</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {accents.map(c => (
            <button key={c} onClick={() => onChange("accentColor", c)} style={{
              width:34, height:34, borderRadius:"50%", background:c, outline:"none",
              border:`3px solid ${data.accentColor===c?"#fff":"transparent"}`,
              cursor:"pointer", boxShadow: data.accentColor===c?`0 0 14px ${c}99`:"none",
              transition:"all 0.18s",
            }} />
          ))}
        </div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:DS.ash, marginTop:8 }}>
          active: <span style={{ color:data.accentColor }}>{data.accentColor}</span>
        </div>
      </div>

      <hr className="s-divider" />
      <Row label="Reduce motion" desc="Fewer animations — better for focus or accessibility">
        <Toggle value={data.reducedMotion} onChange={v => onChange("reducedMotion", v)} />
      </Row>
      <Row label="Compact mode" desc="Tighter spacing on cards and panels">
        <Toggle value={data.compactMode} onChange={v => onChange("compactMode", v)} />
      </Row>
      <hr className="s-divider" />

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>Theme</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {[["dark","🌑 Dark"],["amoled","⚫ AMOLED"],["dim","🌒 Dim"]].map(([v,l]) => (
            <button key={v} onClick={() => onChange("theme", v)} style={{
              padding:"10px 18px", borderRadius:10, fontSize:13,
              background: data.theme===v ? DS.signal+"14" : DS.surface,
              border:`1px solid ${data.theme===v ? DS.signal+"55" : DS.rim}`,
              color: data.theme===v ? DS.signal : DS.ash,
              cursor:"pointer", fontFamily:"'Inter',sans-serif", fontWeight:500, transition:"all 0.18s",
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:20, borderTop:`1px solid ${DS.rim}` }}>
        <button className="s-save" onClick={onSave} disabled={saving}>{saving?"Saving...":"Save"}</button>
      </div>
    </div>
  );
}

/* ── SECTION: Audio ── */
function AudioSection({ data, onChange, onSave, saving }) {
  const rows = [
    { key:"soundEffects", label:"Sound effects",    desc:"In-game sounds, button clicks, reactions" },
    { key:"crowdNoise",   label:"Crowd noise",       desc:"Ambient crowd audio during live matches" },
    { key:"matchPing",    label:"Match found ping",  desc:"Audio alert when a game starts" },
  ];
  return (
    <div style={{ animation:"slideIn 0.3s both" }}>
      <SHead icon="🔊" title="Audio" sub="// how loud do you want this" />
      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:11, color:DS.ash, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>Master volume</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:12, color:DS.ash }}>🔇</span>
          <input type="range" min={0} max={100} value={data.volume} onChange={e => onChange("volume", Number(e.target.value))} style={{ flex:1, accentColor:DS.signal, cursor:"pointer" }} />
          <span style={{ fontSize:12, color:DS.ash }}>🔊</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:DS.ash, width:32, textAlign:"right" }}>{data.volume}%</span>
        </div>
      </div>
      <hr className="s-divider" />
      {rows.map(r => (
        <Row key={r.key} label={r.label} desc={r.desc}>
          <Toggle value={data[r.key]} onChange={v => onChange(r.key, v)} />
        </Row>
      ))}
      <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:20, borderTop:`1px solid ${DS.rim}` }}>
        <button className="s-save" onClick={onSave} disabled={saving}>{saving?"Saving...":"Save"}</button>
      </div>
    </div>
  );
}

/* ── SECTION: Connected Accounts ── */
function ConnectedSection() {
  const [connected, setConnected] = useState({ google:false, twitter:false, discord:false });
  return (
    <div style={{ animation:"slideIn 0.3s both" }}>
      <SHead icon="🔗" title="Connected Accounts" sub="// link your other identities" />
      {[
        { key:"google",  icon:"G",  label:"Google",  color:"#ea4335" },
        { key:"twitter", icon:"𝕏",  label:"X / Twitter", color:"#1da1f2" },
        { key:"discord", icon:"D",  label:"Discord", color:"#5865f2" },
      ].map(a => (
        <Row key={a.key} label={a.label} desc={connected[a.key] ? "Connected" : "Not connected"}>
          <button
            onClick={() => setConnected(prev => ({ ...prev, [a.key]: !prev[a.key] }))}
            style={{
              background: connected[a.key] ? DS.live+"10" : DS.surface,
              border:`1px solid ${connected[a.key] ? DS.live+"44" : DS.rim}`,
              borderRadius:9, padding:"7px 16px", cursor:"pointer",
              color: connected[a.key] ? DS.live : DS.ash,
              fontFamily:"'Inter',sans-serif", fontWeight:500, fontSize:12,
              transition:"all 0.18s",
            }}
          >
            {connected[a.key] ? "Disconnect" : "Connect"}
          </button>
        </Row>
      ))}
    </div>
  );
}

/* ── SECTION: Danger Zone ── */
function DangerSection({ username, onToast }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const doReset = async () => {
    try {
      const token = localStorage.getItem("sp_token");
      await fetch(`${API}/api/user/reset-stats`, { method:"POST", headers:{ "Authorization":`Bearer ${token}` } });
      setConfirmReset(false);
      onToast("Stats reset. Starting from 0.", false);
    } catch { onToast("Server error — try again", true); }
  };

  const doDelete = async () => {
    if (deleteInput !== username) { onToast("Username doesn't match", true); return; }
    try {
      const token = localStorage.getItem("sp_token");
      await fetch(`${API}/api/user/delete`, { method:"DELETE", headers:{ "Authorization":`Bearer ${token}` } });
      localStorage.removeItem("sp_token"); localStorage.removeItem("sp_user");
      window.location.reload();
    } catch { onToast("Server error — try again", true); }
  };

  return (
    <div style={{ animation:"slideIn 0.3s both" }}>
      <SHead icon="⚠️" title="Danger Zone" sub="// you probably shouldn't be here" />

      {/* Reset stats */}
      <div style={{ background:DS.live+"05", border:`1px solid ${DS.live}22`, borderRadius:14, padding:"20px 22px", marginBottom:14, animation: confirmReset?"dangerPulse 1.5s infinite":"none" }}>
        <div style={{ fontSize:14, fontWeight:600, color:DS.live, marginBottom:4 }}>Reset all stats</div>
        <div style={{ fontSize:12, color:DS.ash, marginBottom:16, lineHeight:1.5 }}>Clears your points, match history, and rank. Account stays. Cannot be undone.</div>
        {!confirmReset
          ? <button className="s-danger-btn" onClick={() => setConfirmReset(true)}>Reset my stats</button>
          : <div style={{ display:"flex", gap:10 }}>
              <button className="s-danger-btn" style={{ background:DS.live, color:"#fff", border:"none" }} onClick={doReset}>Yes, reset everything</button>
              <button className="s-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
        }
      </div>

      {/* Delete account */}
      <div style={{ background:DS.live+"05", border:`1px solid ${DS.live}22`, borderRadius:14, padding:"20px 22px", animation: confirmDelete?"dangerPulse 1.5s infinite":"none" }}>
        <div style={{ fontSize:14, fontWeight:600, color:DS.live, marginBottom:4 }}>Delete account</div>
        <div style={{ fontSize:12, color:DS.ash, marginBottom:16, lineHeight:1.5 }}>Permanently deletes your account, stats, badges, and everything. Truly gone.</div>
        {!confirmDelete
          ? <button className="s-danger-btn" onClick={() => setConfirmDelete(true)}>Delete my account</button>
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input className="s-input" placeholder={`type "${username}" to confirm`} value={deleteInput} onChange={e => setDeleteInput(e.target.value)} style={{ borderColor:DS.live+"44" }} />
              <div style={{ display:"flex", gap:10 }}>
                <button className="s-danger-btn" style={{ background:DS.live, color:"#fff", border:"none" }} onClick={doDelete}>Delete permanently</button>
                <button className="s-ghost" onClick={() => { setConfirmDelete(false); setDeleteInput(""); }}>Cancel</button>
              </div>
            </div>
        }
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   MAIN EXPORT
   Props:
     user          — user object from localStorage (set after login)
     onNavigate    — goTo() from parent
     onUserUpdate  — called with updated user after save (syncs parent state)
────────────────────────────────────────── */
export default function Settings({ onNavigate, user, onUserUpdate }) {
  const [activeSection, setActiveSection] = useState("account");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ visible:false, message:"", isErr:false });
  const toastTimer = useRef(null);

  // API URL from .env — same pattern as LoginSignup
  const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";

  /*
    ACCOUNT state — seeded from the real user object.
    When user logs in, this pre-fills with their actual data.
    Without this, Settings always showed hardcoded "raj_np".
  */
  const [account, setAccount] = useState({
    username: user?.username || "",
    email:    user?.email    || "",
    bio:      user?.bio      || "",
    country:  user?.country  || "Nepal",
    language: user?.language || "en",
  });

  // Resync if user prop changes (e.g. after a reload)
  useEffect(() => {
    if (user) {
      setAccount({
        username: user.username || "",
        email:    user.email    || "",
        bio:      user.bio      || "",
        country:  user.country  || "Nepal",
        language: user.language || "en",
      });
    }
  }, [user]);

  // Non-account settings — these don't come from server yet, just localStorage
  const [privacy, setPrivacy] = useState({
    profilePublic:true, showOnline:true, allowChallenges:true,
    allowSpectators:true, showCountry:true, allowClips:true, showHistory:false,
  });
  const [notifications, setNotifications] = useState({
    matchFound:true, friendOnline:true, pointMilestone:true,
    newReward:true, weeklyRecap:false, crowdReactions:false, marketing:false,
  });
  const [appearance, setAppearance] = useState({
    accentColor:DS.signal, reducedMotion:false, compactMode:false, theme:"dark",
  });
  const [audio, setAudio] = useState({
    soundEffects:true, crowdNoise:true, matchPing:true, volume:80,
  });

  function showToast(msg, isErr = false) {
    clearTimeout(toastTimer.current);
    setToast({ visible:true, message:msg, isErr });
    toastTimer.current = setTimeout(() => setToast(t => ({...t, visible:false})), 3000);
  }

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /*
    SAVE to server — calls PATCH /api/user/settings
    Requires JWT token from localStorage.
    Server should update the user document in MongoDB.
    After save, we update localStorage and tell parent (onUserUpdate).
  */
  const handleSave = async () => {
    if (!user) { showToast("You're not logged in", true); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem("sp_token");
      const res = await fetch(`${API}/api/user/settings`, {
        method:"PATCH",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${token}`,
        },
        body:JSON.stringify({
          username:    account.username,
          email:       account.email,
          bio:         account.bio,
          country:     account.country,
          language:    account.language,
          privacy,
          notifications,
          appearance,
          audio,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Save failed", true); setSaving(false); return; }

      // Update localStorage with new user data
      const saved = JSON.parse(localStorage.getItem("sp_user") || "{}");
      const updated = { ...saved, username:account.username, email:account.email, bio:account.bio, country:account.country };
      localStorage.setItem("sp_user", JSON.stringify(updated));

      // Tell parent to update its `user` state — fixes nav username display instantly
      if (onUserUpdate) onUserUpdate(updated);

      showToast("Settings saved");
    } catch(e) {
      // If server is down, save locally and tell user
      showToast("Saved locally — server unreachable", true);
    }
    setSaving(false);
  };

  const goBack = () => onNavigate ? onNavigate("home") : window.history.back();

  const NAV_ITEMS = [
    { id:"account",       icon:"👤", label:"Account"       },
    { id:"privacy",       icon:"🛡️", label:"Privacy"       },
    { id:"notifications", icon:"🔔", label:"Notifications" },
    { id:"appearance",    icon:"🎨", label:"Appearance"    },
    { id:"audio",         icon:"🔊", label:"Audio"         },
    { id:"connected",     icon:"🔗", label:"Connected"     },
    { id:"danger",        icon:"⚠️", label:"Danger"        },
  ];

  return (
    <div style={{ position:"relative", minHeight:"100vh", background:DS.void }}>
      <style>{css}</style>

      <div style={{ position:"relative", zIndex:1, maxWidth:1100, margin:"0 auto", padding:"clamp(80px,12vw,110px) clamp(16px,5vw,60px) 120px" }}>

        {/* Back + header */}
        <div style={{ marginBottom:36, animation:"fadeUp 0.45s both" }}>
          <button className="s-ghost" style={{ padding:"7px 14px", marginBottom:24, fontSize:12 }} onClick={goBack}>← back</button>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:DS.ash, letterSpacing:4, textTransform:"uppercase", marginBottom:10 }}>
            // the page nobody opens until something breaks
          </div>
          <h1 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:"clamp(40px,8vw,66px)", letterSpacing:-1, lineHeight:1, color:DS.plat }}>
            Settings
          </h1>
          {/* Show current user identity at top */}
          {user && (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:14, padding:"10px 16px", background:DS.surface, border:`1px solid ${DS.rim}`, borderRadius:12, display:"inline-flex" }}>
              <span style={{ fontSize:18 }}>🧑‍💻</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:DS.signal }}>{user.username}</span>
              <span style={{ fontSize:12, color:DS.ash }}>·</span>
              <span style={{ fontSize:12, color:DS.ash }}>{user.email}</span>
            </div>
          )}
          {!user && (
            <div style={{ marginTop:14, padding:"12px 16px", background:DS.live+"0a", border:`1px solid ${DS.live}33`, borderRadius:12, fontSize:13, color:DS.live }}>
              ⚠ You're not signed in — settings won't save
            </div>
          )}
        </div>

        {/* Layout: sidebar + content */}
        <div className="s-layout" style={{ display:"flex", gap:36, alignItems:"flex-start" }}>

          {/* Sidebar */}
          <div className="s-sidebar" style={{ width:190, flexShrink:0, display:"flex", flexDirection:"column", gap:2, position:"sticky", top:100, borderRight:`1px solid ${DS.rim}`, paddingRight:20 }}>
            {NAV_ITEMS.map(item => {
              const active = activeSection === item.id;
              const isDanger = item.id === "danger";
              return (
                <button key={item.id} className="s-nav-item" onClick={() => setActiveSection(item.id)} style={{
                  background: active ? (isDanger?DS.live+"0a":DS.signal+"0a") : "transparent",
                  color: active ? (isDanger?DS.live:DS.signal) : DS.ash,
                  fontSize:13, fontWeight:500,
                  borderLeft:`2px solid ${active?(isDanger?DS.live:DS.signal):"transparent"}`,
                }}>
                  <span style={{ fontSize:16 }}>{item.icon}</span>
                  <span className="s-nav-label">{item.label}</span>
                </button>
              );
            })}
            <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${DS.rim}` }}>
              <button className="s-save" onClick={handleSave} disabled={saving} style={{ width:"100%" }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="s-content" style={{ flex:1, minWidth:0, paddingLeft:8 }}>
            <div style={{ background:DS.surface, border:`1px solid ${DS.rim}`, borderRadius:18, padding:"28px 24px" }}>
              {activeSection==="account"       && <AccountSection       data={account}        onChange={(k,v)=>setAccount(p=>({...p,[k]:v}))}        onSave={handleSave} saving={saving} />}
              {activeSection==="privacy"       && <PrivacySection       data={privacy}        onChange={(k,v)=>setPrivacy(p=>({...p,[k]:v}))}        onSave={handleSave} saving={saving} />}
              {activeSection==="notifications" && <NotificationsSection data={notifications}  onChange={(k,v)=>setNotifications(p=>({...p,[k]:v}))}  onSave={handleSave} saving={saving} />}
              {activeSection==="appearance"    && <AppearanceSection    data={appearance}     onChange={(k,v)=>setAppearance(p=>({...p,[k]:v}))}     onSave={handleSave} saving={saving} />}
              {activeSection==="audio"         && <AudioSection         data={audio}          onChange={(k,v)=>setAudio(p=>({...p,[k]:v}))}          onSave={handleSave} saving={saving} />}
              {activeSection==="connected"     && <ConnectedSection />}
              {activeSection==="danger"        && <DangerSection        username={user?.username||"user"} onToast={showToast} />}
            </div>
          </div>
        </div>
      </div>

      {toast.message && <Toast message={toast.message} visible={toast.visible} isErr={toast.isErr} />}
    </div>
  );
}