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
    badges          { messages: n }?   unread counts shown on the nav items
    bare            boolean?      true = hide the frame (live call, game, login)
    profileMenu     { onEdit, onShare }?   pass ONLY while the user is on their own profile:
                                  it shows the ☰ button (top-right) with Edit profile, Share card,
                                  Settings, Rewards, Ranking, theme, Log out, and the coin + point totals.
    notifications   [{ id, text, sub?, count?, onClick }]?   real items for the bell. Empty = "all caught up".

  Top bar (every screen size): logo + search on the left, the notification hand on the right.
  Points and coins are NOT in the top bar any more — they are inside the profile ☰ menu.
  Phone: Instagram-style bottom tabs (Home, Match, Live, Messages, Profile).
  PC: sidebar with every page.
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
// Tranzle's own notification icon: a raised hand ("hi!") — fits meeting people. Not a bell, not a heart.
const HiI = () => <Ic size={22}><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3.5a1.4 1.4 0 0 1 2.4-1.4L7 14" /></Ic>;
const EditI = () => <Ic><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Ic>;
const ShareI = () => <Ic><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Ic>;
const GlobeI = () => <Ic size={22}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Ic>;

// tab: shown in the phone's bottom bar (Profile is last = bottom-right, like Instagram).
// Everything else is in the menu sheet (top-right button).  auth: guests are sent to sign in.
const NAV = [
  { key: "home", label: "Home", Icon: HomeI, tab: true },
  { key: "match", label: "Random match", Icon: VideoI, tab: true },
  { key: "live", label: "Live", Icon: LiveI, tab: true },
  { key: "messages", label: "Messages", Icon: ChatI, tab: true, auth: true },
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
  onBuyCoins, theme, onToggleTheme, badges, bare, children, profileMenu, notifications,
}) {
  const [panel, setPanel] = useState(null);      // null | "notes" | "menu"
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (!panel) return;
    const esc = (e) => e.key === "Escape" && setPanel(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [panel]);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);
  // navigating anywhere closes the panels and the phone search row
  useEffect(() => { setPanel(null); setSearchOpen(false); }, [page]);

  if (bare) return <>{children}</>;

  const go = (n) => {
    setPanel(null);
    if (n.auth && !user) return onLogin && onLogin();
    onNavigate && onNavigate(n.key);
  };
  const search = (e) => {
    e.preventDefault();
    const name = q.trim().replace(/^@/, "");
    if (name && onSearch) { onSearch(name); setQ(""); setSearchOpen(false); }
  };
  const tabs = NAV.filter((n) => n.tab);
  const shownPoints = typeof points === "number" ? points : (user && user.points) || 0;
  const coins = user && user.coins != null ? user.coins : 0;
  const badge = (key) => (badges && badges[key] > 0 ? (badges[key] > 9 ? "9+" : String(badges[key])) : "");
  const notes = Array.isArray(notifications) ? notifications : [];
  const noteCount = notes.reduce((a, n) => a + (n.count || 1), 0);
  const noteBadge = noteCount > 9 ? "9+" : String(noteCount);
  // run an action, then close the panel
  const act = (fn) => () => { setPanel(null); fn && fn(); };

  return (
    <div className="tzs">
      <style>{CSS}</style>

      <aside className="tzs-side">
        <button className="tzs-brand" onClick={() => onNavigate && onNavigate("home")} aria-label="Tranzle home"><Logo size={30} /></button>
        <nav aria-label="Main" className="tzs-nav">
          {NAV.map((n) => (
            <button key={n.key} className={`tzs-item ${page === n.key ? "on" : ""}`} onClick={() => go(n)} aria-current={page === n.key ? "page" : undefined}>
              <n.Icon /><span>{n.label}</span>
              {badge(n.key) && <em className="tzs-count" aria-label={`${badge(n.key)} unread`}>{badge(n.key)}</em>}
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
          <button className="tzs-top-brand" onClick={() => onNavigate && onNavigate("home")} aria-label="Tranzle home"><Logo size={30} /></button>
          <form className={`tzs-search ${searchOpen ? "open" : ""}`} onSubmit={search} role="search">
            <SearchI />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a player by username" aria-label="Find a player by username" maxLength={20} autoCapitalize="none" autoCorrect="off" />
          </form>

          <div className="tzs-right">
            <button className="tzs-icon tzs-searchbtn" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search players" aria-expanded={searchOpen}><SearchI /></button>
            {user ? (
              <>
                <button className={`tzs-icon tzs-bell ${noteCount > 0 ? "new" : ""}`} onClick={() => setPanel(panel === "notes" ? null : "notes")} aria-label={noteCount ? `Notifications, ${noteCount} new` : "Notifications"} aria-haspopup="dialog" aria-expanded={panel === "notes"}>
                  <HiI />
                  {noteCount > 0 && <i className="tzs-bellbadge">{noteBadge}</i>}
                </button>
                {profileMenu && (
                  <button className="tzs-icon" onClick={() => setPanel(panel === "menu" ? null : "menu")} aria-label="Profile menu" aria-haspopup="dialog" aria-expanded={panel === "menu"}><MenuI /></button>
                )}
              </>
            ) : (
              <>
                <button className="tzs-icon" onClick={onToggleTheme} aria-label="Toggle dark / light mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                  {theme === "dark" ? <SunI /> : <MoonI />}
                </button>
                <button className="tzs-login" onClick={onLogin}>Sign in</button>
              </>
            )}
          </div>
        </header>

        <main className="tzs-content">{children}</main>
      </div>

      <nav className="tzs-tabs" aria-label="Main">
        {tabs.map((n) => (
          <button key={n.key} className={page === n.key ? "on" : ""} onClick={() => go(n)} aria-label={n.label} title={n.label} aria-current={page === n.key ? "page" : undefined}>
            {n.key === "profile" && user ? <Avatar user={user} size={28} /> : <span className="tzs-bwrap"><n.Icon />{badge(n.key) && <i className="tzs-badge" aria-label={`${badge(n.key)} unread`}>{badge(n.key)}</i>}</span>}
          </button>
        ))}
      </nav>

      {/* ── notification hall ── */}
      {panel === "notes" && user && (
        <div className="tzs-back" onPointerDown={(e) => e.target === e.currentTarget && setPanel(null)}>
          <div className="tzs-sheet" role="dialog" aria-modal="true" aria-label="Notifications">
            <span className="tzs-grab" aria-hidden="true" />
            <h2 className="tzs-sheet-title">Notifications</h2>
            {notes.length > 0 ? (
              <div className="tzs-sheet-list">
                {notes.map((n) => (
                  <button key={n.id} onClick={act(n.onClick)}>
                    <span className="tzs-note-ic"><ChatI /></span>
                    <span className="tzs-note-tx"><b>{n.text}</b>{n.sub && <small>{n.sub}</small>}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="tzs-empty"><b>You’re all caught up.</b><small>New messages will show up here.</small></p>
            )}
          </div>
        </div>
      )}

      {/* ── profile ☰ menu (own profile only) ── */}
      {panel === "menu" && user && profileMenu && (
        <div className="tzs-back" onPointerDown={(e) => e.target === e.currentTarget && setPanel(null)}>
          <div className="tzs-sheet" role="dialog" aria-modal="true" aria-label="Profile menu">
            <span className="tzs-grab" aria-hidden="true" />
            <div className="tzs-sheet-head">
              <Avatar user={user} size={44} />
              <span><b>{user.name || user.username}</b><small>@{user.username}</small></span>
            </div>
            <div className="tzs-tiles">
              <div className="tzs-tile"><small>Points</small><b>{shownPoints.toLocaleString()}</b></div>
              <div className="tzs-tile"><small>Coins</small><b>{Number(coins).toLocaleString()}</b></div>
            </div>
            {onBuyCoins && <button className="tzs-buy" onClick={act(onBuyCoins)}>Buy coins</button>}
            <div className="tzs-sheet-list">
              <button onClick={act(profileMenu.onEdit)}><EditI /><span>Edit profile</span></button>
              <button onClick={act(profileMenu.onShare)}><ShareI /><span>Share card</span></button>
              <button onClick={act(() => onNavigate && onNavigate("settings"))}><SettingsI /><span>Settings</span></button>
              <button onClick={act(() => onNavigate && onNavigate("rewards"))}><StarI /><span>Rewards</span></button>
              <button onClick={act(() => onNavigate && onNavigate("ranking"))}><TrophyI /><span>Ranking</span></button>
              <button onClick={() => onToggleTheme && onToggleTheme()}>
                {theme === "dark" ? <SunI /> : <MoonI />}<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
              {onLogout && <button className="tzs-danger" onClick={act(onLogout)}><LogoutI /><span>Log out</span></button>}
            </div>
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
.tzs-item{position:relative;display:flex;align-items:center;gap:14px;width:100%;padding:12px 14px;border:0;border-radius:12px;background:none;color:var(--sp-ash);font-size:15px;font-weight:500;text-align:left;cursor:pointer;transition:background .15s,color .15s}
.tzs-item:hover{background:var(--sp-surface2);color:var(--sp-plat)}
.tzs-item.on{color:var(--sp-signal);font-weight:600;background:color-mix(in srgb,var(--sp-signal) 12%,transparent)}
.tzs-count{margin-left:auto;min-width:22px;padding:2px 7px;border-radius:999px;background:var(--sp-live);color:#fff;font-size:11px;font-weight:700;font-style:normal;text-align:center}
.tzs-bwrap{position:relative;display:grid;place-items:center}
.tzs-badge{position:absolute;top:-7px;right:-11px;display:grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border:2px solid var(--sp-surface);border-radius:10px;background:var(--sp-live);color:#fff;font-size:11px;font-weight:700;font-style:normal}
.tzs-soon{margin-left:auto;padding:2px 8px;border-radius:999px;background:var(--sp-surface2);color:var(--sp-ash);font-size:10px;font-style:normal;font-weight:600;letter-spacing:.4px;text-transform:uppercase}
.tzs-item.on .tzs-soon{background:color-mix(in srgb,var(--sp-signal) 18%,transparent);color:var(--sp-signal)}
.tzs-meet{display:flex;align-items:center;gap:12px;margin-top:auto;padding:14px;border:1px solid var(--sp-rim);border-radius:14px;background:var(--sp-surface2);font-size:13px;line-height:1.35;color:var(--sp-ash)}
.tzs-meet-ic{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,var(--sp-signal) 12%,transparent);color:var(--sp-signal)}
.tzs-meet b{display:block;color:var(--sp-plat);font-weight:600}
.tzs-online{display:flex;align-items:center;gap:7px;margin-top:5px}
.tzs-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--sp-ice)}

/* top bar */
.tzs-main{min-width:0;display:flex;flex-direction:column}
.tzs-top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:10px 28px;background:var(--sp-surface);border-bottom:1px solid var(--sp-rim);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.tzs-top-brand{display:none;flex:none;padding:0;border:0;background:none;cursor:pointer}
.tzs-search{flex:1;max-width:520px;display:flex;align-items:center;gap:10px;padding:0 16px;height:40px;border:1px solid transparent;border-radius:999px;background:var(--sp-void);color:var(--sp-ghost);transition:border-color .15s,background .15s}
.tzs-search:focus-within{border-color:var(--sp-signal);background:var(--sp-surface)}
.tzs-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;color:var(--sp-plat);font-size:15px}
.tzs-search input::placeholder{color:var(--sp-ghost)}
.tzs-right{position:relative;margin-left:auto;display:flex;align-items:center;gap:10px}
.tzs-icon{position:relative;display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:var(--sp-void);color:var(--sp-plat);cursor:pointer;transition:background .15s}
.tzs-icon:hover{background:var(--sp-rim)}
.tzs-bell.new{color:var(--sp-signal);background:color-mix(in srgb,var(--sp-signal) 12%,var(--sp-void))}
.tzs-bellbadge{position:absolute;top:-3px;right:-3px;display:grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border:2px solid var(--sp-surface);border-radius:10px;background:var(--sp-live);color:#fff;font-size:11px;font-weight:700;font-style:normal}
.tzs-avatar{display:grid;place-items:center;background:var(--sp-signal);color:#fff;font-weight:700}
.tzs-login{padding:9px 22px;border:0;border-radius:8px;background:var(--sp-signal);color:#fff;font-size:14px;font-weight:600;cursor:pointer}
.tzs-login:hover{background:color-mix(in srgb,var(--sp-signal) 88%,#000)}

.tzs-content{flex:1;min-width:0;padding:28px}
.tzs-tabs{display:none}
.tzs button:focus-visible,.tzs input:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}
.tzs-searchbtn{display:none}

/* panels: a popover under the top bar on PC, a bottom sheet on phones */
.tzs-back{position:fixed;inset:0;z-index:60;display:flex;justify-content:flex-end;align-items:flex-start;padding:64px 28px 0}
.tzs-sheet{width:min(380px,100%);max-height:calc(100dvh - 84px);overflow:auto;padding:14px;border:1px solid var(--sp-rim);border-radius:16px;background:var(--sp-surface);box-shadow:0 12px 36px rgba(0,0,0,.22)}
.tzs-grab{display:none}
.tzs-sheet-title{margin:2px 4px 10px;font-size:18px;font-weight:700}
.tzs-sheet-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.tzs-sheet-head b{display:block;font-size:16px;font-weight:600}
.tzs-sheet-head small{display:block;color:var(--sp-ash);font-size:13px}
.tzs-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.tzs-tile{padding:12px 14px;border:1px solid var(--sp-rim);border-radius:14px;background:var(--sp-surface2)}
.tzs-tile small{display:block;color:var(--sp-ash);font-size:12px}
.tzs-tile b{display:block;margin-top:2px;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
.tzs-buy{display:block;width:100%;margin-bottom:10px;padding:11px;border:1px solid var(--sp-rim);border-radius:12px;background:var(--sp-surface);color:var(--sp-signal);font-size:14px;font-weight:600;cursor:pointer}
.tzs-buy:hover{background:var(--sp-surface2)}
.tzs-sheet-list{display:flex;flex-direction:column;gap:2px}
.tzs-sheet-list button{display:flex;align-items:center;gap:14px;width:100%;padding:12px;border:0;border-radius:12px;background:none;color:var(--sp-plat);font-size:15px;font-weight:500;text-align:left;cursor:pointer}
.tzs-sheet-list button:hover{background:var(--sp-surface2)}
.tzs-sheet-list .tzs-danger{color:var(--sp-live)}
.tzs-note-ic{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,var(--sp-signal) 12%,transparent);color:var(--sp-signal)}
.tzs-note-tx{display:flex;flex-direction:column;min-width:0}
.tzs-note-tx b{font-weight:600}
.tzs-note-tx small{color:var(--sp-ash);font-size:13px;font-weight:400}
.tzs-empty{margin:0;padding:28px 12px 22px;text-align:center}
.tzs-empty b{display:block;font-size:15px}
.tzs-empty small{display:block;margin-top:4px;color:var(--sp-ash);font-size:13px}

@media (max-width:860px){
  .tzs{grid-template-columns:minmax(0,1fr)}
  .tzs-side{display:none}
  .tzs-top{flex-wrap:wrap;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));gap:8px}
  .tzs-top-brand{display:inline-flex}
  .tzs-searchbtn{display:grid}
  .tzs-right{flex:none;min-width:0;gap:8px}
  .tzs-search{display:none;order:5;flex:1 1 100%;max-width:none;height:40px}
  .tzs-search.open{display:flex}
  .tzs-content{padding:18px 14px calc(88px + env(safe-area-inset-bottom,0px))}
  .tzs-tabs{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;align-items:center;padding:4px 8px calc(4px + env(safe-area-inset-bottom,0px));background:var(--sp-surface);border-top:1px solid var(--sp-rim)}
  .tzs-tabs button{display:grid;place-items:center;height:52px;border:0;border-radius:14px;background:none;color:var(--sp-ash);cursor:pointer;transition:color .15s}
  .tzs-tabs svg{width:27px;height:27px}
  .tzs-tabs button.on{color:var(--sp-signal)}
  .tzs-tabs button.on svg{stroke-width:2.3}
  .tzs-tabs .tzs-avatar,.tzs-tabs img{border:2px solid transparent;transition:box-shadow .18s}
  .tzs-tabs button.on .tzs-avatar,.tzs-tabs button.on img{box-shadow:0 0 0 2px var(--sp-void),0 0 0 4px var(--sp-signal)}

  .tzs-back{align-items:flex-end;padding:0;background:rgba(0,0,0,.55);animation:tzs-fade .12s ease-out}
  .tzs-sheet{width:100%;max-height:86dvh;padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px));border-bottom:0;border-radius:24px 24px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:tzs-rise .18s ease-out}
  .tzs-grab{display:block;width:40px;height:4px;margin:0 auto 14px;border-radius:99px;background:var(--sp-rim)}
}
@keyframes tzs-fade{from{opacity:0}to{opacity:1}}
@keyframes tzs-rise{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.tzs *{transition:none!important;animation:none!important}}
`;
