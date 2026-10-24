/*
  AppShell.jsx — the app frame: sidebar + top bar on PC, top bar + bottom tabs on phones.
  Styled entirely with the app's own theme variables (--sp-*), so the dark / light
  toggle keeps working and nothing here hard-codes a colour.

  Props:
    user            logged-in user object, or null (guest)
    page            current page key: "home" | "match" | "live" | "messages" | "rewards" | "ranking" | "profile"
    onNavigate      fn(key)       user tapped a menu item
    onSearch        fn(username)  user searched for a player
    onLogin         fn()          guest tapped "Sign in" / a protected page
    onLogout        fn()
    online          number?       live "people online" count (real, from the server)
    points          number?       user's points
    onBuyCoins      fn()?         opens the coin purchase flow
    theme           "dark" | "light"
    onToggleTheme   fn()
    bare            boolean?      true = hide the frame (live call, game, login)

  Same features on every screen size:
    PC     sidebar (all pages) + top bar (search, points, coins, theme, account menu)
    Phone  Instagram-style bottom tabs: Home, Match, Live, Messages and Profile (your avatar,
           bottom-right). A menu button (top-right) opens a sheet with everything else:
           Rewards, Ranking, Settings, theme, log out, coins, online count.
*/
import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";
const imgSrc = (a) => (!a ? "" : /^https?:\/\//.test(a) ? a : API + a);

const Ic = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const HomeI = () => <Ic><path d="M3 11 12 3l9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></Ic>;
const VideoI = () => <Ic><rect x="2.5" y="6" width="13" height="12" rx="3" /><path d="m15.5 10.5 6-3v9l-6-3" /></Ic>;
const LiveI = () => <Ic><circle cx="12" cy="12" r="2.2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></Ic>;
const ChatI = () => <Ic><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></Ic>;
const StarI = () => <Ic><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></Ic>;
const TrophyI = () => <Ic><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" /><path d="M12 14v4M8.5 20h7" /></Ic>;
const UserI = () => <Ic><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Ic>;
const SearchI = () => <Ic size={18}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></Ic>;
const SunI = () => <Ic size={18}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Ic>;
const MoonI = () => <Ic size={18}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Ic>;
const MenuI = () => <Ic><path d="M4 7h16M4 12h16M4 17h16" /></Ic>;
const SettingsI = () => <Ic><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Ic>;
const LogoutI = () => <Ic><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></Ic>;
const GlobeI = () => <Ic size={22}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Ic>;

// tab: shown in the phone's bottom bar (Profile is last = bottom-right, like Instagram).
// Everything else is in the menu sheet (top-right button).  auth: guests are sent to sign in.
const NAV = [
  { key: "home", label: "Home", Icon: HomeI, tab: true },
  { key: "match", label: "Random match", Icon: VideoI, tab: true },
  { key: "live", label: "Live", Icon: LiveI, tab: true },
  { key: "messages", label: "Messages", Icon: ChatI, tab: true },
  { key: "rewards", label: "Rewards", Icon: StarI },
  { key: "ranking", label: "Ranking", Icon: TrophyI },
  { key: "profile", label: "Profile", Icon: UserI, tab: true, auth: true },
];

function Logo({ size = 28, word = true }) {
  return (
    <span className="tzs-logo">
      <img src="/logo.svg" alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
      {word && <span className="tzs-logo-word">Tranzle</span>}
    </span>
  );
}

function Avatar({ user, size = 34 }) {
  const [bad, setBad] = useState(false);
  const src = imgSrc(user && user.avatar);
  useEffect(() => setBad(false), [src]);
  const st = { width: size, height: size, borderRadius: "50%", flex: "none" };
  if (src && !bad) return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} style={{ ...st, objectFit: "cover", background: "var(--sp-surface2)" }} />;
  const letter = ((user && (user.username || user.name)) || "?").charAt(0).toUpperCase();
  return <span className="tzs-avatar" style={{ ...st, fontSize: size * 0.42 }}>{letter}</span>;
}

