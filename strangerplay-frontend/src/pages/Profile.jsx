/*
  Profile.jsx — simple Instagram-style profile.

  Everything you change here is saved to the account on the server (photo, name, username,
  bio, Instagram / TikTok / Facebook links), so it is the same on every device and after refresh.

  Env (frontend .env):  VITE_API_URL=https://your-backend.onrender.com

  Props:
    username      string   whose profile to show
    me            object   the logged-in user (from your app state), or null for guests
    token         string   the sp_token, or null for guests
    onUserUpdate  fn(user) called after a save — put the new user into your app state
    onPlay        fn?      "Find a stranger" button on an empty match list
    onLogout      fn?      shows a Log out link on your own profile
*/
import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const imgSrc = (a) => (!a ? "" : /^https?:\/\//.test(a) ? a : API + a);

async function api(path, { method = "GET", token, body } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

// Crop to a centred square and shrink to 320px JPEG (~30 KB) before uploading.
async function toSquareJpeg(file, size = 320) {
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is too large. Pick one under 15 MB.");
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try { bmp = await createImageBitmap(file); }
    catch { throw new Error("Couldn't read that photo. Try a JPG or PNG."); }
  }
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.85);
}

/* ── icons ── */
const Svg = ({ children }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IgIcon = () => <Svg><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></Svg>;
const TtIcon = () => <Svg><path d="M14 3v11.2a3.7 3.7 0 1 1-3.7-3.7" /><path d="M14 3c.4 2.4 2 4 4.5 4.2" /></Svg>;
const FbIcon = () => <Svg><path d="M14 8.5h2.5V5H14a3.5 3.5 0 0 0-3.5 3.5V11H8v3.5h2.5V21H14v-6.5h2.5l.5-3.5H14V8.5z" /></Svg>;

const PLATFORMS = [
  { key: "instagram", label: "Instagram", Icon: IgIcon },
  { key: "tiktok", label: "TikTok", Icon: TtIcon },
  { key: "facebook", label: "Facebook", Icon: FbIcon },
];

// Show "sam.k" in the edit box instead of the long saved link
function handleOf(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.search) return url; // e.g. facebook profile.php?id=… keep the full link
    const seg = u.pathname.split("/").filter(Boolean)[0] || "";
    return seg.replace(/^@/, "") || url;
  } catch { return url; }
}

function Avatar({ user, className }) {
  const [bad, setBad] = useState(false);
  const src = imgSrc(user && user.avatar);
  useEffect(() => setBad(false), [src]);
  if (src && !bad) {
    return <img className={className} src={src} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />;
  }
  const letter = ((user && (user.username || user.name)) || "?").charAt(0).toUpperCase();
  return <div className={`${className} tz-pf-ph`} aria-hidden="true">{letter}</div>;
}

