/*
  Home.jsx — the home page that goes inside <AppShell>.
  Uses the app's theme variables (--sp-*), so dark / light both work.
  Shows only real numbers: the live online count and the signed-in user's own stats.

  Props:
    user        logged-in user or null
    points      number?   user's points
    online      number?   live online count
    games       [{ emoji, title, desc, pts, color }]   the games list
    onPlay      fn()      "Start random match" (logged-in users)
    onLogin     fn()      guests are sent to sign in
    onNavigate  fn(key)   "match" | "live" | "golive" | "rewards" | "ranking"
*/
const Ic = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

function Globe() {
  const lats = [-62, -31, 0, 31, 62].map((d) => {
    const r = (d * Math.PI) / 180;
    const y = 120 - 92 * Math.sin(r);
    const hw = 92 * Math.cos(r);
    return { y, hw, ry: Math.max(3, hw * 0.16) };
  });
  return (
    <div className="tzh-globe" aria-hidden="true">
      <div className="tzh-ring" />
      <svg viewBox="0 0 240 240" className="tzh-sphere">
        <defs>
          <radialGradient id="tzh-g" cx="35%" cy="30%">
            <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--sp-signal) 38%, var(--sp-surface2))" }} />
            <stop offset="1" style={{ stopColor: "var(--sp-surface)" }} />
          </radialGradient>
        </defs>
        <circle cx="120" cy="120" r="92" fill="url(#tzh-g)" className="tzh-edge" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ellipse key={i} cx="120" cy="120" rx="92" ry="92" className="tzh-mer" style={{ animationDelay: `${-i * 1.4}s` }} />
        ))}
        {lats.map((l, i) => (
          <path key={i} d={`M${120 - l.hw} ${l.y} A${l.hw} ${l.ry} 0 0 0 ${120 + l.hw} ${l.y}`} fill="none" className="tzh-lat" />
        ))}
        {[[84, 92], [150, 78], [132, 138], [98, 150], [166, 118]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.2" className="tzh-pin" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </svg>
      <div className="tzh-orbit">
        <svg viewBox="0 0 24 24" width="26" height="26"><path d="M22 2 15 22l-4-9-9-4 20-7z" className="tzh-plane" strokeWidth="1.2" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
}

export default function Home({ user, points, online, games = [], onPlay, onLogin, onNavigate }) {
  const first = user ? String(user.name || user.username || "").split(" ")[0] : "";
  const play = () => (user ? onPlay && onPlay() : onLogin && onLogin());
  const go = (k) => onNavigate && onNavigate(k);

  const cards = [
    { k: "play", title: "Meet the world", text: "Get matched with someone new from anywhere, in seconds.", icon: <Ic><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Ic> },
    { k: "play", title: "Play together", text: "Break the ice with Don’t Laugh, Hot Take and more.", icon: <Ic><rect x="2.5" y="7" width="19" height="10" rx="5" /><path d="M8 10v4M6 12h4M16 11v.01M18 13v.01" /></Ic> },
    { k: "rewards", title: "Earn points", text: "Win matches to collect points and coins.", icon: <Ic><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></Ic> },
    { k: "ranking", title: "Climb the ranks", text: "See where you stand on the leaderboard.", icon: <Ic><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M12 14v4M8.5 20h7" /></Ic> },
  ];

  const stats = user
    ? [["Games", user.gamesPlayed || 0], ["Wins", user.wins || 0], ["Points", typeof points === "number" ? points : user.points || 0], ["Rank", user.rank || "Bronze I"]]
    : null;

  return (
    <div className="tzh">
      <style>{CSS}</style>

      <section className="tzh-hero">
        <div className="tzh-copy">
          <h1>Hey {first || "there"}!</h1>
          <p className="tzh-lead">New people. New stories. Same you.</p>
          <p className="tzh-sub">Jump on a video call with someone from anywhere in the world and play a game together.</p>
          <button className="tzh-cta" onClick={play}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="3" /><path d="m15.5 10.5 6-3v9l-6-3" /></svg>
            {user ? "Start random match" : "Sign in to play"}
          </button>
          {typeof online === "number" && online > 0 && (
            <p className="tzh-live"><i />{online.toLocaleString()} {online === 1 ? "person is" : "people are"} online now</p>
          )}
        </div>
        <Globe />
      </section>

      <section className="tzh-cards" aria-label="What you can do">
        {cards.map((c) => (
          <button key={c.title} className="tzh-card" onClick={() => (c.k === "play" ? play() : go(c.k))}>
            <span className="tzh-ico">{c.icon}</span>
            <b>{c.title}</b>
            <span>{c.text}</span>
          </button>
        ))}
      </section>

      {stats && (
        <section className="tzh-stats" aria-label="Your stats">
          {stats.map(([label, val]) => (
            <div key={label}><b>{typeof val === "number" ? val.toLocaleString() : val}</b><span>{label}</span></div>
          ))}
        </section>
      )}

      <section className="tzh-live-row" aria-label="Live">
        <button className="tzh-wide" onClick={() => go("live")}>
          <span className="tzh-ico"><Ic><circle cx="12" cy="12" r="2.2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></Ic></span>
          <span><b>Watch live matches</b><span>See what other people are playing right now.</span></span>
        </button>
        <button className="tzh-wide" onClick={() => (user ? go("golive") : onLogin && onLogin())}>
          <span className="tzh-ico"><Ic><rect x="2.5" y="6" width="13" height="12" rx="3" /><path d="m15.5 10.5 6-3v9l-6-3" /></Ic></span>
          <span><b>Go live</b><span>Stream your own call and let a crowd watch.</span></span>
        </button>
      </section>

      {games.length > 0 && (
        <section className="tzh-games" aria-label="Games">
          <h2>Pick a game <small>unlocked once you connect</small></h2>
          <div className="tzh-grid">
            {games.map((g) => (
              <div key={g.title} className="tzh-game" style={{ "--c": g.color }}>
                <span className="tzh-emoji">{g.emoji}</span>
                <b>{g.title}</b>
                <span>{g.desc}</span>
                <em>+{g.pts} pts</em>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const CSS = `
.tzh{position:relative;max-width:1080px;margin:0 auto;color:var(--sp-plat);font-family:'Inter',system-ui,sans-serif}
.tzh *{box-sizing:border-box}
.tzh-hero{position:relative;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:center;gap:24px;padding:14px 0 34px}
.tzh-hero::before{content:"";position:absolute;inset:-40px -10% auto auto;width:70%;height:120%;background:radial-gradient(closest-side,color-mix(in srgb,var(--sp-signal) 16%,transparent),transparent);pointer-events:none;z-index:-1}
.tzh-copy h1{margin:0 0 10px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:clamp(36px,5.4vw,58px);line-height:1.02;letter-spacing:-1.5px}
.tzh-lead{margin:0 0 10px;font-family:'Space Grotesk',sans-serif;font-size:clamp(18px,2.4vw,24px);font-weight:600;line-height:1.3}
.tzh-sub{margin:0 0 26px;max-width:46ch;color:var(--sp-ash);font-size:16px;line-height:1.6}
.tzh-cta{display:inline-flex;align-items:center;gap:10px;padding:15px 28px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--sp-signal),color-mix(in srgb,var(--sp-signal) 62%,#7db4ff));color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 12px 32px color-mix(in srgb,var(--sp-signal) 36%,transparent),inset 0 1px 0 rgba(255,255,255,.2);transition:transform .18s,box-shadow .18s,filter .18s}
.tzh-cta:hover{transform:translateY(-2px);filter:brightness(1.07);box-shadow:0 16px 38px color-mix(in srgb,var(--sp-signal) 44%,transparent),inset 0 1px 0 rgba(255,255,255,.2)}
.tzh-cta:active{transform:translateY(0)}
.tzh-live{display:flex;align-items:center;gap:9px;margin:18px 0 0;color:var(--sp-ash);font-size:14px}
.tzh-live i{width:8px;height:8px;border-radius:50%;background:var(--sp-ice);box-shadow:0 0 0 3px color-mix(in srgb,var(--sp-ice) 22%,transparent)}

.tzh-globe{position:relative;width:100%;max-width:340px;aspect-ratio:1;margin:0 auto;filter:drop-shadow(0 24px 40px color-mix(in srgb,var(--sp-signal) 22%,transparent))}
.tzh-sphere{position:absolute;inset:0;width:100%;height:100%}
.tzh-ring{position:absolute;inset:-6%;border:1px dashed color-mix(in srgb,var(--sp-signal) 38%,transparent);border-radius:50%}
.tzh-edge{stroke:var(--sp-signal);stroke-opacity:.6;stroke-width:1.5}
.tzh-mer{fill:none;stroke:var(--sp-signal);stroke-opacity:.34;stroke-width:1;transform-box:fill-box;transform-origin:center;animation:tzh-rot 8.4s ease-in-out infinite}
.tzh-lat{stroke:var(--sp-signal);stroke-opacity:.28}
.tzh-pin{fill:var(--sp-plat);animation:tzh-blink 3s ease-in-out infinite}
.tzh-plane{fill:var(--sp-signal);stroke:var(--sp-signal)}
.tzh-orbit{position:absolute;inset:-6%;animation:tzh-spin 16s linear infinite}
.tzh-orbit svg{position:absolute;top:-13px;left:50%;margin-left:-13px;transform:rotate(45deg)}
@keyframes tzh-rot{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.03)}}
@keyframes tzh-blink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes tzh-spin{to{transform:rotate(360deg)}}

.tzh-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.tzh-card,.tzh-wide{font:inherit;color:var(--sp-ash);text-align:left;cursor:pointer;border:1px solid var(--sp-rim);background:var(--sp-surface);transition:transform .2s,border-color .2s,box-shadow .2s}
.tzh-card{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:20px;border-radius:18px;font-size:14px;line-height:1.45}
.tzh-card:hover,.tzh-wide:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--sp-signal) 55%,var(--sp-rim));box-shadow:0 14px 34px rgba(0,0,0,.22)}
.tzh-card b,.tzh-wide b{color:var(--sp-plat);font-size:16px;font-weight:600}
.tzh-ico{display:grid;place-items:center;flex:none;width:44px;height:44px;margin-bottom:8px;border-radius:13px;background:color-mix(in srgb,var(--sp-signal) 14%,transparent);color:var(--sp-signal)}

.tzh-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:14px}
.tzh-stats div{display:flex;flex-direction:column;gap:2px;padding:18px 20px;border:1px solid var(--sp-rim);border-radius:18px;background:var(--sp-surface)}
.tzh-stats b{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:600}
.tzh-stats span{color:var(--sp-ash);font-size:13px}

.tzh-live-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}
.tzh-wide{display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:18px;font-size:14px;line-height:1.4}
.tzh-wide .tzh-ico{margin:0}
.tzh-wide b{display:block;margin-bottom:2px}

.tzh-games{margin-top:34px}
.tzh-games h2{margin:0 0 16px;font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;letter-spacing:-.3px}
.tzh-games h2 small{margin-left:10px;color:var(--sp-ghost);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0}
.tzh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.tzh-game{position:relative;display:flex;flex-direction:column;gap:6px;padding:18px;border:1px solid var(--sp-rim);border-radius:18px;background:var(--sp-surface);color:var(--sp-ash);font-size:13px;line-height:1.5;overflow:hidden}
.tzh-game::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:var(--c);opacity:.85}
.tzh-game b{color:var(--sp-plat);font-size:15px;font-weight:600}
.tzh-emoji{font-size:26px;line-height:1}
.tzh-game em{margin-top:auto;padding-top:6px;color:var(--c);font-family:'JetBrains Mono',monospace;font-size:12px;font-style:normal;font-weight:600}
.tzh button:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}

@media (max-width:980px){.tzh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:860px){.tzh-cards,.tzh-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){
  .tzh-hero{grid-template-columns:minmax(0,1fr);padding-bottom:22px;gap:18px}
  .tzh-globe{max-width:230px;order:-1}
  .tzh-copy{text-align:center}
  .tzh-sub{margin-left:auto;margin-right:auto}
  .tzh-live{justify-content:center}
  .tzh-cta{width:100%;justify-content:center}
  .tzh-card{padding:16px}
  .tzh-live-row,.tzh-grid{grid-template-columns:minmax(0,1fr)}
}
@media (prefers-reduced-motion:reduce){.tzh-mer,.tzh-pin,.tzh-orbit{animation:none}.tzh *{transition:none!important}}
`;