export default function AppShell({
  user, page, onNavigate, onSearch, onLogin, onLogout, online, points,
  onBuyCoins, theme, onToggleTheme, bare, children,
}) {
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const off = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [menu]);

  useEffect(() => {
    if (!more) return;
    const esc = (e) => e.key === "Escape" && setMore(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [more]);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);
  // navigating anywhere closes the sheet and the phone search row
  useEffect(() => { setMore(false); setSearchOpen(false); setMenu(false); }, [page]);

  if (bare) return <>{children}</>;

  const go = (n) => {
    setMore(false);
    if (n.auth && !user) return onLogin && onLogin();
    onNavigate && onNavigate(n.key);
  };
  const search = (e) => {
    e.preventDefault();
    const name = q.trim().replace(/^@/, "");
    if (name && onSearch) { onSearch(name); setQ(""); setSearchOpen(false); }
  };
  const tabs = NAV.filter((n) => n.tab);
  const moreItems = NAV.filter((n) => !n.tab);
  const shownPoints = typeof points === "number" ? points : (user && user.points) || 0;
  const coins = user && user.coins != null ? user.coins : 0;

  return (
    <div className="tzs">
      <style>{CSS}</style>

      <aside className="tzs-side">
        <button className="tzs-brand" onClick={() => onNavigate && onNavigate("home")} aria-label="Tranzle home"><Logo size={30} /></button>
        <nav aria-label="Main" className="tzs-nav">
          {NAV.map((n) => (
            <button key={n.key} className={`tzs-item ${page === n.key ? "on" : ""}`} onClick={() => go(n)} aria-current={page === n.key ? "page" : undefined}>
              <n.Icon /><span>{n.label}</span>
              {n.key === "messages" && <em className="tzs-soon">Soon</em>}
            </button>
          ))}
        </nav>
        <div className="tzs-meet">
          <span className="tzs-meet-ic"><GlobeI /></span>
          <div>
            <b>Meet people from around the world</b>
            {typeof online === "number" && online > 0 && <span className="tzs-online"><i className="tzs-dot" />{online.toLocaleString()} online now</span>}
          </div>
        </div>
      </aside>

      <div className="tzs-main">
        <header className="tzs-top">
          <span className="tzs-top-logo"><Logo size={28} word={false} /></span>
          <form className={`tzs-search ${searchOpen ? "open" : ""}`} onSubmit={search} role="search">
            <SearchI />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a player by username" aria-label="Find a player by username" maxLength={20} autoCapitalize="none" autoCorrect="off" />
          </form>

          <div className="tzs-right" ref={menuRef}>
            <button className="tzs-icon tzs-searchbtn" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search players" aria-expanded={searchOpen}><SearchI /></button>
            {user && <button className="tzs-pts" onClick={() => onNavigate && onNavigate("rewards")} title="Your points — tap for rewards" aria-label={`${shownPoints} points. Open rewards`}>{shownPoints.toLocaleString()} pts</button>}
            {user && (
              <button className="tzs-coins" onClick={onBuyCoins} title="Buy more coins" aria-label={`Coins: ${coins}. Buy more`}>
                <i />{coins}
              </button>
            )}
            <button className="tzs-icon tzs-theme" onClick={onToggleTheme} aria-label="Toggle dark / light mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <SunI /> : <MoonI />}
            </button>
            {user ? (
              <>
                <button className="tzs-user" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu">
                  <Avatar user={user} />
                  <span className="tzs-uname"><b>{user.name || user.username}</b><small><i className="tzs-dot" />Online</small></span>
                  <svg className="tzs-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {menu && (
                  <div className="tzs-menu" role="menu">
                    <button role="menuitem" onClick={() => { setMenu(false); onNavigate && onNavigate("profile"); }}>View profile</button>
                    <button role="menuitem" onClick={() => { setMenu(false); onNavigate && onNavigate("settings"); }}>Settings</button>
                    {onLogout && <button role="menuitem" className="tzs-danger" onClick={() => { setMenu(false); onLogout(); }}>Log out</button>}
                  </div>
                )}
              </>
            ) : (
              <button className="tzs-login" onClick={onLogin}>Sign in</button>
            )}
            <button className="tzs-icon tzs-menubtn" onClick={() => setMore(!more)} aria-label="Menu" aria-haspopup="dialog" aria-expanded={more}><MenuI /></button>
          </div>
        </header>

        <main className="tzs-content">{children}</main>
      </div>

      <nav className="tzs-tabs" aria-label="Main">
        {tabs.map((n) => (
          <button key={n.key} className={page === n.key ? "on" : ""} onClick={() => go(n)} aria-label={n.label} title={n.label} aria-current={page === n.key ? "page" : undefined}>
            {n.key === "profile" && user ? <Avatar user={user} size={28} /> : <n.Icon />}
          </button>
        ))}
      </nav>

      {more && (
        <div className="tzs-back" onPointerDown={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="tzs-sheet" role="dialog" aria-modal="true" aria-label="More">
            <span className="tzs-grab" aria-hidden="true" />
            {user ? (
              <div className="tzs-sheet-head">
                <Avatar user={user} size={44} />
                <span><b>{user.name || user.username}</b><small><i className="tzs-dot" />Online</small></span>
              </div>
            ) : (
              <button className="tzs-login tzs-wide" onClick={() => { setMore(false); onLogin && onLogin(); }}>Sign in</button>
            )}
            {user && (
              <div className="tzs-sheet-stats">
                <span className="tzs-pts tzs-pts-static">{shownPoints.toLocaleString()} pts</span>
                <button className="tzs-coins" onClick={() => { setMore(false); onBuyCoins && onBuyCoins(); }}><i />{coins} · Buy coins</button>
              </div>
            )}
            <div className="tzs-sheet-list">
              {moreItems.map((n) => (
                <button key={n.key} className={page === n.key ? "on" : ""} onClick={() => go(n)}>
                  <n.Icon /><span>{n.label}</span>
                  {n.key === "messages" && <em className="tzs-soon">Soon</em>}
                </button>
              ))}
              {user && (
                <button className={page === "settings" ? "on" : ""} onClick={() => { setMore(false); onNavigate && onNavigate("settings"); }}>
                  <SettingsI /><span>Settings</span>
                </button>
              )}
              <button onClick={onToggleTheme}>
                {theme === "dark" ? <SunI /> : <MoonI />}<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
              {user && onLogout && (
                <button className="tzs-danger" onClick={() => { setMore(false); onLogout(); }}><LogoutI /><span>Log out</span></button>
              )}
            </div>
            {typeof online === "number" && online > 0 && <p className="tzs-sheet-online"><i className="tzs-dot" />{online.toLocaleString()} online now</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.tzs{position:relative;z-index:1;display:grid;grid-template-columns:256px minmax(0,1fr);min-height:100dvh;color:var(--sp-plat);font-family:'Inter',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.tzs *{box-sizing:border-box}
.tzs button{font:inherit;color:inherit}

.tzs-logo{display:inline-flex;align-items:center;gap:10px}
.tzs-logo-word{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:21px;letter-spacing:.2px;color:var(--sp-plat)}

/* sidebar */
.tzs-side{position:sticky;top:0;height:100dvh;display:flex;flex-direction:column;padding:22px 14px 18px;background:var(--sp-surface);border-right:1px solid var(--sp-rim)}
.tzs-brand{align-self:flex-start;margin:0 0 26px 10px;padding:0;border:0;background:none;cursor:pointer}
.tzs-nav{display:flex;flex-direction:column;gap:4px}
.tzs-item{position:relative;display:flex;align-items:center;gap:14px;width:100%;padding:12px 14px;border:0;border-radius:12px;background:none;color:var(--sp-ash);font-size:15px;font-weight:500;text-align:left;cursor:pointer;transition:background .18s,color .18s,transform .18s}
.tzs-item:hover{background:var(--sp-surface2);color:var(--sp-plat)}
.tzs-item.on{color:#fff;font-weight:600;background:linear-gradient(135deg,var(--sp-signal),color-mix(in srgb,var(--sp-signal) 62%,#7db4ff));box-shadow:0 8px 22px color-mix(in srgb,var(--sp-signal) 34%,transparent),inset 0 1px 0 rgba(255,255,255,.18)}
.tzs-soon{margin-left:auto;padding:2px 8px;border-radius:999px;background:var(--sp-surface2);color:var(--sp-ash);font-size:10px;font-style:normal;font-weight:600;letter-spacing:.4px;text-transform:uppercase}
.tzs-item.on .tzs-soon{background:rgba(255,255,255,.22);color:#fff}
.tzs-meet{display:flex;align-items:center;gap:12px;margin-top:auto;padding:14px;border:1px solid var(--sp-rim);border-radius:16px;background:linear-gradient(160deg,color-mix(in srgb,var(--sp-signal) 12%,var(--sp-surface)),var(--sp-surface));font-size:13px;line-height:1.35;color:var(--sp-ash)}
.tzs-meet-ic{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:12px;background:color-mix(in srgb,var(--sp-signal) 16%,transparent);color:var(--sp-signal)}
.tzs-meet b{display:block;color:var(--sp-plat);font-weight:600}
.tzs-online{display:flex;align-items:center;gap:7px;margin-top:5px}
.tzs-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--sp-ice);box-shadow:0 0 0 3px color-mix(in srgb,var(--sp-ice) 22%,transparent)}

/* top bar */
.tzs-main{min-width:0;display:flex;flex-direction:column}
.tzs-top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:12px 28px;background:color-mix(in srgb,var(--sp-void) 80%,transparent);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);border-bottom:1px solid var(--sp-rim)}
.tzs-top-logo{display:none}
.tzs-search{flex:1;max-width:520px;display:flex;align-items:center;gap:10px;padding:0 16px;height:42px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-surface);color:var(--sp-ghost);transition:border-color .18s,box-shadow .18s}
.tzs-search:focus-within{border-color:var(--sp-signal);box-shadow:0 0 0 4px color-mix(in srgb,var(--sp-signal) 18%,transparent)}
.tzs-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;color:var(--sp-plat);font-size:15px}
.tzs-search input::placeholder{color:var(--sp-ghost)}
.tzs-right{position:relative;margin-left:auto;display:flex;align-items:center;gap:10px}
.tzs button.tzs-pts{color:var(--sp-gold);cursor:pointer;transition:border-color .18s,background .18s}
.tzs button.tzs-pts:hover{border-color:var(--sp-gold);background:color-mix(in srgb,var(--sp-gold) 16%,transparent)}
.tzs-pts{padding:7px 12px;border:1px solid color-mix(in srgb,var(--sp-gold) 32%,transparent);border-radius:999px;background:color-mix(in srgb,var(--sp-gold) 10%,transparent);color:var(--sp-gold);font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600}
.tzs-coins{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-surface);font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:border-color .18s}
.tzs-coins:hover{border-color:var(--sp-signal)}
.tzs-coins i{width:14px;height:14px;border-radius:50%;background:var(--sp-gold);box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--sp-gold) 55%,#fff)}
.tzs-icon{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--sp-rim);border-radius:12px;background:var(--sp-surface);color:var(--sp-ash);cursor:pointer;transition:color .18s,border-color .18s}
.tzs-icon:hover{color:var(--sp-plat);border-color:var(--sp-signal)}
.tzs-user{display:flex;align-items:center;gap:10px;padding:4px 8px 4px 4px;border:0;border-radius:999px;background:none;cursor:pointer;transition:background .18s}
.tzs-user:hover{background:var(--sp-surface2)}
.tzs-avatar{display:grid;place-items:center;background:linear-gradient(135deg,var(--sp-signal),color-mix(in srgb,var(--sp-signal) 55%,#7db4ff));color:#fff;font-weight:700}
.tzs-uname{display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;max-width:150px}
.tzs-uname b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.tzs-uname small{display:flex;align-items:center;gap:6px;color:var(--sp-ash);font-size:12px}
.tzs-chev{color:var(--sp-ash)}
.tzs-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:180px;padding:6px;border:1px solid var(--sp-rim);border-radius:14px;background:var(--sp-surface);box-shadow:0 18px 44px rgba(0,0,0,.35)}
.tzs-menu button{display:block;width:100%;padding:10px 12px;border:0;border-radius:9px;background:none;text-align:left;font-size:14px;cursor:pointer}
.tzs-menu button:hover{background:var(--sp-surface2)}
.tzs-menu .tzs-danger{color:var(--sp-live)}
.tzs-login{padding:10px 22px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--sp-signal),color-mix(in srgb,var(--sp-signal) 62%,#7db4ff));color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 8px 20px color-mix(in srgb,var(--sp-signal) 30%,transparent)}
.tzs-login:hover{filter:brightness(1.08)}

.tzs-content{flex:1;min-width:0;padding:28px}
.tzs-tabs{display:none}
.tzs button:focus-visible,.tzs input:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}

.tzs-searchbtn,.tzs-menubtn{display:none}
.tzs-sheet,.tzs-back{display:none}

@media (max-width:1100px){.tzs-uname,.tzs-chev{display:none}}
@media (max-width:860px){
  .tzs{grid-template-columns:minmax(0,1fr)}
  .tzs-side{display:none}
  .tzs-top{flex-wrap:wrap;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));gap:8px}
  .tzs-top-logo{display:inline-flex}
  .tzs-searchbtn,.tzs-menubtn{display:grid}
  .tzs-theme,.tzs-user,.tzs-login-desktop{display:none}
  .tzs-top-logo{flex:none}
  .tzs-right{flex:none;min-width:0}
  .tzs-search{display:none;order:5;flex:1 1 100%;max-width:none;height:40px}
  .tzs-search.open{display:flex}
  .tzs-right{gap:8px}
  .tzs-pts{padding:6px 9px;font-size:11px}
  .tzs-coins{padding:6px 9px;font-size:11px}
  .tzs-icon{width:36px;height:36px}
  .tzs-content{padding:18px 14px calc(88px + env(safe-area-inset-bottom,0px))}
  .tzs-tabs{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;align-items:center;padding:4px 8px calc(4px + env(safe-area-inset-bottom,0px));background:color-mix(in srgb,var(--sp-surface) 94%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--sp-rim)}
  .tzs-tabs button{display:grid;place-items:center;height:52px;border:0;border-radius:14px;background:none;color:var(--sp-ash);cursor:pointer;transition:color .18s,transform .18s}
  .tzs-tabs button:active{transform:scale(.92)}
  .tzs-tabs svg{width:27px;height:27px}
  .tzs-tabs button.on{color:var(--sp-signal)}
  .tzs-tabs button.on svg{stroke-width:2.3}
  .tzs-tabs .tzs-avatar,.tzs-tabs img{border:2px solid transparent;transition:box-shadow .18s}
  .tzs-tabs button.on .tzs-avatar,.tzs-tabs button.on img{box-shadow:0 0 0 2px var(--sp-void),0 0 0 4px var(--sp-signal)}

  .tzs-back{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;background:rgba(0,0,0,.55);animation:tzs-fade .18s ease-out}
  .tzs-sheet{display:block;width:100%;max-height:86dvh;overflow:auto;padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px));border:1px solid var(--sp-rim);border-bottom:0;border-radius:24px 24px 0 0;background:var(--sp-surface);box-shadow:0 -20px 50px rgba(0,0,0,.4);animation:tzs-rise .24s cubic-bezier(.2,.8,.2,1)}
  .tzs-grab{display:block;width:40px;height:4px;margin:0 auto 14px;border-radius:99px;background:var(--sp-rim)}
  .tzs-sheet-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .tzs-sheet-head b{display:block;font-size:16px;font-weight:600}
  .tzs-sheet-head small{display:flex;align-items:center;gap:6px;color:var(--sp-ash);font-size:12px}
  .tzs-sheet-stats{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .tzs-sheet-stats .tzs-coins{padding:8px 12px;font-size:12px}
  .tzs-sheet-list{display:flex;flex-direction:column;gap:2px}
  .tzs-sheet-list button{display:flex;align-items:center;gap:14px;width:100%;padding:13px 12px;border:0;border-radius:12px;background:none;color:var(--sp-plat);font-size:15px;font-weight:500;text-align:left;cursor:pointer}
  .tzs-sheet-list button:hover,.tzs-sheet-list button.on{background:var(--sp-surface2)}
  .tzs-sheet-list button.on{color:var(--sp-signal)}
  .tzs-sheet-list .tzs-danger{color:var(--sp-live)}
  .tzs-sheet-online{display:flex;align-items:center;gap:8px;margin:12px 4px 0;color:var(--sp-ash);font-size:13px}
  .tzs-wide{display:block;width:100%;margin-bottom:12px;padding:13px}
}
@keyframes tzs-fade{from{opacity:0}to{opacity:1}}
@keyframes tzs-rise{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.tzs *{transition:none!important}}
`;
