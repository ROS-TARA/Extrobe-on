import { useState } from "react";

const DS = {
  void:"var(--sp-void)", surface:"var(--sp-surface)", surface2:"var(--sp-surface2)",
  rim:"var(--sp-rim)", plat:"var(--sp-plat)", ash:"var(--sp-ash)", ghost:"var(--sp-ghost)",
  signal:"var(--sp-signal)", live:"var(--sp-live)", ice:"var(--sp-ice)", gold:"var(--sp-gold)",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--sp-void); color: var(--sp-plat); transition: background 0.2s, color 0.2s; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--sp-rim); border-radius: 4px; }
  @keyframes sp-enter { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bar-in   { from{width:0} }
  .pf-btn { background:var(--sp-signal); color:#fff; border:none; border-radius:8px; padding:8px 18px; font-size:13px; font-weight:600; cursor:pointer; transition:filter 0.15s; }
  .pf-btn:hover { filter:brightness(1.1); }
  .pf-btn:disabled { opacity:0.45; cursor:not-allowed; }
  .pf-btn-ghost { background:transparent; border:1px solid var(--sp-rim); border-radius:8px; padding:7px 14px; font-size:13px; color:var(--sp-ash); cursor:pointer; transition:background 0.15s,color 0.15s; }
  .pf-btn-ghost:hover { background:var(--sp-surface2); color:var(--sp-plat); }
  .pf-input { background:var(--sp-surface2); border:1.5px solid var(--sp-rim); border-radius:8px; padding:9px 12px; color:var(--sp-plat); font-size:14px; outline:none; width:100%; transition:border-color 0.15s; margin-bottom:8px; }
  .pf-input:focus { border-color:var(--sp-signal); }
  .pf-tab { padding:10px 18px; border:none; border-bottom:2px solid transparent; cursor:pointer; font-size:14px; font-weight:600; background:transparent; transition:color 0.15s,border-color 0.15s; }
  .pf-tab.on  { color:var(--sp-signal); border-bottom-color:var(--sp-signal); }
  .pf-tab.off { color:var(--sp-ash); }
  .pf-tab.off:hover { color:var(--sp-plat); }
  .match-row { transition:background 0.12s; }
  .match-row:hover { background:var(--sp-surface2) !important; }
  @media(max-width:580px){ .pf-stats-3{grid-template-columns:1fr 1fr!important} .pf-hide-sm{display:none!important} }
  @media(max-width:400px){ .pf-stats-3{grid-template-columns:1fr!important} }
`;

/* ── Placeholder data — swap for real API calls when ready ── */
const MATCHES = [
  { opponent:"alex_k",  flag:"🇺🇸", game:"Don't Laugh",     result:"W", pts:+15, ago:"2h ago" },
  { opponent:"priya_s", flag:"🇮🇳", game:"Hot Take",        result:"W", pts:+20, ago:"4h ago" },
  { opponent:"marco_r", flag:"🇧🇷", game:"Echo",            result:"L", pts:-5,  ago:"6h ago" },
  { opponent:"yuki_jp", flag:"🇯🇵", game:"Finish My Story", result:"W", pts:+18, ago:"1d ago" },
  { opponent:"luna_mx", flag:"🇲🇽", game:"Mirror Me",       result:"W", pts:+15, ago:"2d ago" },
];

const FRIENDS = [
  { name:"alex_k",  flag:"🇺🇸", pts:2840, online:true  },
  { name:"priya_s", flag:"🇮🇳", pts:1920, online:true  },
  { name:"marco_r", flag:"🇧🇷", pts:3410, online:false },
  { name:"yuki_jp", flag:"🇯🇵", pts:5102, online:true  },
];

const BADGES = [
  { emoji:"🔥", name:"Hot Streak",    desc:"5 wins in a row",       earned:true  },
  { emoji:"😐", name:"Straight Face", desc:"Survived a full round", earned:true  },
  { emoji:"👑", name:"Crowned",       desc:"Reach Diamond tier",    earned:false },
  { emoji:"🌍", name:"Globetrotter",  desc:"10 countries met",      earned:true  },
  { emoji:"⚡", name:"Speed Demon",   desc:"Answer under 2s",       earned:true  },
  { emoji:"🎯", name:"Sharp Eye",     desc:"90%+ Mirror accuracy",  earned:false },
];

function StatCard({ label, value, sub, pct }) {
  return (
    <div style={{ background:DS.surface, border:`1px solid ${DS.rim}`, borderRadius:12, padding:"14px 16px" }}>
      <div style={{ fontSize:11, fontWeight:600, color:DS.ash, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color:DS.plat, lineHeight:1, marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:DS.ash, marginBottom: pct != null ? 10 : 0 }}>{sub}</div>}
      {pct != null && (
        <div style={{ height:3, background:DS.rim, borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", background:DS.signal, borderRadius:3, width:`${pct}%`, animation:"bar-in 0.8s ease" }} />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════
   MAIN EXPORT
   Props: onNavigate, user (safeUser shape), points (override), onUserUpdate
══════════════════════════════════ */
export default function Profile({ onNavigate, user, points: propPoints, onUserUpdate }) {
  const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";

  const [tab,      setTab]      = useState("stats");
  const [editMode, setEditMode] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState("");
  const [copied,   setCopied]   = useState(false);

  const [username, setUsername] = useState(user?.username || "guest");
  const [bio,      setBio]      = useState(user?.bio      || "");

  const points      = propPoints ?? user?.points      ?? 0;
  const wins        = user?.wins        ?? 0;
  const gamesPlayed = user?.gamesPlayed ?? 0;
  const followers   = user?.followers   ?? 0;
  const following   = user?.following   ?? 0;
  const flag        = user?.flag        ?? "🌍";
  const rank        = user?.rank        ?? "Bronze I";
  const joined      = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month:"short", year:"numeric" })
    : null;

  async function saveProfile() {
    setSaving(true); setSaveErr("");
    try {
      const token = localStorage.getItem("tz_token");
      const res = await fetch(`${API}/api/user/profile`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body:JSON.stringify({ username, bio }),
      });
      const d = await res.json();
      if (!res.ok) setSaveErr(d.error || "Save failed");
      else { onUserUpdate?.(d.user); setEditMode(false); }
    } catch { setSaveErr("Can't reach server"); }
    setSaving(false);
  }

  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/u/${username}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  const TABS = ["stats", "badges", "history", "friends"];
  const winRate = gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0;

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100dvh", background:DS.void, paddingTop:56, paddingBottom:80 }}>
        <div style={{ maxWidth:740, margin:"0 auto", padding:"0 clamp(12px,4vw,24px)" }}>

          <button className="pf-btn-ghost" style={{ marginBottom:20 }} onClick={() => onNavigate?.("home")}>← Back</button>

          {/* ── Profile card ── */}
          <div style={{ background:DS.surface, border:`1px solid ${DS.rim}`, borderRadius:12, padding:"20px", marginBottom:14 }}>
            <div style={{ display:"flex", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>

              {/* Avatar */}
              <div style={{ position:"relative", flexShrink:0 }}>
                <div style={{ width:68, height:68, borderRadius:"50%", background:DS.surface2, border:`2px solid ${DS.signal}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🧑</div>
                {/* online dot */}
                <div style={{ position:"absolute", bottom:2, right:2, width:12, height:12, borderRadius:"50%", background:DS.ice, border:`2px solid ${DS.surface}` }} />
              </div>

              {/* Name + meta */}
              <div style={{ flex:1, minWidth:0 }}>
                {editMode ? (
                  <>
                    <input className="pf-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={{ fontWeight:700, fontSize:17 }} />
                    <input className="pf-input" value={bio}      onChange={e => setBio(e.target.value)}      placeholder="Short bio" />
                  </>
                ) : (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                      <span style={{ fontSize:19, fontWeight:700, color:DS.plat }}>{username}</span>
                      <span style={{ fontSize:16 }}>{flag}</span>
                      <span style={{ background:`${DS.signal}18`, color:DS.signal, border:`1px solid ${DS.signal}44`, borderRadius:6, padding:"2px 9px", fontSize:11, fontWeight:600 }}>{rank}</span>
                    </div>
                    <div style={{ fontSize:13, color:DS.ash, marginBottom:10 }}>
                      {bio || "no bio yet"}{joined && <span style={{ color:DS.ghost }}> · joined {joined}</span>}
                    </div>
                  </>
                )}

                <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
                  {[[following,"following"],[followers,"followers"],[wins,"wins"],[gamesPlayed,"games"]].map(([v,l]) => (
                    <div key={l} style={{ fontSize:13 }}>
                      <span style={{ fontWeight:700, color:DS.plat }}>{v} </span>
                      <span style={{ color:DS.ash }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Points ring */}
              <div style={{ textAlign:"center", flexShrink:0 }}>
                <div style={{ position:"relative", width:68, height:68 }}>
                  <svg width="68" height="68" style={{ transform:"rotate(-90deg)" }}>
                    <circle cx="34" cy="34" r="26" fill="none" stroke={DS.rim} strokeWidth="4" />
                    <circle cx="34" cy="34" r="26" fill="none" stroke={DS.signal} strokeWidth="4"
                      strokeDasharray={2*Math.PI*26}
                      strokeDashoffset={2*Math.PI*26 * (1 - Math.min(points/100, 1))}
                      strokeLinecap="round" style={{ transition:"stroke-dashoffset 0.8s ease" }} />
                  </svg>
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ fontSize:15, fontWeight:700, color:DS.gold, lineHeight:1 }}>{points}</div>
                    <div style={{ fontSize:8, color:DS.ash, fontFamily:"'JetBrains Mono',monospace" }}>PTS</div>
                  </div>
                </div>
                <div style={{ fontSize:10, color:DS.ash, marginTop:4 }}>{points >= 100 ? "unlocked" : `${100-points} to go`}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:"flex", gap:8, marginTop:16, flexWrap:"wrap" }}>
              {editMode ? (
                <>
                  <button className="pf-btn" onClick={saveProfile} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  <button className="pf-btn-ghost" onClick={() => { setEditMode(false); setSaveErr(""); }}>Cancel</button>
                  {saveErr && <span style={{ fontSize:12, color:DS.live, alignSelf:"center" }}>{saveErr}</span>}
                </>
              ) : (
                <>
                  <button className="pf-btn" onClick={() => setEditMode(true)}>Edit profile</button>
                  <button className="pf-btn-ghost" onClick={copyLink}>{copied ? "Copied!" : "🔗 Share"}</button>
                  <button className="pf-btn-ghost" onClick={() => onNavigate?.("settings")}>⚙️ Settings</button>
                </>
              )}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display:"flex", borderBottom:`1px solid ${DS.rim}`, background:DS.surface, borderRadius:"12px 12px 0 0", overflowX:"auto", marginBottom:14 }}>
            {TABS.map(t => (
              <button key={t} className={`pf-tab ${tab===t?"on":"off"}`} onClick={() => setTab(t)} style={{ textTransform:"capitalize" }}>{t}</button>
            ))}
          </div>

          {/* ── STATS ── */}
          {tab === "stats" && (
            <div>
              <div className="pf-stats-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
                <StatCard label="Points"   value={points}    sub={points<100?`${100-points} to first reward`:"reward unlocked"} pct={Math.min(points,100)} />
                <StatCard label="Games"    value={gamesPlayed} sub="total matches"   pct={Math.min(gamesPlayed*10,100)} />
                <StatCard label="Win rate" value={gamesPlayed?`${winRate}%`:"—"}    sub={gamesPlayed?`${wins}W · ${gamesPlayed-wins}L`:"play first"} pct={winRate} />
              </div>
              <div style={{ background:DS.surface, border:`1px solid ${DS.rim}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ fontSize:11, fontWeight:600, color:DS.ash, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:14 }}>By game</div>
                {[["Echo",3,2],["Don't Laugh",4,2],["Mirror Me",2,0],["Vibe Check",2,1],["Hot Take",1,1]].map(([name,pl,w]) => (
                  <div key={name} style={{ marginBottom:13 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
                      <span style={{ color:DS.plat }}>{name}</span>
                      <span style={{ color:DS.ash, fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>{w}W / {pl-w}L</span>
                    </div>
                    <div style={{ height:3, background:DS.rim, borderRadius:3 }}>
                      <div style={{ height:"100%", background:DS.signal, borderRadius:3, width:`${pl?(w/pl)*100:5}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BADGES ── */}
          {tab === "badges" && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10 }}>
              {BADGES.map(b => (
                <div key={b.name} style={{
                  background:DS.surface, border:`1px solid ${b.earned ? `${DS.signal}44` : DS.rim}`,
                  borderRadius:12, padding:"14px 12px", textAlign:"center",
                  opacity: b.earned ? 1 : 0.4,
                }}>
                  <div style={{ fontSize:26, marginBottom:7 }}>{b.emoji}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:DS.plat, marginBottom:3 }}>{b.name}</div>
                  <div style={{ fontSize:11, color:DS.ash }}>{b.desc}</div>
                  {!b.earned && <div style={{ fontSize:10, color:DS.ghost, marginTop:5 }}>🔒 locked</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === "history" && (
            <div style={{ background:DS.surface, border:`1px solid ${DS.rim}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"32px 1fr 80px 52px 56px", gap:8, padding:"9px 16px", borderBottom:`1px solid ${DS.rim}`, fontSize:11, fontWeight:600, color:DS.ash, textTransform:"uppercase" }}>
                <span/><span>Opponent</span><span className="pf-hide-sm">Game</span><span>Pts</span><span className="pf-hide-sm">When</span>
              </div>
              {MATCHES.map((m,i) => (
                <div key={i} className="match-row" style={{
                  display:"grid", gridTemplateColumns:"32px 1fr 80px 52px 56px", gap:8,
                  padding:"11px 16px", borderBottom:`1px solid ${DS.rim}`, alignItems:"center",
                }}>
                  <div style={{ width:26, height:26, borderRadius:"50%", background: m.result==="W" ? `${DS.ice}20` : `${DS.live}20`, border:`1px solid ${m.result==="W" ? DS.ice : DS.live}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color: m.result==="W" ? DS.ice : DS.live }}>{m.result}</div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{m.flag} {m.opponent}</div>
                  <div className="pf-hide-sm" style={{ fontSize:12, color:DS.ash }}>{m.game}</div>
                  <div style={{ fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color: m.pts>0 ? DS.ice : DS.live }}>{m.pts>0?`+${m.pts}`:m.pts}</div>
                  <div className="pf-hide-sm" style={{ fontSize:11, color:DS.ghost }}>{m.ago}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── FRIENDS ── */}
          {tab === "friends" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {FRIENDS.map(f => (
                <div key={f.name} style={{ background:DS.surface, border:`1px solid ${DS.rim}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ position:"relative" }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:DS.surface2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🧑</div>
                    <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background: f.online ? DS.ice : DS.ghost, border:`2px solid ${DS.surface}` }} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:500 }}>{f.flag} {f.name}</div>
                    <div style={{ fontSize:12, color:DS.ash, fontFamily:"'JetBrains Mono',monospace" }}>{f.pts.toLocaleString()} pts</div>
                  </div>
                  <button className="pf-btn-ghost" style={{ fontSize:12, padding:"6px 12px", opacity:0.4 }} disabled title="Coming when matchmaking is wired">Challenge</button>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}