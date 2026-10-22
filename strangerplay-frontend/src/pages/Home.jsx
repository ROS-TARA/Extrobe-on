/*
  Home.jsx — the home page that goes inside <AppShell>.

  Props:
    user        logged-in user or null
    online      number?   live online count
    onPlay      fn()      "Start random match"
    onLogin     fn()      open the login popup
    onNavigate  fn(key)   "match" | "rewards" | "ranking" | "profile"
*/
const AMBER = "#c97b3d";

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
            <stop offset="0" stopColor="#3b2a17" />
            <stop offset="1" stopColor="#120e09" />
          </radialGradient>
        </defs>
        <circle cx="120" cy="120" r="92" fill="url(#tzh-g)" stroke={AMBER} strokeOpacity=".55" strokeWidth="1.5" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ellipse key={i} cx="120" cy="120" rx="92" ry="92" className="tzh-mer" style={{ animationDelay: `${-i * 1.4}s` }} />
        ))}
        {lats.map((l, i) => (
          <path key={i} d={`M${120 - l.hw} ${l.y} A${l.hw} ${l.ry} 0 0 0 ${120 + l.hw} ${l.y}`} fill="none" stroke={AMBER} strokeOpacity=".28" />
        ))}
        {[[84, 92], [150, 78], [132, 138], [98, 150], [166, 118]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.2" fill="#f4ede1" className="tzh-pin" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </svg>
      <div className="tzh-orbit">
        <svg viewBox="0 0 24 24" width="26" height="26"><path d="M22 2 15 22l-4-9-9-4 20-7z" fill={AMBER} stroke={AMBER} strokeWidth="1.2" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
}

const Ic = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export default function Home({ user, online, onPlay, onLogin, onNavigate }) {
  const first = user ? String(user.name || user.username || "").split(" ")[0] : "";
  const play = () => (user ? onPlay && onPlay() : onLogin && onLogin());
  const go = (k) => onNavigate && onNavigate(k);

  const cards = [
    { k: "match", title: "Meet the world", text: "Get matched with someone new from anywhere, in seconds.", icon: <Ic><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Ic> },
    { k: "match", title: "Play together", text: "Break the ice with Don’t Laugh, Hot Take and more.", icon: <Ic><rect x="2.5" y="7" width="19" height="10" rx="5" /><path d="M8 10v4M6 12h4M16 11v.01M18 13v.01" /></Ic> },
    { k: "rewards", title: "Earn points", text: "Win matches to collect points and coins.", icon: <Ic><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></Ic> },
    { k: "ranking", title: "Climb the ranks", text: "See where you stand on the leaderboard.", icon: <Ic><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M12 14v4M8.5 20h7" /></Ic> },
  ];

  const stats = user
    ? [["Games", user.gamesPlayed || 0], ["Wins", user.wins || 0], ["Points", user.points || 0], ["Rank", user.rank || "Bronze I"]]
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
            {user ? "Start random match" : "Log in to play"}
          </button>
          {typeof online === "number" && online > 0 && (
            <p className="tzh-live"><i />{online.toLocaleString()} {online === 1 ? "person is" : "people are"} online now</p>
          )}
        </div>
        <Globe />
      </section>

      <section className="tzh-cards" aria-label="What you can do">
        {cards.map((c) => (
          <button key={c.title} className="tzh-card" onClick={() => (c.k === "match" ? play() : go(c.k))}>
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
    </div>
  );
}

const CSS = `
.tzh{max-width:1080px;margin:0 auto;color:#f4ede1}
.tzh *{box-sizing:border-box}
.tzh-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:center;gap:24px;padding:8px 0 30px}
.tzh-copy h1{margin:0 0 10px;font-family:"Iowan Old Style",Georgia,"Times New Roman",serif;font-weight:600;font-size:clamp(34px,5vw,52px);line-height:1.05;letter-spacing:-.02em}
.tzh-lead{margin:0 0 10px;font-size:clamp(18px,2.4vw,24px);font-weight:600;line-height:1.3}
.tzh-sub{margin:0 0 24px;max-width:46ch;color:#bfae92;font-size:16px;line-height:1.55}
.tzh-cta{display:inline-flex;align-items:center;gap:10px;padding:15px 26px;border:0;border-radius:999px;background:#c97b3d;color:#1a1209;font:inherit;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 10px 30px rgba(201,123,61,.25)}
.tzh-cta:hover{background:#d98a3f}
.tzh-live{display:flex;align-items:center;gap:9px;margin:16px 0 0;color:#bfae92;font-size:14px}
.tzh-live i{width:8px;height:8px;border-radius:50%;background:#58c27d;box-shadow:0 0 0 3px rgba(88,194,125,.18)}

.tzh-globe{position:relative;width:100%;max-width:340px;aspect-ratio:1;margin:0 auto}
.tzh-sphere{position:absolute;inset:0;width:100%;height:100%}
.tzh-ring{position:absolute;inset:-6%;border:1px dashed rgba(201,123,61,.3);border-radius:50%}
.tzh-mer{fill:none;stroke:#c97b3d;stroke-opacity:.34;stroke-width:1;transform-box:fill-box;transform-origin:center;animation:tzh-rot 8.4s ease-in-out infinite}
.tzh-pin{animation:tzh-blink 3s ease-in-out infinite}
.tzh-orbit{position:absolute;inset:-6%;animation:tzh-spin 16s linear infinite}
.tzh-orbit svg{position:absolute;top:-13px;left:50%;margin-left:-13px;transform:rotate(45deg)}
@keyframes tzh-rot{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.03)}}
@keyframes tzh-blink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes tzh-spin{to{transform:rotate(360deg)}}

.tzh-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.tzh-card{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:20px;border:1px solid #2a2218;border-radius:16px;background:#17130d;color:#bfae92;font:inherit;font-size:14px;line-height:1.45;text-align:left;cursor:pointer}
.tzh-card:hover{border-color:#c97b3d;background:#1c1610}
.tzh-card b{color:#f4ede1;font-size:16px;font-weight:600}
.tzh-ico{display:grid;place-items:center;width:44px;height:44px;margin-bottom:8px;border-radius:12px;background:#2a1f12;color:#c97b3d}
.tzh-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:14px}
.tzh-stats div{display:flex;flex-direction:column;gap:2px;padding:18px 20px;border:1px solid #2a2218;border-radius:16px;background:#120f0a}
.tzh-stats b{font-size:24px;font-weight:600}
.tzh-stats span{color:#a39379;font-size:13px}
.tzh button:focus-visible{outline:2px solid #c97b3d;outline-offset:2px}

@media (max-width:860px){
  .tzh-cards,.tzh-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:640px){
  .tzh-hero{grid-template-columns:minmax(0,1fr);padding-bottom:22px;gap:18px}
  .tzh-globe{max-width:230px;order:-1}
  .tzh-copy{text-align:center}
  .tzh-sub{margin-left:auto;margin-right:auto}
  .tzh-live{justify-content:center}
  .tzh-cta{width:100%;justify-content:center}
  .tzh-card{padding:16px}
}
@media (prefers-reduced-motion:reduce){.tzh-mer,.tzh-pin,.tzh-orbit{animation:none}}
`;
