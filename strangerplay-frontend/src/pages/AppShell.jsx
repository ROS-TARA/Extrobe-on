/*
  AppShell.jsx — the app frame: sidebar + top bar on PC, top bar + bottom tabs on phones.

  Props:
    user          logged-in user object, or null (guest)
    page          current page key: "home" | "match" | "rewards" | "ranking" | "profile"
    onNavigate    fn(key)        user tapped a menu item
    onSearch      fn(username)   user searched for a player
    onLogin       fn()           open your login popup (guests / protected pages)
    onLogout      fn()
    online        number?        live "people online" count
    show          string[]?      which menu items to show (default: all five)
    bare          boolean?       true = hide the frame (use during a live video call)
*/
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Splash";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const imgSrc = (a) => (!a ? "" : /^https?:\/\//.test(a) ? a : API + a);

const Ic = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const HomeI = () => <Ic><path d="M3 11 12 3l9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></Ic>;
const VideoI = () => <Ic><rect x="2.5" y="6" width="13" height="12" rx="3" /><path d="m15.5 10.5 6-3v9l-6-3" /></Ic>;
const StarI = () => <Ic><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></Ic>;
const TrophyI = () => <Ic><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" /><path d="M12 14v4M8.5 20h7" /></Ic>;
const UserI = () => <Ic><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Ic>;
const SearchI = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>;

const NAV = [
  { key: "home", label: "Home", short: "Home", Icon: HomeI },
  { key: "match", label: "Random match", short: "Match", Icon: VideoI, auth: true },
  { key: "rewards", label: "Rewards", short: "Rewards", Icon: StarI, auth: true },
  { key: "ranking", label: "Ranking", short: "Ranking", Icon: TrophyI },
  { key: "profile", label: "Profile", short: "Profile", Icon: UserI, auth: true },
];

function Avatar({ user, size = 32 }) {
  const [bad, setBad] = useState(false);
  const src = imgSrc(user && user.avatar);
  useEffect(() => setBad(false), [src]);
  const st = { width: size, height: size, borderRadius: "50%", flex: "none" };
  if (src && !bad) return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} style={{ ...st, objectFit: "cover", background: "#241d13" }} />;
  const letter = ((user && (user.username || user.name)) || "?").charAt(0).toUpperCase();
  return <span style={{ ...st, display: "grid", placeItems: "center", background: "#c97b3d", color: "#1a1209", fontWeight: 700, fontSize: size * 0.45 }}>{letter}</span>;
}

