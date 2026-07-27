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
  @keyframes sp-spin  { to{transform:rotate(360deg)} }
  input, select, textarea { font-family: inherit; }
  .s-input {
    background: var(--sp-surface2); border: 1.5px solid var(--sp-rim);
    border-radius: 8px; padding: 10px 13px; color: var(--sp-plat);
    font-size: 14px; outline: none; width: 100%; transition: border-color 0.15s;
  }
  .s-input:focus { border-color: var(--sp-signal); }
  .s-input::placeholder { color: var(--sp-ghost); }
  .s-btn {
    background: var(--sp-signal); color: #fff; border: none;
    border-radius: 8px; padding: 10px 20px; font-size: 14px;
    font-weight: 600; cursor: pointer; transition: filter 0.15s;
  }
  .s-btn:hover:not(:disabled) { filter: brightness(1.1); }
  .s-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .s-btn-ghost {
    background: transparent; border: 1px solid var(--sp-rim);
    border-radius: 8px; padding: 9px 18px; color: var(--sp-ash);
    font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .s-btn-ghost:hover { background: var(--sp-surface2); color: var(--sp-plat); }
  .s-toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
  .s-toggle input { opacity: 0; width: 0; height: 0; }
  .s-slider {
    position: absolute; cursor: pointer; inset: 0;
    background: var(--sp-rim); border-radius: 24px; transition: background 0.2s;
  }
  .s-slider::before {
    content: ''; position: absolute; height: 18px; width: 18px;
    left: 3px; bottom: 3px; background: #fff; border-radius: 50%;
    transition: transform 0.2s;
  }
  .s-toggle input:checked + .s-slider { background: var(--sp-signal); }
  .s-toggle input:checked + .s-slider::before { transform: translateX(20px); }
  .s-nav-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;
    color: var(--sp-ash); transition: background 0.12s, color 0.12s;
    border: none; background: transparent; width: 100%; text-align: left;
  }
  .s-nav-item:hover  { background: var(--sp-surface2); color: var(--sp-plat); }
  .s-nav-item.active { background: var(--sp-signal); color: #fff; }
  .s-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--sp-rim); }
  .s-row:last-child { border-bottom: none; }
  .s-danger-box { border: 1px solid var(--sp-live); border-radius: 10px; padding: 16px; }
  .s-danger-btn {
    background: transparent; border: 1px solid var(--sp-live); border-radius: 8px;
    padding: 8px 16px; color: var(--sp-live); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .s-danger-btn:hover { background: var(--sp-live); color: #fff; }
  .s-danger-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .hide-mob { display: block; }
  .show-mob { display: none; }
  @media (max-width: 640px) { .hide-mob { display: none !important; } .show-mob { display: flex !important; } }
`;

function Toggle({ value, onChange }) {
  return (
    <label className="s-toggle">
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
      <span className="s-slider" />
    </label>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: DS.plat }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: DS.ash, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: DS.ash, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>{label}</label>
      <input className="s-input" type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div className="s-row">
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: DS.plat }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: DS.ash, marginTop: 2 }}>{sub}</div>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

/* ── Account ── */
function AccountSection({ data, onChange, onSave, saving }) {
  return (
    <div>
      <SectionTitle title="Account" />
      <Field label="Display Name" value={data.name}     onChange={v => onChange("name", v)}     placeholder="Your name" />
      <Field label="Username"     value={data.username} onChange={v => onChange("username", v)} placeholder="username" />
      <Field label="Bio"          value={data.bio}      onChange={v => onChange("bio", v)}      placeholder="Short bio" />
      <Field label="Email"        value={data.email}    onChange={v => onChange("email", v)}    type="email" />
      <div style={{ marginTop: 8 }}>
        <button className="s-btn" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

/* ── Password ── */
function PasswordSection({ API }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [err,  setErr]  = useState("");
  const [ok,   setOk]   = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(""); setOk(false);
    if (!form.current) return setErr("Enter your current password");
    if (form.next.length < 8) return setErr("New password must be at least 8 characters");
    if (form.next !== form.confirm) return setErr("Passwords don't match");
    setBusy(true);
    try {
      const token = localStorage.getItem("sp_token");
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const d = await res.json();
      if (!res.ok) setErr(d.error || "Wrong current password");
      else { setOk(true); setForm({ current: "", next: "", confirm: "" }); }
    } catch { setErr("Can't reach server"); }
    setBusy(false);
  }

  return (
    <div>
      <SectionTitle title="Password" />
      <Field label="Current password" value={form.current} onChange={v => setForm(p => ({ ...p, current: v }))} type="password" />
      <Field label="New password"     value={form.next}    onChange={v => setForm(p => ({ ...p, next: v }))}    type="password" />
      <Field label="Confirm new"      value={form.confirm} onChange={v => setForm(p => ({ ...p, confirm: v }))} type="password" />
      {err && <div style={{ fontSize: 13, color: DS.live, marginBottom: 10 }}>{err}</div>}
      {ok  && <div style={{ fontSize: 13, color: DS.ice,  marginBottom: 10 }}>Password updated.</div>}
      <button className="s-btn" onClick={submit} disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </div>
  );
}

/* ── Appearance — THE theme toggle ── */
function AppearanceSection({ theme, onThemeChange }) {
  return (
    <div>
      <SectionTitle title="Appearance" sub="Choose how Tranzle looks for you. Changes apply everywhere instantly." />

      <div style={{ fontSize: 12, fontWeight: 600, color: DS.ash, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Theme</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[["dark", "🌙", "Dark"], ["light", "☀️", "Light"]].map(([val, icon, label]) => (
          <button
            key={val}
            onClick={() => onThemeChange(val)}
            style={{
              flex: 1, padding: "14px 12px", borderRadius: 10, cursor: "pointer",
              border: `2px solid ${theme === val ? "var(--sp-signal)" : "var(--sp-rim)"}`,
              background: theme === val ? "var(--sp-signal)" : "var(--sp-surface2)",
              color: theme === val ? "#fff" : DS.ash,
              fontSize: 14, fontWeight: 600, transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{icon}</span> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Privacy ── */
function PrivacySection({ data, onChange, onSave, saving }) {
  return (
    <div>
      <SectionTitle title="Privacy" sub="Control what others can see about you." />
      <ToggleRow label="Show on leaderboard"  sub="Others can see your rank and points"  value={data.showOnLeaderboard} onChange={v => onChange("showOnLeaderboard", v)} />
      <ToggleRow label="Allow crowd watching" sub="Let users spectate your live calls"   value={data.allowCrowdWatch}   onChange={v => onChange("allowCrowdWatch", v)} />
      <ToggleRow label="Show country on profile" sub="Flag and country visible to others" value={data.showCountry}       onChange={v => onChange("showCountry", v)} />
      <div style={{ marginTop: 16 }}>
        <button className="s-btn" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

/* ── Notifications ── */
function NotificationsSection({ data, onChange, onSave, saving }) {
  return (
    <div>
      <SectionTitle title="Notifications" sub="Choose what you want to be notified about." />
      <ToggleRow label="Match found"    sub="When a stranger is matched to you"     value={data.matchFound}   onChange={v => onChange("matchFound", v)} />
      <ToggleRow label="New follower"   sub="When someone follows your profile"     value={data.newFollower}  onChange={v => onChange("newFollower", v)} />
      <ToggleRow label="Game results"   sub="Point changes and win/loss updates"    value={data.gameResult}   onChange={v => onChange("gameResult", v)} />
      <ToggleRow label="Weekly summary" sub="How you did this week (email)"         value={data.weeklyDigest} onChange={v => onChange("weeklyDigest", v)} />
      <div style={{ marginTop: 16 }}>
        <button className="s-btn" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

/* ── Danger ── */
function DangerSection({ API, onNavigate }) {
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput,   setDeleteInput]   = useState("");
  const token = localStorage.getItem("sp_token");

  async function resetStats() {
    await fetch(`${API}/api/user/reset-stats`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setConfirmReset(false);
    alert("Stats reset.");
  }

  async function deleteAccount() {
    if (deleteInput !== "DELETE") return;
    await fetch(`${API}/api/user/delete`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    localStorage.clear();
    window.location.reload();
  }

  return (
    <div>
      <SectionTitle title="Danger Zone" />

      <div className="s-danger-box" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: DS.plat, marginBottom: 4 }}>Reset stats</div>
        <div style={{ fontSize: 13, color: DS.ash, marginBottom: 12 }}>Wipes your points, wins, and match history. Cannot be undone.</div>
        {!confirmReset
          ? <button className="s-danger-btn" onClick={() => setConfirmReset(true)}>Reset my stats</button>
          : <div style={{ display: "flex", gap: 8 }}>
              <button className="s-danger-btn" onClick={resetStats}>Confirm reset</button>
              <button className="s-btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
        }
      </div>

      <div className="s-danger-box">
        <div style={{ fontSize: 14, fontWeight: 600, color: DS.plat, marginBottom: 4 }}>Delete account</div>
        <div style={{ fontSize: 13, color: DS.ash, marginBottom: 12 }}>Permanently deletes your account and all data. Type DELETE to confirm.</div>
        {!confirmDelete
          ? <button className="s-danger-btn" onClick={() => setConfirmDelete(true)}>Delete my account</button>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="s-input" placeholder="Type DELETE" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="s-danger-btn" onClick={deleteAccount} disabled={deleteInput !== "DELETE"}>Delete account</button>
                <button className="s-btn-ghost" onClick={() => { setConfirmDelete(false); setDeleteInput(""); }}>Cancel</button>
              </div>
            </div>
        }
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN EXPORT
   Props: onNavigate, user (safeUser), onUserUpdate
══════════════════════════════════════ */
export default function Settings({ onNavigate, user, onUserUpdate }) {
  const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";

  const [section,  setSection]  = useState("account");
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState("");
  const [toastErr, setToastErr] = useState(false);

  // Theme — reads saved value, calls window.applyTheme() to change globally
  const [theme, setTheme] = useState(() => localStorage.getItem("sp_theme") || "dark");
  function handleThemeChange(val) {
    setTheme(val);
    if (window.applyTheme) window.applyTheme(val);
  }

  const [account, setAccount] = useState({
    name:     user?.name     || "",
    username: user?.username || "",
    bio:      user?.bio      || "",
    email:    user?.email    || "",
  });
  const [privacy, setPrivacy] = useState({
    showOnLeaderboard: user?.privacy?.showOnLeaderboard ?? true,
    allowCrowdWatch:   user?.privacy?.allowCrowdWatch   ?? true,
    showCountry:       user?.privacy?.showCountry       ?? true,
  });
  const [notifications, setNotifications] = useState({
    matchFound:   user?.notifications?.matchFound   ?? true,
    newFollower:  user?.notifications?.newFollower  ?? true,
    gameResult:   user?.notifications?.gameResult   ?? true,
    weeklyDigest: user?.notifications?.weeklyDigest ?? false,
  });

  function showToast(msg, err = false) {
    setToast(msg); setToastErr(err);
    setTimeout(() => setToast(""), 2800);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = localStorage.getItem("sp_token");
      const res = await fetch(`${API}/api/user/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account, privacy, notifications }),
      });
      const d = await res.json();
      if (!res.ok) showToast(d.error || "Save failed", true);
      else { onUserUpdate?.(d.user); showToast("Saved"); }
    } catch { showToast("Can't reach server", true); }
    setSaving(false);
  }

  const NAV = [
    { id: "account",       icon: "👤", label: "Account"       },
    { id: "password",      icon: "🔒", label: "Password"      },
    { id: "appearance",    icon: "🎨", label: "Appearance"    },
    { id: "privacy",       icon: "🛡️", label: "Privacy"       },
    { id: "notifications", icon: "🔔", label: "Notifications" },
    { id: "danger",        icon: "⚠️", label: "Danger Zone"   },
  ];

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100dvh", background: DS.void, paddingTop: 56, paddingBottom: 80 }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 clamp(12px,4vw,28px)" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <button className="s-btn-ghost" style={{ padding: "7px 13px", fontSize: 13 }} onClick={() => onNavigate?.("home")}>← Back</button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: DS.plat }}>Settings</h1>
          </div>

          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

            {/* Sidebar — desktop */}
            <nav className="hide-mob" style={{
              width: 190, flexShrink: 0,
              background: DS.surface, border: `1px solid ${DS.rim}`,
              borderRadius: 12, padding: 8,
              position: "sticky", top: 70,
            }}>
              {NAV.map(n => (
                <button key={n.id} className={`s-nav-item ${section === n.id ? "active" : ""}`} onClick={() => setSection(n.id)}>
                  <span>{n.icon}</span> {n.label}
                </button>
              ))}
            </nav>

            {/* Horizontal pill nav — mobile */}
            <div className="show-mob" style={{ marginBottom: 14, overflowX: "auto", paddingBottom: 4, width: "100%" }}>
              <div style={{ display: "flex", gap: 6, width: "max-content" }}>
                {NAV.map(n => (
                  <button key={n.id} onClick={() => setSection(n.id)} style={{
                    padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                    background: section === n.id ? "var(--sp-signal)" : "var(--sp-surface2)",
                    color: section === n.id ? "#fff" : DS.ash,
                    fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
                  }}>{n.icon} {n.label}</button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              background: DS.surface, border: `1px solid ${DS.rim}`,
              borderRadius: 12, padding: "22px clamp(14px,4vw,26px)",
            }}>
              {section === "account"       && <AccountSection       data={account}       onChange={(k,v) => setAccount(p => ({ ...p, [k]: v }))}       onSave={handleSave} saving={saving} />}
              {section === "password"      && <PasswordSection      API={API} />}
              {section === "appearance"    && <AppearanceSection    theme={theme}        onThemeChange={handleThemeChange} />}
              {section === "privacy"       && <PrivacySection       data={privacy}       onChange={(k,v) => setPrivacy(p => ({ ...p, [k]: v }))}       onSave={handleSave} saving={saving} />}
              {section === "notifications" && <NotificationsSection data={notifications} onChange={(k,v) => setNotifications(p => ({ ...p, [k]: v }))} onSave={handleSave} saving={saving} />}
              {section === "danger"        && <DangerSection        API={API} onNavigate={onNavigate} />}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          background: toastErr ? "var(--sp-live)" : "var(--sp-ice)", color: "#fff",
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}>{toast}</div>
      )}
    </>
  );
}