export default function Profile({ username, me, token, onUserUpdate, onPlay, onLogout }) {
  const [p, setP] = useState(null);
  const [status, setStatus] = useState("loading");
  const [matches, setMatches] = useState(null);
  const [editing, setEditing] = useState(false);

  // If the parent forgets to pass `username`, show the logged-in user's own profile.
  const name = typeof username === "string" && username ? username : me && me.username;

  useEffect(() => {
    if (!name) { setStatus("missing"); return; }
    let dead = false;
    setStatus("loading");
    api(`/api/user/${encodeURIComponent(name)}`, { token })
      .then((u) => { if (!dead) { setP(u); setStatus("ok"); } })
      .catch(() => { if (!dead) setStatus("missing"); });
    return () => { dead = true; };
  }, [name, token]);

  const pid = p && p._id;
  useEffect(() => {
    if (!pid || !token) return;
    let dead = false;
    api(`/api/matches/${pid}`, { token })
      .then((m) => { if (!dead) setMatches(m); })
      .catch(() => { if (!dead) setMatches([]); });
    return () => { dead = true; };
  }, [pid, token]);

  if (status === "loading") return <div className="tz-pf"><style>{CSS}</style><p className="tz-pf-muted">Loading profile…</p></div>;
  if (status === "missing" || !p) return <div className="tz-pf"><style>{CSS}</style><p className="tz-pf-muted">We couldn’t find that profile.</p></div>;

  const isMe = !!(me && String(me._id) === String(p._id));
  const links = PLATFORMS.filter((x) => p.socialLinks && /^https:\/\//.test(p.socialLinks[x.key] || ""));

  function saved(u) {
    setP(u);
    if (onUserUpdate) onUserUpdate(u);
  }

  return (
    <div className="tz-pf">
      <style>{CSS}</style>

      <header className="tz-pf-top">
        <Avatar user={p} className="tz-pf-av" />
        <div className="tz-pf-info">
          <div className="tz-pf-row">
            <h1 className="tz-pf-user">{p.username}</h1>
            {isMe && <button className="tz-pf-btn" onClick={() => setEditing(true)}>Edit profile</button>}
          </div>

          <div className="tz-pf-stats">
            <span><b>{p.gamesPlayed || 0}</b> games</span>
            <span><b>{p.wins || 0}</b> wins</span>
            <span><b>{p.points || 0}</b> points</span>
          </div>

          <div className="tz-pf-name">{p.name}{p.rank ? <span className="tz-pf-rank">{p.rank}</span> : null}</div>
          {p.country && <div className="tz-pf-muted">{p.flag ? `${p.flag} ` : ""}{p.country}</div>}
          {p.bio && <p className="tz-pf-bio">{p.bio}</p>}

          {links.length > 0 && (
            <div className="tz-pf-links">
              {links.map(({ key, label, Icon }) => (
                <a key={key} className="tz-pf-ico" href={p.socialLinks[key]} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${p.username} on ${label}`} title={label}>
                  <Icon />
                </a>
              ))}
            </div>
          )}

          {isMe && links.length === 0 && !p.bio && (
            <button className="tz-pf-hint" onClick={() => setEditing(true)}>Add a bio and your Instagram, TikTok or Facebook.</button>
          )}
        </div>
      </header>

      <section className="tz-pf-sec">
        <h2 className="tz-pf-h2">Recent matches</h2>
        {matches === null && token && <p className="tz-pf-muted">Loading…</p>}
        {!token && <p className="tz-pf-muted">Log in to see match history.</p>}
        {matches && matches.length === 0 && (
          <div className="tz-pf-empty">
            <p>No matches yet.</p>
            {isMe && onPlay && <button className="tz-pf-btn" onClick={onPlay}>Find a stranger</button>}
          </div>
        )}
        {matches && matches.length > 0 && (
          <ul className="tz-pf-list">
            {matches.slice(0, 8).map((m) => {
              const mine = String((m.player1 && m.player1._id) || "") === String(p._id);
              const opp = mine ? m.player2 : m.player1;
              const won = m.winner && String(m.winner._id) === String(p._id);
              return (
                <li key={m._id}>
                  <span className={won ? "tz-pf-w" : "tz-pf-l"}>{won ? "Won" : "Lost"}</span>
                  <span>vs {opp ? opp.username : "a player"}</span>
                  <span className="tz-pf-muted">{m.gameMode || "game"} · {new Date(m.createdAt).toLocaleDateString()}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isMe && onLogout && <button className="tz-pf-out" onClick={onLogout}>Log out</button>}

      {editing && <EditProfile p={p} token={token} onClose={() => setEditing(false)} onSaved={saved} />}
    </div>
  );
}

function EditProfile({ p, token, onClose, onSaved }) {
  const start = useRef({
    name: p.name || "",
    uname: p.username || "",
    bio: p.bio || "",
    instagram: handleOf(p.socialLinks && p.socialLinks.instagram),
    tiktok: handleOf(p.socialLinks && p.socialLinks.tiktok),
    facebook: handleOf(p.socialLinks && p.socialLinks.facebook),
  }).current;

  const [v, setV] = useState(start);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const dirty = JSON.stringify(v) !== JSON.stringify(start);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setPhotoBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Pick an image file.");
      const image = await toSquareJpeg(file);
      onSaved(await api("/api/user/avatar", { method: "POST", token, body: { image } }));
    } catch (e2) {
      setErr(e2.message || "Couldn’t use that photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setErr("");
    setPhotoBusy(true);
    try {
      onSaved(await api("/api/user/avatar", { method: "DELETE", token }));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    setErr("");
    setBusy(true);
    try {
      const u = await api("/api/user/settings", {
        method: "PATCH",
        token,
        body: {
          name: v.name,
          username: v.uname,
          bio: v.bio,
          socialLinks: { instagram: v.instagram, tiktok: v.tiktok, facebook: v.facebook },
        },
      });
      onSaved(u);
      onClose();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tz-pf-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tz-pf-card" role="dialog" aria-modal="true" aria-labelledby="tz-pf-et">
        <div className="tz-pf-bar">
          <button className="tz-pf-text" onClick={onClose}>Cancel</button>
          <h2 id="tz-pf-et">Edit profile</h2>
          <button className="tz-pf-text tz-pf-save" onClick={save} disabled={!dirty || busy}>{busy ? "Saving…" : "Save"}</button>
        </div>

        <div className="tz-pf-photo">
          <Avatar user={p} className="tz-pf-av tz-pf-av-sm" />
          <div>
            <div className="tz-pf-name">{p.username}</div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            <button className="tz-pf-link" onClick={() => fileRef.current && fileRef.current.click()} disabled={photoBusy}>
              {photoBusy ? "Working…" : "Change photo"}
            </button>
            {p.avatar && !photoBusy && <button className="tz-pf-link tz-pf-danger" onClick={removePhoto}>Remove</button>}
          </div>
        </div>

        <label className="tz-pf-lab">Name
          <input className="tz-pf-in" value={v.name} onChange={set("name")} maxLength={40} />
        </label>
        <label className="tz-pf-lab">Username
          <input className="tz-pf-in" value={v.uname} onChange={set("uname")} maxLength={20} autoCapitalize="none" autoCorrect="off" />
        </label>
        <label className="tz-pf-lab">Bio
          <textarea className="tz-pf-in" rows={3} value={v.bio} onChange={set("bio")} maxLength={150} />
          <span className="tz-pf-count">{v.bio.length}/150</span>
        </label>

        {PLATFORMS.map(({ key, label, Icon }) => (
          <label className="tz-pf-lab" key={key}>
            <span className="tz-pf-plat"><Icon /> {label}</span>
            <input className="tz-pf-in" value={v[key]} onChange={set(key)} placeholder="username or link" maxLength={200} autoCapitalize="none" autoCorrect="off" />
          </label>
        ))}

        {err && <p className="tz-pf-err" role="alert">{err}</p>}
      </div>
    </div>
  );
}

const CSS = `
.tz-pf{max-width:720px;margin:0 auto;padding:28px 16px 64px;color:#f4ede1;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.tz-pf *{box-sizing:border-box}
.tz-pf-muted{color:#a39379;font-size:14px;margin:4px 0}
.tz-pf-top{display:grid;grid-template-columns:auto 1fr;gap:20px 28px;align-items:start}
.tz-pf-av{width:92px;height:92px;border-radius:50%;object-fit:cover;background:#241d13;border:1px solid #3a2f21}
.tz-pf-ph{display:grid;place-items:center;font-size:38px;font-weight:600;color:#1a1209;background:#c97b3d;border:0}
@media (min-width:640px){.tz-pf-av{width:150px;height:150px}.tz-pf-ph{font-size:60px}}
.tz-pf-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px}
.tz-pf-user{margin:0;font-size:21px;font-weight:500}
.tz-pf-btn{padding:8px 16px;border:1px solid #3a2f21;border-radius:8px;background:#241d13;color:#f4ede1;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.tz-pf-btn:hover{background:#2f261a}
.tz-pf-stats{display:flex;flex-wrap:wrap;gap:6px 26px;margin:14px 0;font-size:15px}
.tz-pf-stats b{font-weight:600}
.tz-pf-name{font-weight:600;font-size:15px}
.tz-pf-rank{margin-left:8px;padding:2px 8px;border:1px solid #3a2f21;border-radius:999px;color:#c9a47a;font-size:12px;font-weight:500}
.tz-pf-bio{margin:6px 0 0;font-size:15px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.tz-pf-links{display:flex;gap:10px;margin-top:14px}
.tz-pf-ico{display:grid;place-items:center;width:38px;height:38px;border:1px solid #3a2f21;border-radius:50%;color:#f4ede1;text-decoration:none}
.tz-pf-ico:hover{background:#241d13;border-color:#c97b3d}
.tz-pf-hint{margin-top:12px;padding:0;border:0;background:none;color:#c97b3d;font:inherit;font-size:14px;cursor:pointer;text-align:left}
.tz-pf-sec{margin-top:34px;padding-top:18px;border-top:1px solid #3a2f21}
.tz-pf-h2{margin:0 0 12px;font-size:16px;font-weight:600}
.tz-pf-empty{padding:26px 0;text-align:center;color:#a39379}
.tz-pf-empty p{margin:0 0 12px}
.tz-pf-list{margin:0;padding:0;list-style:none}
.tz-pf-list li{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid #2a2218;font-size:14px}
.tz-pf-w{color:#6fd391;font-weight:600}.tz-pf-l{color:#ff9a86;font-weight:600}
.tz-pf-out{margin:34px auto 0;display:block;border:0;background:none;color:#a39379;font:inherit;font-size:14px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.tz-pf button:focus-visible,.tz-pf a:focus-visible,.tz-pf-card button:focus-visible{outline:2px solid #c97b3d;outline-offset:2px}

.tz-pf-back{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:12px;background:rgba(8,6,4,.74);backdrop-filter:blur(6px)}
.tz-pf-card{width:100%;max-width:440px;max-height:calc(100dvh - 24px);overflow:auto;padding:0 20px 22px;background:#17130d;color:#f4ede1;border:1px solid #3a2f21;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.55);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.tz-pf-bar{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;margin:0 -20px 14px;padding:14px 20px;background:#17130d;border-bottom:1px solid #3a2f21}
.tz-pf-bar h2{margin:0;font-size:16px;font-weight:600}
.tz-pf-text{padding:4px;border:0;background:none;color:#a39379;font:inherit;font-size:15px;cursor:pointer}
.tz-pf-save{color:#c97b3d;font-weight:600}
.tz-pf-text:disabled{opacity:.4;cursor:not-allowed}
.tz-pf-photo{display:flex;align-items:center;gap:16px;margin-bottom:18px}
.tz-pf-av-sm{width:64px;height:64px;font-size:26px}
.tz-pf-link{display:inline-block;margin:4px 14px 0 0;padding:0;border:0;background:none;color:#c97b3d;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.tz-pf-link:disabled{opacity:.5}
.tz-pf-danger{color:#ff9a86}
.tz-pf-lab{position:relative;display:block;margin-bottom:14px;color:#bfae92;font-size:13px}
.tz-pf-plat{display:inline-flex;align-items:center;gap:6px}
.tz-pf-plat svg{width:16px;height:16px}
.tz-pf-in{display:block;width:100%;margin-top:6px;padding:11px 13px;background:#100d09;color:#f4ede1;border:1px solid #3a2f21;border-radius:10px;font:inherit;font-size:16px;resize:vertical}
.tz-pf-in::placeholder{color:#7c6e58}
.tz-pf-in:focus{outline:2px solid #c97b3d;outline-offset:1px;border-color:transparent}
.tz-pf-count{position:absolute;right:2px;top:0;color:#7c6e58;font-size:12px}
.tz-pf-err{margin:6px 0 0;color:#ff9a86;font-size:14px;line-height:1.4}
`;