export default function AppShell({ user, page, onNavigate, onSearch, onLogin, onLogout, online, show, bare, children }) {
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const off = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [menu]);

  if (bare) return <>{children}</>;

  const items = NAV.filter((n) => !show || show.includes(n.key));
  const go = (n) => {
    if (n.auth && !user) return onLogin && onLogin();
    onNavigate && onNavigate(n.key);
  };
  const search = (e) => {
    e.preventDefault();
    const name = q.trim().replace(/^@/, "");
    if (name && onSearch) { onSearch(name); setQ(""); }
  };

  return (
    <div className="tzs">
      <style>{CSS}</style>

      <aside className="tzs-side">
        <button className="tzs-brand" onClick={() => onNavigate && onNavigate("home")} aria-label="Tranzle home"><Logo size={30} /></button>
        <nav aria-label="Main" className="tzs-nav">
          {items.map((n) => (
            <button key={n.key} className={`tzs-item ${page === n.key ? "on" : ""}`} onClick={() => go(n)} aria-current={page === n.key ? "page" : undefined}>
              <n.Icon /><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="tzs-meet">
          <b>Meet people from around the world</b>
          {typeof online === "number" && online > 0 && <span><i className="tzs-dot" />{online.toLocaleString()} online now</span>}
        </div>
      </aside>

      <div className="tzs-main">
        <header className="tzs-top">
          <span className="tzs-top-logo"><Logo size={28} word={false} /></span>
          <form className="tzs-search" onSubmit={search} role="search">
            <SearchI />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a player by username" aria-label="Find a player by username" maxLength={20} autoCapitalize="none" autoCorrect="off" />
          </form>

          <div className="tzs-right" ref={menuRef}>
            {user ? (
              <>
                <span className="tzs-coins" title="Your coins"><i />{user.coins != null ? user.coins : 0}</span>
                <button className="tzs-user" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}>
                  <Avatar user={user} />
                  <span className="tzs-uname"><b>{user.name || user.username}</b><small><i className="tzs-dot" />Online</small></span>
                  <svg className="tzs-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {menu && (
                  <div className="tzs-menu" role="menu">
                    <button role="menuitem" onClick={() => { setMenu(false); onNavigate && onNavigate("profile"); }}>View profile</button>
                    {onLogout && <button role="menuitem" onClick={() => { setMenu(false); onLogout(); }}>Log out</button>}
                  </div>
                )}
              </>
            ) : (
              <button className="tzs-login" onClick={onLogin}>Log in</button>
            )}
          </div>
        </header>

        <main className="tzs-content">{children}</main>
      </div>

      <nav className="tzs-tabs" aria-label="Main">
        {items.map((n) => (
          <button key={n.key} className={page === n.key ? "on" : ""} onClick={() => go(n)} aria-current={page === n.key ? "page" : undefined}>
            <n.Icon /><span>{n.short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const CSS = `
.tzs{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100dvh;background:#0d0b08;color:#f4ede1;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.tzs *{box-sizing:border-box}
.tzs button{font:inherit;color:inherit}
.tzs-side{position:sticky;top:0;height:100dvh;display:flex;flex-direction:column;padding:22px 14px 18px;background:#120f0a;border-right:1px solid #2a2218}
.tzs-brand{align-self:flex-start;margin:0 0 26px 8px;padding:0;border:0;background:none;cursor:pointer}
.tzs-nav{display:flex;flex-direction:column;gap:4px}
.tzs-item{display:flex;align-items:center;gap:14px;width:100%;padding:12px 14px;border:0;border-radius:12px;background:none;color:#bfae92;font-size:15px;text-align:left;cursor:pointer}
.tzs-item:hover{background:#1c1610;color:#f4ede1}
.tzs-item.on{background:#2a1f12;color:#f4ede1;font-weight:600}
.tzs-item.on svg{color:#c97b3d}
.tzs-meet{display:flex;flex-direction:column;gap:6px;margin-top:auto;padding:14px;border:1px solid #2a2218;border-radius:14px;background:#17130d;font-size:13px;line-height:1.35;color:#bfae92}
.tzs-meet b{color:#f4ede1;font-weight:600}
.tzs-meet span{display:flex;align-items:center;gap:8px}
.tzs-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#58c27d;box-shadow:0 0 0 3px rgba(88,194,125,.18)}
.tzs-main{min-width:0;display:flex;flex-direction:column}
.tzs-top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:14px 28px;background:rgba(13,11,8,.88);backdrop-filter:blur(10px);border-bottom:1px solid #2a2218}
.tzs-top-logo{display:none}
.tzs-search{flex:1;max-width:520px;display:flex;align-items:center;gap:10px;padding:0 14px;height:42px;border:1px solid #2f261a;border-radius:999px;background:#17130d;color:#a39379}
.tzs-search:focus-within{border-color:#c97b3d}
.tzs-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;color:#f4ede1;font-size:15px}
.tzs-search input::placeholder{color:#7c6e58}
.tzs-right{position:relative;margin-left:auto;display:flex;align-items:center;gap:12px}
.tzs-coins{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid #2f261a;border-radius:999px;background:#17130d;font-size:14px;font-weight:600}
.tzs-coins i{width:14px;height:14px;border-radius:50%;background:#c97b3d;box-shadow:inset 0 0 0 3px #e0a066}
.tzs-user{display:flex;align-items:center;gap:10px;padding:4px 8px 4px 4px;border:0;border-radius:999px;background:none;cursor:pointer}
.tzs-user:hover{background:#1c1610}
.tzs-uname{display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;max-width:150px}
.tzs-uname b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.tzs-uname small{display:flex;align-items:center;gap:6px;color:#a39379;font-size:12px}
.tzs-chev{color:#a39379}
.tzs-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:170px;padding:6px;border:1px solid #3a2f21;border-radius:12px;background:#17130d;box-shadow:0 16px 40px rgba(0,0,0,.5)}
.tzs-menu button{display:block;width:100%;padding:10px 12px;border:0;border-radius:8px;background:none;text-align:left;font-size:14px;cursor:pointer}
.tzs-menu button:hover{background:#241d13}
.tzs-login{padding:10px 20px;border:0;border-radius:999px;background:#c97b3d;color:#1a1209;font-size:14px;font-weight:600;cursor:pointer}
.tzs-login:hover{background:#d98a3f}
.tzs-content{flex:1;min-width:0;padding:28px}
.tzs-tabs{display:none}
.tzs button:focus-visible,.tzs input:focus-visible{outline:2px solid #c97b3d;outline-offset:2px}

@media (max-width:860px){
  .tzs{grid-template-columns:minmax(0,1fr)}
  .tzs-side{display:none}
  .tzs-top{padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));gap:10px}
  .tzs-top-logo{display:inline-flex}
  .tzs-uname,.tzs-chev,.tzs-coins{display:none}
  .tzs-search{height:40px}
  .tzs-content{padding:18px 14px calc(88px + env(safe-area-inset-bottom,0px))}
  .tzs-tabs{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(18,15,10,.96);backdrop-filter:blur(12px);border-top:1px solid #2a2218}
  .tzs-tabs button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px;border:0;border-radius:12px;background:none;color:#a39379;font-size:11px;cursor:pointer}
  .tzs-tabs button.on{color:#f4ede1}
  .tzs-tabs button.on svg{color:#c97b3d}
}
`;
