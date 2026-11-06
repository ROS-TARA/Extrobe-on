/*
  Profile.jsx — the "Player Card".

  Your profile is your game identity, not a feed of posts: a card in a colour you choose,
  your photo inside a RANK RING that fills as you earn points, your real stats, a rank
  journey, achievements unlocked from your real numbers, and your recent matches.

  Everything you change (photo, name, bio, country, flag, vibe tags, favourite game,
  card colour, social handles) is saved on the server, so it is the same on every device
  and after refresh.

  Env (frontend):  VITE_API_URL=https://your-backend.onrender.com

  Props:
    username      string    whose card to show (your own, or a player you searched for)
    me            object    the signed-in user (from app state), or null for guests
    token         string    the sign-in token, or null for guests
    games         array     [{ emoji, title }]  used for "favourite game"
    onUserUpdate  fn(user)  called after a save — put the new user into app state
    onPlay        fn        "Find a stranger"
    onLogin       fn        guests are sent to sign in
    onLogout      fn?       shows a Log out button on your own card
    onSettings    fn?       shows a Settings button on your own card
    onMessage     fn(username)?  "Message" button on other players' cards
*/
import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";
const imgSrc = (a) => (!a ? "" : /^https?:\/\//.test(a) ? a : API + a);

/* ── the same rank rules as the server (calculateRank) ── */
export const RANKS = [
  { name: "Bronze I", min: 0 }, { name: "Bronze II", min: 20 }, { name: "Bronze III", min: 50 },
  { name: "Silver I", min: 100 }, { name: "Silver II", min: 500 }, { name: "Gold", min: 1000 }, { name: "Diamond", min: 5000 },
];
export function rankInfo(points = 0) {
  let i = 0;
  RANKS.forEach((r, k) => { if (points >= r.min) i = k; });
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  const frac = next ? Math.min(1, (points - cur.min) / (next.min - cur.min)) : 1;
  return { i, cur, next, frac, toNext: next ? next.min - points : 0 };
}

/* ── card colours (the server accepts exactly these keys) ── */
export const THEMES = {
  ocean:    { label: "Ocean",    bg: "linear-gradient(135deg,#1877f2,#0d55c7)" },
  sky:      { label: "Sky",      bg: "linear-gradient(135deg,#2b8fe0,#1766b5)" },
  violet:   { label: "Violet",   bg: "linear-gradient(135deg,#7457ec,#4a35c4)" },
  mint:     { label: "Mint",     bg: "linear-gradient(135deg,#10a077,#0a735a)" },
  sunset:   { label: "Sunset",   bg: "linear-gradient(135deg,#d9531f,#b32d4a)" },
  rose:     { label: "Rose",     bg: "linear-gradient(135deg,#d9467f,#a82a63)" },
  graphite: { label: "Graphite", bg: "linear-gradient(135deg,#3a3b3c,#17181a)" },
};
const TAG_SUGGESTIONS = ["Music", "Gaming", "Travel", "Movies", "Anime", "Sports", "Memes", "Foodie", "Art", "Tech", "Fitness", "Books"];
const FLAGS = ["🌍", "🇳🇵", "🇮🇳", "🇧🇹", "🇧🇩", "🇵🇰", "🇱🇰", "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇯🇵", "🇰🇷", "🇨🇳", "🇩🇪", "🇫🇷", "🇧🇷", "🇲🇽", "🇦🇪", "🇸🇦"];
const SOCIALS = [
  { key: "instagram", label: "Instagram", url: (h) => `https://instagram.com/${h}` },
  { key: "tiktok", label: "TikTok", url: (h) => `https://tiktok.com/@${h}` },
  { key: "youtube", label: "YouTube", url: (h) => `https://youtube.com/@${h}` },
  { key: "twitter", label: "X", url: (h) => `https://x.com/${h}` },
];
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/* ── achievements: unlocked from the player's REAL numbers ── */
const ACHIEVEMENTS = [
  { id: "first", icon: "🎮", title: "First game", hint: "Play 1 game", test: (p) => p.gamesPlayed >= 1 },
  { id: "win", icon: "🏆", title: "First win", hint: "Win 1 game", test: (p) => p.wins >= 1 },
  { id: "regular", icon: "🔁", title: "Regular", hint: "Play 10 games", test: (p) => p.gamesPlayed >= 10 },
  { id: "champ", icon: "👑", title: "Champion", hint: "Win 10 games", test: (p) => p.wins >= 10 },
  { id: "rising", icon: "⭐", title: "Rising", hint: "Reach 50 points", test: (p) => p.points >= 50 },
  { id: "cent", icon: "💯", title: "Centurion", hint: "Reach 100 points", test: (p) => p.points >= 100 },
  { id: "gold", icon: "🥇", title: "Gold club", hint: "Reach 1,000 points", test: (p) => p.points >= 1000 },
];

async function api(path, { method = "GET", token, body } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

/* ── photo: pick → crop to a centred square (with zoom) → small JPEG ── */
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
    if (file.size > 15 * 1024 * 1024) return reject(new Error("That photo is too large. Pick one under 15 MB."));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Couldn't read that file."));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Couldn't open that image. Try a JPG or PNG."));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function drawSquare(img, canvas, size, zoom) {
  canvas.width = size; canvas.height = size;
  const side = Math.min(img.width, img.height) / zoom;
  const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
}
function squareJpeg(img, zoom) {
  const c = document.createElement("canvas");
  for (const [size, q] of [[320, 0.82], [320, 0.7], [256, 0.7], [224, 0.6]]) {   // shrink until it fits the 60 KB server limit
    drawSquare(img, c, size, zoom);
    const url = c.toDataURL("image/jpeg", q);
    if ((url.length - url.indexOf(",") - 1) * 0.75 <= 58 * 1024) return url;
  }
  throw new Error("That photo is still too large after shrinking. Try another one.");
}

/* ── small pieces ── */
function Avatar({ user, size }) {
  const [bad, setBad] = useState(false);
  const src = imgSrc(user && user.avatar);
  useEffect(() => setBad(false), [src]);
  if (src && !bad) return <img className="tpf-ph" src={src} alt="" width={size} height={size} onError={() => setBad(true)} referrerPolicy="no-referrer" />;
  const letter = ((user && (user.name || user.username)) || "?").trim().charAt(0).toUpperCase();
  return <span className="tpf-ph tpf-ini" style={{ fontSize: size * 0.42 }}>{letter}</span>;
}

function RankRing({ user }) {
  const { frac, cur } = rankInfo(user.points || 0);
  const R = 74, C = 2 * Math.PI * R;
  return (
    <div className="tpf-ring" role="img" aria-label={`${cur.name}, ${Math.round(frac * 100)}% of the way to the next rank`}>
      <svg viewBox="0 0 164 164" width="164" height="164" aria-hidden="true">
        <circle cx="82" cy="82" r={R} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
        <circle cx="82" cy="82" r={R} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 82 82)" />
      </svg>
      <div className="tpf-ring-in"><Avatar user={user} size={136} /></div>
      <span className="tpf-rankpill">{cur.name}</span>
    </div>
  );
}

