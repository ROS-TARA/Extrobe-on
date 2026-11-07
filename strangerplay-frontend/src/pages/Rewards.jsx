/*
  Rewards.jsx — your coins, the daily tasks, and the rank ladder.

  Everything here is real: coins and points come from your account, task progress comes from the
  server (GET /api/rewards/daily) and a task is only paid when the server says so
  (POST /api/rewards/daily/:id/claim). Nothing is faked on this screen.

  Props:
    user          signed-in user (or null)
    token         sign-in token
    points        number?  live points
    onUserUpdate  fn(user)  called after a collect so the app shows the new coin total
    onBuyCoins    fn?       opens the buy-coins flow
    onLogin       fn        guests
    onNavigate    fn(key)   "match"
*/
import { useCallback, useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";

// Must match MIN_COINS_TO_PLAY in server.js
const MIN_COINS_TO_PLAY = 5;
const SIGNUP_COINS = 25;
// Must match calculateRank() in server.js
const RANKS = [["Bronze I", 0], ["Bronze II", 20], ["Bronze III", 50], ["Silver I", 100], ["Silver II", 500], ["Gold", 1000], ["Diamond", 5000]];

async function api(path, { method = "GET", token } = {}) {
  const r = await fetch(API + path, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

const left = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${Math.max(1, m)}m`;
};

const Ic = ({ children, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ICONS = {
  checkin: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></>,
  meet: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M17.5 14.2a5 5 0 0 1 4 4.8" /></>,
  play: <><rect x="2.5" y="7" width="19" height="10" rx="5" /><path d="M8 10v4M6 12h4M16 11v.01M18 13v.01" /></>,
  win: <><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M12 14v4M8.5 20h7M8 6H4.5a3 3 0 0 0 3 4M16 6h3.5a3 3 0 0 1-3 4" /></>,
};
const iconFor = (id) => ICONS[id.startsWith("meet") ? "meet" : id.startsWith("play") ? "play" : id.startsWith("win") ? "win" : "checkin"];

export default function Rewards({ user, token, points, onUserUpdate, onBuyCoins, onLogin, onNavigate }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");   // loading | ok | error
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try { setData(await api("/api/rewards/daily", { token })); setState("ok"); }
    catch { setState((s) => (s === "ok" ? s : "error")); }
  }, [token]);

  useEffect(() => { if (user && token) load(); }, [user && user.username, token, load]);   // eslint-disable-line react-hooks/exhaustive-deps
  // keep the "resets in" clock fresh; when the day rolls over, fetch the new tasks
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (data && now > data.resetsAt) load(); }, [now]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function collect(task) {
    setBusy(task.id); setErr("");
    try {
      const d = await api(`/api/rewards/daily/${task.id}/claim`, { method: "POST", token });
      setData(d);
      if (onUserUpdate && user) onUserUpdate({ ...user, coins: d.coins });
    } catch (e) { setErr(e.message); load(); }
    finally { setBusy(""); }
  }

  if (!user) {
    return (
      <div className="trw"><style>{CSS}</style>
        <div className="trw-card trw-solo"><h1>Rewards</h1><p>Sign in to see your coins and daily tasks.</p>
          <button className="trw-btn trw-solid" onClick={onLogin}>Sign in</button></div>
      </div>
    );
  }

  const coins = data ? data.coins : user.coins != null ? user.coins : 0;
  const pts = typeof points === "number" ? points : user.points || 0;
  const canPlay = coins >= MIN_COINS_TO_PLAY;
  const doneCount = data ? data.tasks.filter((t) => t.claimed).length : 0;

  let ri = 0;
  RANKS.forEach(([, min], i) => { if (pts >= min) ri = i; });
  const next = RANKS[ri + 1];
  const frac = next ? (pts - RANKS[ri][1]) / (next[1] - RANKS[ri][1]) : 1;

  return (
    <div className="trw">
      <style>{CSS}</style>
      <h1 className="trw-h">Rewards</h1>

      {/* balance */}
      <section className="trw-card trw-bal">
        <div className="trw-tiles">
          <div><small>Coins</small><b>{Number(coins).toLocaleString()}</b></div>
          <div><small>Points</small><b>{pts.toLocaleString()}</b></div>
        </div>
        <p className={`trw-can ${canPlay ? "ok" : "no"}`}>
          {canPlay ? `You have enough coins to play. One game costs ${MIN_COINS_TO_PLAY}.` : `You need ${MIN_COINS_TO_PLAY} coins to play a game. You are ${MIN_COINS_TO_PLAY - coins} short.`}
        </p>
        <div className="trw-row">
          {onBuyCoins && <button className="trw-btn trw-solid" onClick={onBuyCoins}>Buy coins</button>}
          {onNavigate && <button className="trw-btn trw-ghost" onClick={() => onNavigate("match")}>Meet someone</button>}
        </div>
      </section>

      {/* daily tasks */}
      <section className="trw-card">
        <div className="trw-head">
          <div><h2>Daily tasks</h2><p>{data ? `${doneCount} of ${data.tasks.length} collected` : "Finish tasks to earn coins."}</p></div>
          {data && <span className="trw-reset">Resets in {left(data.resetsAt - now)}</span>}
        </div>

        {state === "loading" && <p className="trw-note">Loading…</p>}
        {state === "error" && <p className="trw-note">Couldn’t load your tasks. <button className="trw-link" onClick={load}>Try again</button></p>}

        {data && (
          <ul className="trw-tasks">
            {data.tasks.map((t) => (
              <li key={t.id} className={`trw-task ${t.claimed ? "done" : ""}`}>
                <span className="trw-ico"><Ic>{iconFor(t.id)}</Ic></span>
                <div className="trw-tx">
                  <b>{t.title}</b>
                  <small>{t.desc}</small>
                  {!t.soon && t.goal > 1 && (
                    <span className="trw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={t.goal} aria-valuenow={t.progress} aria-label={`${t.title}: ${t.progress} of ${t.goal}`}>
                      <i style={{ width: `${Math.round((t.progress / t.goal) * 100)}%` }} />
                    </span>
                  )}
                  {!t.soon && t.goal > 1 && <small className="trw-prog">{t.progress} / {t.goal}</small>}
                </div>
                <div className="trw-act">
                  <span className="trw-reward">+{t.reward} coins</span>
                  {t.claimed ? <span className="trw-tag">Collected</span>
                    : t.soon ? <span className="trw-tag">Coming soon</span>
                    : t.claimable ? <button className="trw-btn trw-solid trw-sm" disabled={busy === t.id} onClick={() => collect(t)}>{busy === t.id ? "…" : "Collect"}</button>
                    : <span className="trw-tag">In progress</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {err && <p className="trw-err" role="alert">{err}</p>}
      </section>

      {/* how coins work */}
      <section className="trw-card">
        <h2>How coins work</h2>
        <ul className="trw-rules">
          <li>New accounts start with <b>{SIGNUP_COINS} coins</b>.</li>
          <li>Playing a game costs <b>{MIN_COINS_TO_PLAY} coins</b> to enter, so you need at least {MIN_COINS_TO_PLAY} to play.</li>
          <li>Win a game to earn coins, lose and you lose them. <span className="trw-dim">This starts with the new games.</span></li>
          <li>Run low? Collect your daily tasks or buy more coins.</li>
        </ul>
      </section>

      {/* rank ladder */}
      <section className="trw-card">
        <div className="trw-head">
          <div><h2>Your rank</h2><p>{RANKS[ri][0]}{next ? ` · ${(next[1] - pts).toLocaleString()} points to ${next[0]}` : " · top rank"}</p></div>
        </div>
        <span className="trw-bar trw-bar-lg" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)} aria-label="Progress to the next rank"><i style={{ width: `${Math.round(frac * 100)}%` }} /></span>
        <ol className="trw-ranks">
          {RANKS.map(([name, min], i) => (
            <li key={name} className={i <= ri ? "on" : ""}><span>{i <= ri ? "✓" : ""}</span><b>{name}</b><small>{min.toLocaleString()} pts</small></li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const CSS = `
.trw{max-width:680px;margin:0 auto;color:var(--sp-plat);font-family:'Inter',system-ui,sans-serif}
.trw *{box-sizing:border-box}
.trw-h{margin:0 0 16px;font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:700;letter-spacing:-.3px}
.trw-card{margin-bottom:14px;padding:20px;border:1px solid var(--sp-rim);border-radius:16px;background:var(--sp-surface)}
.trw-card h2{margin:0;font-size:18px;font-weight:700}
.trw-solo{text-align:center;padding:36px 20px}.trw-solo h1{margin:0 0 6px}.trw-solo p{margin:0 0 16px;color:var(--sp-ash)}
.trw-tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.trw-tiles div{padding:14px 16px;border:1px solid var(--sp-rim);border-radius:14px;background:var(--sp-surface2)}
.trw-tiles small{display:block;color:var(--sp-ash);font-size:13px}
.trw-tiles b{display:block;margin-top:2px;font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.15}
.trw-can{margin:14px 0 0;font-size:14px;line-height:1.45}
.trw-can.ok{color:var(--sp-ice)}.trw-can.no{color:var(--sp-live)}
.trw-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.trw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px}
.trw-head p{margin:2px 0 0;color:var(--sp-ash);font-size:14px}
.trw-reset{flex:none;padding:5px 11px;border-radius:999px;background:var(--sp-surface2);border:1px solid var(--sp-rim);color:var(--sp-ash);font-size:12px;font-weight:600}
.trw-note{margin:12px 0 0;color:var(--sp-ash);font-size:14px}
.trw-tasks{margin:6px 0 0;padding:0;list-style:none}
.trw-task{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--sp-rim)}
.trw-task:first-child{border-top:0}
.trw-ico{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:50%;background:color-mix(in srgb,var(--sp-signal) 12%,transparent);color:var(--sp-signal)}
.trw-task.done .trw-ico{background:color-mix(in srgb,var(--sp-ice) 16%,transparent);color:var(--sp-ice)}
.trw-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.trw-tx b{font-size:15px;font-weight:600}
.trw-tx small{color:var(--sp-ash);font-size:13px;line-height:1.4}
.trw-prog{font-variant-numeric:tabular-nums}
.trw-bar{display:block;height:6px;margin-top:6px;border-radius:99px;background:var(--sp-rim);overflow:hidden}
.trw-bar i{display:block;height:100%;border-radius:99px;background:var(--sp-signal)}
.trw-bar-lg{height:8px;margin:10px 0 14px}
.trw-act{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.trw-reward{color:var(--sp-gold);font-size:13px;font-weight:700;white-space:nowrap}
.trw-tag{padding:4px 10px;border-radius:999px;background:var(--sp-surface2);color:var(--sp-ash);font-size:12px;font-weight:600;white-space:nowrap}
.trw-err{margin:10px 0 0;color:var(--sp-live);font-size:14px}
.trw-rules{margin:10px 0 0;padding:0 0 0 20px;color:var(--sp-plat);font-size:14.5px;line-height:1.6}
.trw-rules li{margin-bottom:4px}.trw-dim{color:var(--sp-ash)}
.trw-ranks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
.trw-ranks li{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--sp-rim);border-radius:12px;color:var(--sp-ash)}
.trw-ranks li span{display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--sp-rim);font-size:12px;font-weight:700;color:#fff}
.trw-ranks li.on{color:var(--sp-plat)}.trw-ranks li.on span{background:var(--sp-signal);border-color:var(--sp-signal)}
.trw-ranks b{flex:1;font-size:14px;font-weight:600}.trw-ranks small{font-size:12px}

/* buttons: ".trw .x" is stronger than the app frame's "button{color:inherit}" rule, so the text colour sticks */
.trw .trw-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border:0;border-radius:8px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,opacity .15s}
.trw .trw-btn:disabled{opacity:.55;cursor:not-allowed}
.trw .trw-solid{background:var(--sp-signal);color:#fff}.trw .trw-solid:hover:not(:disabled){background:color-mix(in srgb,var(--sp-signal) 88%,#000)}
.trw .trw-ghost{background:var(--sp-surface2);color:var(--sp-plat);border:1px solid var(--sp-rim)}.trw .trw-ghost:hover{background:var(--sp-rim)}
.trw .trw-sm{padding:7px 16px;font-size:13px}
.trw .trw-link{padding:0;border:0;background:none;color:var(--sp-signal);font:inherit;font-weight:600;text-decoration:underline;cursor:pointer}
.trw button:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}
@media (max-width:520px){.trw-card{padding:16px}.trw-h{font-size:26px}.trw-ranks{grid-template-columns:1fr}.trw-task{align-items:flex-start}}
`;