const Ic = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

/* ═══════════════════════════════ page ═══════════════════════════════ */
export default function Profile({ username, me, token, games = [], onUserUpdate, onPlay, onLogin, onLogout, onSettings, onMessage }) {
  const isMe = !!(me && username && me.username === String(username).toLowerCase());
  const [other, setOther] = useState(null);
  const [status, setStatus] = useState(isMe ? "ok" : "loading");
  const [matches, setMatches] = useState(null);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const toastT = useRef(null);
  const say = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2400); };
  useEffect(() => () => clearTimeout(toastT.current), []);

  const p = isMe ? me : other;

  // someone else's card (public data — no email, no coins)
  useEffect(() => {
    if (isMe || !username) return;
    let dead = false;
    setStatus("loading"); setOther(null);
    api(`/api/user/${encodeURIComponent(username)}`)
      .then((u) => { if (!dead) { setOther(u); setStatus("ok"); } })
      .catch((e) => { if (!dead) setStatus(/not found/i.test(e.message) ? "missing" : "error"); });
    return () => { dead = true; };
  }, [username, isMe]);

  // my recent matches (the server only lists them for signed-in users)
  useEffect(() => {
    if (!p || !token || !p._id) return;
    let dead = false;
    api(`/api/matches/${p._id}`, { token }).then((m) => { if (!dead) setMatches(Array.isArray(m) ? m : []); }).catch(() => { if (!dead) setMatches([]); });
    return () => { dead = true; };
  }, [p && p._id, token]);

  const share = async () => {
    const url = `${window.location.origin}/?u=${encodeURIComponent(p.username)}`;
    try { if (navigator.share) { await navigator.share({ title: `${p.name} on Tranzle`, text: "Play a game with me on Tranzle", url }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); say("Link copied — paste it anywhere"); } catch { say(url); }
  };

  if (!username && !isMe) {
    return (
      <div className="tpf"><style>{CSS}</style>
        <div className="tpf-msg"><h2>Your Player Card</h2><p>Sign in to see your card, change your photo and save your profile.</p>
          <button className="tpf-btn tpf-solid" onClick={onLogin}>Sign in</button></div>
      </div>
    );
  }
  if (status === "loading") return <div className="tpf"><style>{CSS}</style><div className="tpf-msg"><p>Loading card…</p></div></div>;
  if (status === "missing") return <div className="tpf"><style>{CSS}</style><div className="tpf-msg"><h2>Player not found</h2><p>Check the username and try again.</p></div></div>;
  if (status === "error" || !p) return <div className="tpf"><style>{CSS}</style><div className="tpf-msg"><h2>Couldn’t load this card</h2><p>The server may be waking up. Try again in a few seconds.</p></div></div>;

  const info = rankInfo(p.points || 0);
  const winRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) + "%" : "—";
  const theme = THEMES[p.theme] || THEMES.ocean;
  const fav = p.favGame ? games.find((g) => g.title === p.favGame) : null;
  const links = SOCIALS.filter((s) => p.socialLinks && HANDLE.test(p.socialLinks[s.key] || ""));
  const stats = [["Games", p.gamesPlayed || 0], ["Wins", p.wins || 0], ["Win rate", winRate], ["Points", (p.points || 0).toLocaleString()]];

  return (
    <div className="tpf">
      <style>{CSS}</style>

      {/* ── the card ── */}
      <section className="tpf-card" style={{ background: theme.bg }}>
        <RankRing user={p} />
        <h1 className="tpf-name">{p.name || p.username}</h1>
        <p className="tpf-handle">@{p.username}<span> · </span>{p.flag || "🌍"} {p.country || "Earth"}</p>
        {p.bio ? <p className="tpf-bio">{p.bio}</p> : isMe ? <p className="tpf-bio tpf-dim">Add a short bio so people know who you are.</p> : null}
        {p.tags && p.tags.length > 0 && <div className="tpf-tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>}
        <div className="tpf-actions">
          {isMe ? (
            <>
              <button className="tpf-btn tpf-white" onClick={() => setEditing(true)}><Ic><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Ic>Edit profile</button>
              <button className="tpf-btn tpf-glass" onClick={share}><Ic><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Ic>Share card</button>
            </>
          ) : (
            <>
              {me && onMessage && <button className="tpf-btn tpf-white" onClick={() => onMessage(p.username)}><Ic><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></Ic>Message</button>}
              <button className={`tpf-btn ${me && onMessage ? "tpf-glass" : "tpf-white"}`} onClick={me ? onPlay : onLogin}>{me ? "Find a stranger" : "Sign in to play"}</button>
              <button className="tpf-btn tpf-glass" onClick={share}>Share</button>
            </>
          )}
        </div>
      </section>

      {/* ── stats ── */}
      <section className="tpf-stats" aria-label="Stats">
        {stats.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
      </section>

      {/* ── rank journey ── */}
      <section className="tpf-sec">
        <h2>Rank journey</h2>
        <div className="tpf-steps" aria-hidden="true">
          {RANKS.map((r, k) => (
            <div key={r.name} className={`tpf-step ${k < info.i ? "done" : ""} ${k === info.i ? "now" : ""}`}>
              <i />{k < RANKS.length - 1 && <u />}
            </div>
          ))}
        </div>
        <div className="tpf-steplabels"><span>{RANKS[0].name}</span><span>{RANKS[RANKS.length - 1].name}</span></div>
        <p className="tpf-note">
          {info.next ? <><b>{info.toNext.toLocaleString()} pts</b> to reach <b>{info.next.name}</b> — you’re {info.cur.name}.</> : <>Top rank reached. <b>Diamond</b>.</>}
        </p>
      </section>

      {/* ── favourite game + links ── */}
      {(p.favGame || links.length > 0 || isMe) && (
        <section className="tpf-sec">
          <h2>Favourite game & links</h2>
          <div className="tpf-chips">
            {p.favGame ? <span className="tpf-chip"><em>{fav ? fav.emoji : "🎮"}</em>{p.favGame}</span> : isMe ? <button className="tpf-chip tpf-add" onClick={() => setEditing(true)}>+ Pick a favourite game</button> : null}
            {links.map((s) => (
              <a key={s.key} className="tpf-chip" href={s.url(p.socialLinks[s.key])} target="_blank" rel="noopener noreferrer nofollow">{s.label}<small>@{p.socialLinks[s.key]}</small></a>
            ))}
            {isMe && links.length === 0 && <button className="tpf-chip tpf-add" onClick={() => setEditing(true)}>+ Add your socials</button>}
          </div>
        </section>
      )}

      {/* ── achievements ── */}
      <section className="tpf-sec">
        <h2>Achievements <small>{ACHIEVEMENTS.filter((a) => a.test(p)).length} / {ACHIEVEMENTS.length}</small></h2>
        <div className="tpf-ach">
          {ACHIEVEMENTS.map((a) => {
            const on = a.test(p);
            return <div key={a.id} className={`tpf-a ${on ? "on" : ""}`} title={a.hint}><em>{a.icon}</em><b>{a.title}</b><span>{on ? "Unlocked" : a.hint}</span></div>;
          })}
        </div>
      </section>

      {/* ── recent matches ── */}
      {token && (
        <section className="tpf-sec">
          <h2>Recent matches</h2>
          {matches === null ? <p className="tpf-note">Loading…</p> : matches.length === 0 ? (
            <div className="tpf-empty"><p>No matches yet.</p>{isMe && <button className="tpf-btn tpf-solid" onClick={onPlay}>Find a stranger</button>}</div>
          ) : (
            <ul className="tpf-matches">
              {matches.slice(0, 10).map((m) => {
                const mine = String(p._id);
                const opp = m.player1 && String(m.player1._id) === mine ? m.player2 : m.player1;
                const res = !m.winner ? "Draw" : String(m.winner._id) === mine ? "Won" : "Lost";
                return (
                  <li key={m._id}>
                    <span className={`tpf-res ${res.toLowerCase()}`}>{res}</span>
                    <span className="tpf-opp">{opp ? <>{opp.flag || "🌍"} {opp.username}</> : "Stranger"}</span>
                    <span className="tpf-meta">{m.gameMode || "Video call"} · {m.createdAt ? new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {isMe && (onSettings || onLogout) && (
        <section className="tpf-foot">
          {onSettings && <button className="tpf-btn tpf-ghost" onClick={onSettings}>Settings</button>}
          {onLogout && <button className="tpf-btn tpf-ghost tpf-danger" onClick={onLogout}>Log out</button>}
        </section>
      )}

      {toast && <div className="tpf-toast" role="status">{toast}</div>}
      {editing && isMe && (
        <EditSheet me={me} token={token} games={games}
          onClose={() => setEditing(false)}
          onSaved={(u, msg) => { onUserUpdate && onUserUpdate(u); if (msg) say(msg); }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════ edit sheet ═══════════════════════════════ */
function EditSheet({ me, token, games, onClose, onSaved }) {
  const start = () => ({
    name: me.name || "", bio: me.bio || "", country: me.country || "", flag: me.flag || "🌍",
    tags: me.tags || [], favGame: me.favGame || "", theme: me.theme || "ocean",
    socialLinks: { instagram: "", tiktok: "", youtube: "", twitter: "", ...(me.socialLinks || {}) },
  });
  const [v, setV] = useState(start);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tagText, setTagText] = useState("");
  const [photo, setPhoto] = useState(null);           // { img, zoom } while cropping
  const [photoBusy, setPhotoBusy] = useState(false);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const firstRef = useRef(null);
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(start());

  useEffect(() => { firstRef.current && firstRef.current.focus(); }, []);
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  useEffect(() => { if (photo && canvasRef.current) drawSquare(photo.img, canvasRef.current, 220, photo.zoom); }, [photo]);

  async function pickFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try { setPhoto({ img: await readImage(file), zoom: 1 }); } catch (x) { setErr(x.message); }
  }
  async function usePhoto() {
    setPhotoBusy(true); setErr("");
    try {
      const image = squareJpeg(photo.img, photo.zoom);
      const u = await api("/api/user/avatar", { method: "POST", token, body: { image } });
      setPhoto(null); onSaved(u, "Photo saved");
    } catch (x) { setErr(x.message); } finally { setPhotoBusy(false); }
  }
  async function removePhoto() {
    setPhotoBusy(true); setErr("");
    try { onSaved(await api("/api/user/avatar", { method: "DELETE", token }), "Photo removed"); } catch (x) { setErr(x.message); } finally { setPhotoBusy(false); }
  }
  const toggleTag = (t) => set("tags", v.tags.includes(t) ? v.tags.filter((x) => x !== t) : v.tags.length >= 5 ? v.tags : [...v.tags, t]);
  const addTag = () => {
    const t = tagText.replace(/[^\p{L}\p{N} &'’-]/gu, "").trim().slice(0, 16);
    if (t && !v.tags.some((x) => x.toLowerCase() === t.toLowerCase()) && v.tags.length < 5) set("tags", [...v.tags, t]);
    setTagText("");
  };
  async function save() {
    setErr(""); setBusy(true);
    try {
      const social = {}; SOCIALS.forEach((s) => { social[s.key] = (v.socialLinks[s.key] || "").trim().replace(/^@/, ""); });
      const u = await api("/api/user/profile", { method: "PATCH", token, body: { name: v.name, bio: v.bio, country: v.country, flag: v.flag, tags: v.tags, favGame: v.favGame, theme: v.theme, socialLinks: social } });
      onSaved(u, "Profile saved"); onClose();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="tpf-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tpf-sheet" role="dialog" aria-modal="true" aria-label="Edit profile">
        <div className="tpf-sh-head"><b>Edit profile</b><button className="tpf-x" onClick={onClose} aria-label="Close">×</button></div>

        {/* photo */}
        <div className="tpf-fld">
          <label>Photo</label>
          {photo ? (
            <div className="tpf-crop">
              <canvas ref={canvasRef} width="220" height="220" />
              <div className="tpf-zoom"><span>Zoom</span><input type="range" min="1" max="3" step="0.05" value={photo.zoom} onChange={(e) => setPhoto({ ...photo, zoom: Number(e.target.value) })} aria-label="Zoom" /></div>
              <div className="tpf-row">
                <button className="tpf-btn tpf-solid" onClick={usePhoto} disabled={photoBusy}>{photoBusy ? "Saving…" : "Use this photo"}</button>
                <button className="tpf-btn tpf-ghost" onClick={() => setPhoto(null)} disabled={photoBusy}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="tpf-photorow">
              <div className="tpf-thumb"><Avatar user={me} size={72} /></div>
              <div className="tpf-row">
                <button className="tpf-btn tpf-solid" onClick={() => fileRef.current && fileRef.current.click()} disabled={photoBusy}>Change photo</button>
                {me.avatar && <button className="tpf-btn tpf-ghost" onClick={removePhoto} disabled={photoBusy}>Remove</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} data-testid="photo-input" />
            </div>
          )}
        </div>

        <div className="tpf-fld"><label htmlFor="pf-name">Name</label>
          <input id="pf-name" ref={firstRef} value={v.name} maxLength={30} onChange={(e) => set("name", e.target.value)} /></div>

        <div className="tpf-fld"><label htmlFor="pf-bio">Bio <small>{v.bio.length}/140</small></label>
          <textarea id="pf-bio" rows={3} value={v.bio} maxLength={140} placeholder="A line about you" onChange={(e) => set("bio", e.target.value)} /></div>

        <div className="tpf-fld"><label htmlFor="pf-country">Country</label>
          <input id="pf-country" value={v.country} maxLength={40} placeholder="e.g. Nepal" onChange={(e) => set("country", e.target.value)} />
          <div className="tpf-flags" role="group" aria-label="Flag">
            {FLAGS.map((f) => <button key={f} type="button" className={v.flag === f ? "on" : ""} onClick={() => set("flag", f)} aria-label={`Flag ${f}`} aria-pressed={v.flag === f}>{f}</button>)}
          </div></div>

        <div className="tpf-fld"><label>Vibe <small>pick up to 5</small></label>
          <div className="tpf-pick">
            {[...TAG_SUGGESTIONS, ...v.tags.filter((t) => !TAG_SUGGESTIONS.includes(t))].map((t) => (
              <button key={t} type="button" className={v.tags.includes(t) ? "on" : ""} onClick={() => toggleTag(t)} aria-pressed={v.tags.includes(t)}>{t}</button>
            ))}
          </div>
          <div className="tpf-row"><input value={tagText} maxLength={16} placeholder="Your own tag" onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} />
            <button type="button" className="tpf-btn tpf-ghost" onClick={addTag}>Add</button></div></div>

        <div className="tpf-fld"><label>Favourite game</label>
          <div className="tpf-pick">
            <button type="button" className={!v.favGame ? "on" : ""} onClick={() => set("favGame", "")}>None</button>
            {games.map((g) => <button key={g.title} type="button" className={v.favGame === g.title ? "on" : ""} onClick={() => set("favGame", g.title)}>{g.emoji} {g.title}</button>)}
          </div></div>

        <div className="tpf-fld"><label>Card colour</label>
          <div className="tpf-swatches" role="group" aria-label="Card colour">
            {Object.entries(THEMES).map(([k, t]) => <button key={k} type="button" className={v.theme === k ? "on" : ""} style={{ background: t.bg }} onClick={() => set("theme", k)} aria-label={t.label} aria-pressed={v.theme === k} title={t.label} />)}
          </div></div>

        <div className="tpf-fld"><label>Social handles <small>just your username</small></label>
          {SOCIALS.map((s) => (
            <div className="tpf-soc" key={s.key}><span>{s.label}</span>
              <input value={v.socialLinks[s.key] || ""} maxLength={31} placeholder="username" autoCapitalize="none" autoCorrect="off"
                onChange={(e) => set("socialLinks", { ...v.socialLinks, [s.key]: e.target.value })} /></div>
          ))}</div>

        {err && <p className="tpf-err" role="alert">{err}</p>}
        <div className="tpf-save">
          <button className="tpf-btn tpf-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="tpf-btn tpf-solid" onClick={save} disabled={busy || !dirty || !v.name.trim()}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ styles — theme variables only, no motion ═══════════════════════════════ */
const CSS = `
.tpf{max-width:760px;margin:0 auto;color:var(--sp-plat);font-family:'Inter',system-ui,sans-serif}
.tpf *{box-sizing:border-box}
.tpf button{font:inherit;cursor:pointer}
.tpf-msg{padding:56px 20px;text-align:center;color:var(--sp-ash)}
.tpf-msg h2{margin:0 0 8px;color:var(--sp-plat);font-family:'Space Grotesk',sans-serif;font-size:24px}
.tpf-msg p{margin:0 0 18px}

.tpf-card{position:relative;display:flex;flex-direction:column;align-items:center;padding:34px 22px 24px;border-radius:20px;color:#fff;text-align:center;overflow:hidden}
.tpf-card::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 0,rgba(255,255,255,.18),transparent 60%);pointer-events:none}
.tpf-card>*{position:relative;z-index:1}
.tpf-ring{position:relative;width:164px;height:164px;margin-bottom:12px}
.tpf-ring svg{position:absolute;inset:0}
.tpf-ring-in{position:absolute;inset:14px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.2);box-shadow:0 0 0 4px rgba(255,255,255,.18)}
.tpf-ph{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}
.tpf-ini{display:grid;place-items:center;background:rgba(255,255,255,.22);color:#fff;font-weight:700;font-family:'Space Grotesk',sans-serif}
.tpf-rankpill{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);padding:5px 14px;border-radius:999px;background:#fff;color:#111;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.tpf-name{margin:12px 0 2px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;letter-spacing:-.6px;line-height:1.1;overflow-wrap:anywhere}
.tpf-handle{margin:0;font-size:14px;color:rgba(255,255,255,.85)}
.tpf-handle span{opacity:.6}
.tpf-bio{max-width:46ch;margin:12px 0 0;font-size:15px;line-height:1.5;color:rgba(255,255,255,.95);overflow-wrap:anywhere}
.tpf-dim{color:rgba(255,255,255,.7)}
.tpf-tags{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:14px}
.tpf-tags span{padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.18);font-size:13px;font-weight:600}
.tpf-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:20px}

.tpf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border:0;border-radius:8px;font-size:14px;font-weight:600;transition:background .15s,opacity .15s}
.tpf-btn:disabled{opacity:.55;cursor:not-allowed}
.tpf .tpf-white{background:#fff;color:#111}.tpf .tpf-white:hover{background:#f0f2f5}
.tpf .tpf-glass{background:rgba(255,255,255,.2);color:#fff}.tpf .tpf-glass:hover{background:rgba(255,255,255,.3)}
.tpf .tpf-solid,.tpf-sheet .tpf-solid{background:var(--sp-signal);color:#fff}.tpf .tpf-solid:hover:not(:disabled),.tpf-sheet .tpf-solid:hover:not(:disabled){background:color-mix(in srgb,var(--sp-signal) 88%,#000)}
.tpf .tpf-ghost,.tpf-sheet .tpf-ghost{background:var(--sp-surface2);color:var(--sp-plat);border:1px solid var(--sp-rim)}.tpf .tpf-ghost:hover:not(:disabled),.tpf-sheet .tpf-ghost:hover:not(:disabled){background:var(--sp-rim)}
.tpf .tpf-danger{color:var(--sp-live)}

.tpf-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
.tpf-stats div{display:flex;flex-direction:column;gap:2px;padding:14px 10px;border:1px solid var(--sp-rim);border-radius:14px;background:var(--sp-surface);text-align:center}
.tpf-stats b{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
.tpf-stats span{color:var(--sp-ash);font-size:12px}

.tpf-sec{margin-top:12px;padding:18px;border:1px solid var(--sp-rim);border-radius:16px;background:var(--sp-surface)}
.tpf-sec h2{display:flex;align-items:baseline;gap:10px;margin:0 0 14px;font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:700}
.tpf-sec h2 small{color:var(--sp-ash);font-family:'Inter',sans-serif;font-size:12px;font-weight:500}
.tpf-note{margin:10px 0 0;color:var(--sp-ash);font-size:14px}.tpf-note b{color:var(--sp-plat)}

.tpf-steps{display:flex;align-items:center}
.tpf-step{display:flex;align-items:center;flex:1}.tpf-step:last-child{flex:none}
.tpf-step i{display:block;flex:none;width:14px;height:14px;border-radius:50%;background:var(--sp-rim)}
.tpf-step u{display:block;flex:1;height:4px;margin:0 3px;border-radius:2px;background:var(--sp-rim)}
.tpf-step.done i,.tpf-step.done u{background:var(--sp-signal)}
.tpf-step.now i{width:20px;height:20px;background:var(--sp-surface);border:5px solid var(--sp-signal)}
.tpf-steplabels{display:flex;justify-content:space-between;margin-top:8px;color:var(--sp-ghost);font-size:11px;font-weight:600}

.tpf-chips{display:flex;flex-wrap:wrap;gap:10px}
.tpf-chip{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-surface2);color:var(--sp-plat);font-size:14px;font-weight:600;text-decoration:none}
.tpf-chip em{font-style:normal;font-size:17px}.tpf-chip small{color:var(--sp-ash);font-weight:500}
a.tpf-chip:hover{border-color:var(--sp-signal)}
.tpf-add{border-style:dashed;color:var(--sp-ash)}.tpf-add:hover{color:var(--sp-signal);border-color:var(--sp-signal)}

.tpf-ach{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.tpf-a{display:flex;flex-direction:column;gap:2px;padding:14px;border:1px solid var(--sp-rim);border-radius:14px;background:var(--sp-surface2);opacity:.55;filter:grayscale(1)}
.tpf-a.on{opacity:1;filter:none;background:color-mix(in srgb,var(--sp-signal) 8%,var(--sp-surface));border-color:color-mix(in srgb,var(--sp-signal) 40%,var(--sp-rim))}
.tpf-a em{font-style:normal;font-size:24px;margin-bottom:4px}
.tpf-a b{font-size:14px}.tpf-a span{color:var(--sp-ash);font-size:12px}

.tpf-matches{margin:0;padding:0;list-style:none}
.tpf-matches li{display:grid;grid-template-columns:56px 1fr auto;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--sp-rim);font-size:14px}
.tpf-matches li:first-child{border-top:0}
.tpf-res{padding:3px 0;border-radius:6px;text-align:center;font-size:12px;font-weight:700}
.tpf-res.won{background:color-mix(in srgb,var(--sp-ice) 16%,transparent);color:var(--sp-ice)}
.tpf-res.lost{background:color-mix(in srgb,var(--sp-live) 14%,transparent);color:var(--sp-live)}
.tpf-res.draw{background:var(--sp-surface2);color:var(--sp-ash)}
.tpf-opp{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tpf-meta{color:var(--sp-ash);font-size:12px;white-space:nowrap}
.tpf-empty{text-align:center;padding:10px 0;color:var(--sp-ash)}.tpf-empty p{margin:0 0 12px}
.tpf-foot{display:flex;gap:10px;margin-top:12px}.tpf-foot .tpf-btn{flex:1}
.tpf-toast{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:90;padding:11px 18px;border-radius:999px;background:#242526;color:#fff;font-size:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.3)}

/* edit sheet */
.tpf-back{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
.tpf-sheet{width:100%;max-width:560px;max-height:92dvh;overflow:auto;padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px));border:1px solid var(--sp-rim);border-bottom:0;border-radius:22px 22px 0 0;background:var(--sp-surface);color:var(--sp-plat)}
.tpf-sh-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.tpf-sh-head b{font-family:'Space Grotesk',sans-serif;font-size:19px}
.tpf-x{width:34px;height:34px;border:0;border-radius:50%;background:var(--sp-surface2);color:var(--sp-ash);font-size:22px;line-height:1}
.tpf-fld{margin-top:16px}
.tpf-fld>label{display:flex;justify-content:space-between;margin-bottom:7px;color:var(--sp-ash);font-size:13px;font-weight:600}
.tpf-fld label small{font-weight:500;color:var(--sp-ghost)}
.tpf-sheet input:not([type=range]):not([type=file]),.tpf-sheet textarea{width:100%;padding:11px 13px;border:1px solid var(--sp-rim);border-radius:10px;background:var(--sp-void);color:var(--sp-plat);font:inherit;font-size:16px}
.tpf-sheet textarea{resize:none}
.tpf-sheet input:focus,.tpf-sheet textarea:focus{outline:2px solid var(--sp-signal);outline-offset:0;border-color:transparent}
.tpf-row{display:flex;gap:10px;align-items:center;margin-top:8px}.tpf-row input{flex:1}
.tpf-photorow{display:flex;align-items:center;gap:14px}.tpf-photorow .tpf-row{margin:0}
.tpf-thumb{width:72px;height:72px;border-radius:50%;overflow:hidden;flex:none}
.tpf-crop{display:flex;flex-direction:column;align-items:center;gap:10px}
.tpf-crop canvas{width:220px;height:220px;border-radius:50%;background:var(--sp-void);border:1px solid var(--sp-rim)}
.tpf-zoom{display:flex;align-items:center;gap:10px;width:100%;max-width:280px;color:var(--sp-ash);font-size:13px}.tpf-zoom input{flex:1}
.tpf-flags,.tpf-pick{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.tpf-flags button{width:42px;height:38px;border:1px solid var(--sp-rim);border-radius:10px;background:var(--sp-void);font-size:20px}
.tpf-pick button{padding:7px 13px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-void);color:var(--sp-plat);font-size:13px;font-weight:600}
.tpf-flags button.on,.tpf-pick button.on{border-color:var(--sp-signal);background:color-mix(in srgb,var(--sp-signal) 14%,var(--sp-surface));color:var(--sp-signal)}
.tpf-swatches{display:flex;flex-wrap:wrap;gap:10px}
.tpf-swatches button{width:40px;height:40px;border:3px solid var(--sp-surface);border-radius:50%;box-shadow:0 0 0 1px var(--sp-rim)}
.tpf-swatches button.on{box-shadow:0 0 0 3px var(--sp-signal)}
.tpf-soc{display:grid;grid-template-columns:84px 1fr;align-items:center;gap:10px;margin-top:8px}.tpf-soc span{color:var(--sp-ash);font-size:13px}
.tpf-err{margin:14px 0 0;color:var(--sp-live);font-size:14px}
.tpf-save{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;position:sticky;bottom:calc(-18px - env(safe-area-inset-bottom,0px));padding:12px 0 0;background:var(--sp-surface)}
.tpf button:focus-visible,.tpf-sheet button:focus-visible,.tpf a:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}

@media (min-width:700px){.tpf-back{align-items:center}.tpf-sheet{border-radius:22px;border-bottom:1px solid var(--sp-rim)}}
@media (max-width:480px){.tpf-card{padding:28px 16px 20px}.tpf-name{font-size:26px}.tpf-stats b{font-size:19px}.tpf-matches li{grid-template-columns:52px 1fr}.tpf-meta{grid-column:2}}
`;
