/*
  CallScreen.jsx — the live call + the "finding someone" screen (one shared stage).

  LAYOUT
    ┌──────────── stage ────────────┐   phone (portrait):   stranger on top, you below
    │  stranger tile │  you tile    │   desktop (landscape): stranger left, you right
    └───────────────────────────────┘   Each tile is exactly half of the stage.
    [ mic ] [ cam ] [ Games ] [ NEXT ] [ end ]   <- control bar (its own row, never over the video)

  GAME SLOTS (all optional, all empty today — nothing is drawn until you pass something in):
    arena        covers the WHOLE stage (both tiles). Put a game canvas / component here.
                 It sits above the videos and below the controls. Size it to 100% x 100%.
                 Example later:  <CallScreen ... arena={<FlappyHead roomId={roomId} />} />
    theirOverlay covers only the stranger's tile  (e.g. their face box, their score)
    myOverlay    covers only your tile
    hud          small badge at the exact centre where the two tiles meet (score / timer / coins)
    result       { won: true|false, title?, detail? }  -> shows a big "You win" / "You lose" card.
                 `detail` is any text you like, e.g. "+20 coins". Nothing is shown unless you pass it.

  Because the game lives in these slots, adding a game never changes the call layout.
*/
import { useState } from "react";

const Ic = ({ children, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const P = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  micOff: <><path d="M4 4l16 16" /><path d="M9 9v2a3 3 0 0 0 5.2 2M15 9V6a3 3 0 0 0-5.8-1" /><path d="M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.7 3M12 18v3" /></>,
  cam: <><rect x="2.5" y="6" width="13" height="12" rx="3" /><path d="m15.5 10.5 6-3v9l-6-3" /></>,
  camOff: <><rect x="2.5" y="6" width="13" height="12" rx="3" /><path d="m15.5 10.5 6-3v9l-6-3" /><path d="M3 3l18 18" /></>,
  games: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  next: <path d="M5 12h14M13 6l6 6-6 6" />,
  end: <path d="M6 6l12 12M18 6 6 18" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  wave: <><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3.5a1.4 1.4 0 0 1 2.4-1.4L7 14" /></>,
};

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function CallScreen({
  phase,                // "searching" | "connected"
  webrtc,               // the useWebRTC() object from StrangerPlay_Main
  opponent,             // { username, flag } (connected only)
  liveCount = 0,
  queueTime = 0,
  opponentLeft = false,
  games = [],           // [{ id, emoji, label }]
  proposedGame = null,  // game id the other person proposed
  onProposeGame, onAcceptGame, onDismissGame,
  onNext, onEnd, onCancel, onFindAnother,
  // ── future game slots (see header) ──
  arena = null, hud = null, myOverlay = null, theirOverlay = null, result = null,
}) {
  const [tray, setTray] = useState(false);
  const searching = phase === "searching";
  const w = webrtc;
  const name = (opponent && opponent.username) || "stranger";
  const flag = (opponent && opponent.flag) || "🌍";
  const detail = w.callState && w.callState.detail;
  const failed = w.callState && w.callState.phase === "failed";
  const route = w.callState && w.callState.phase === "connected" && w.callState.route && w.callState.route !== "unknown" ? w.callState.route : "";

  // The local <video> is mounted once and keeps living when the screen goes searching -> connected.
  // The ref callback re-attaches the camera stream every render, which is what keeps it from going black.
  const attachLocal = (el) => {
    w.localRef.current = el;
    if (el && w.stream && el.srcObject !== w.stream) { el.srcObject = w.stream; el.play().catch(() => {}); }
  };

  return (
    <div className="tzc">
      <style>{CSS}</style>

      <div className="tzc-stage">
        {/* ───────── tile 1: the stranger ───────── */}
        <div className="tzc-pane tzc-them">
          {!searching && w.remoteConnected && (
            // Rendered only once the remote stream exists; attachRemote picks the stream up on mount.
            <video ref={w.attachRemote} autoPlay playsInline className="tzc-video" />
          )}

          {searching && (
            <div className="tzc-wait tzc-shimmer">
              <div className="tzc-radar" aria-hidden="true"><i /><i /><i /><span><Ic size={26}>{P.globe}</Ic></span></div>
              <h2>Finding someone for you</h2>
              <div className="tzc-timer" role="timer" aria-label="Search time">{fmt(queueTime)}</div>
              {liveCount > 0 && <p className="tzc-sub"><b className="tzc-dot" />{liveCount.toLocaleString()} {liveCount === 1 ? "person" : "people"} online</p>}
              <p className="tzc-hint">Once you connect you can play a game together.</p>
            </div>
          )}

          {!searching && !w.remoteConnected && !opponentLeft && (
            <div className="tzc-wait tzc-shimmer">
              <div className="tzc-avatar" aria-hidden="true">{flag}</div>
              <h2>Connecting to {name}</h2>
              <p className="tzc-sub">This can take up to 25 seconds on different networks.</p>
              {detail && <p className={`tzc-detail ${failed ? "bad" : ""}`}>{detail}{failed && <span>Press NEXT to try someone else.</span>}</p>}
            </div>
          )}

          {!searching && opponentLeft && (
            <div className="tzc-wait tzc-left" role="status">
              <div className="tzc-avatar" aria-hidden="true"><Ic size={30}>{P.wave}</Ic></div>
              <h2>{name} left</h2>
              <p className="tzc-sub">Finding you someone new…</p>
              <button className="tzc-pill" onClick={onFindAnother}>Find another now</button>
            </div>
          )}

          {!searching && w.remoteConnected && w.remoteBlocked && (
            <button className="tzc-hear" onClick={w.unmuteRemote}><Ic size={16}>{P.micOff}</Ic>Tap to hear them</button>
          )}

          {!searching && (
            <div className="tzc-chip tzc-chip-tl">
              <span>{flag}</span><b>{name}</b>
              {w.remoteConnected && <i className="tzc-dot" aria-label="connected" />}
              {route && <em>{route}</em>}
            </div>
          )}

          {theirOverlay && <div className="tzc-slot">{theirOverlay}</div>}
        </div>

        {/* ───────── tile 2: you ───────── */}
        <div className="tzc-pane tzc-me">
          <video ref={attachLocal} autoPlay muted playsInline className="tzc-video tzc-mirror" />

          {!w.stream && (
            <div className="tzc-wait"><div className="tzc-avatar" aria-hidden="true"><Ic size={30}>{P.cam}</Ic></div><p className="tzc-sub">Starting your camera…</p></div>
          )}
          {w.stream && w.camOff && (
            <div className="tzc-wait tzc-camoff"><div className="tzc-avatar" aria-hidden="true"><Ic size={30}>{P.camOff}</Ic></div><p className="tzc-sub">Your camera is off</p></div>
          )}

          <div className="tzc-chip tzc-chip-tl">
            <b>You</b>
            {w.muted && <span className="tzc-muted" title="Muted"><Ic size={14}>{P.micOff}</Ic></span>}
          </div>

          {myOverlay && <div className="tzc-slot">{myOverlay}</div>}
        </div>

        {/* ───────── game layers (empty until a game is plugged in) ───────── */}
        {arena && <div className="tzc-arena">{arena}</div>}
        {hud && <div className="tzc-hud">{hud}</div>}

        {result && (
          <div className="tzc-result" role="status">
            <div className={`tzc-result-card ${result.won ? "win" : "lose"}`}>
              <b>{result.title || (result.won ? "You win" : "You lose")}</b>
              {result.detail && <span>{result.detail}</span>}
            </div>
          </div>
        )}

        {/* game proposal from the other person */}
        {!searching && proposedGame && (
          <div className="tzc-propose" role="dialog" aria-label="Game invitation">
            <small>{name} wants to play</small>
            <b>{String(proposedGame).replace(/_/g, " ")}</b>
            <div>
              <button className="tzc-pill main" onClick={onAcceptGame}>Accept</button>
              <button className="tzc-pill" onClick={onDismissGame}>Not now</button>
            </div>
          </div>
        )}

        {/* games tray */}
        {!searching && tray && games.length > 0 && (
          <div className="tzc-tray" role="menu" aria-label="Pick a game">
            {games.map((g) => (
              <button key={g.id} role="menuitem" onClick={() => { setTray(false); onProposeGame && onProposeGame(g.id); }}>
                <span>{g.emoji}</span>{g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ───────── control bar ───────── */}
      <div className="tzc-bar">
        <button className={`tzc-round ${w.muted ? "off" : ""}`} onClick={w.toggleMute} aria-label={w.muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={!!w.muted}>
          <Ic>{w.muted ? P.micOff : P.mic}</Ic>
        </button>
        <button className={`tzc-round ${w.camOff ? "off" : ""}`} onClick={w.toggleCam} aria-label={w.camOff ? "Turn camera on" : "Turn camera off"} aria-pressed={!!w.camOff}>
          <Ic>{w.camOff ? P.camOff : P.cam}</Ic>
        </button>

        {searching ? (
          <button className="tzc-pill tzc-cancel" onClick={onCancel}>Cancel</button>
        ) : (
          <>
            {games.length > 0 && (
              <button className={`tzc-round ${tray ? "on" : ""}`} onClick={() => setTray((t) => !t)} aria-label="Games" aria-expanded={tray}>
                <Ic>{P.games}</Ic>
              </button>
            )}
            <button className="tzc-next" onClick={onNext}>Next<Ic size={20}>{P.next}</Ic></button>
            <button className="tzc-round tzc-end" onClick={onEnd} aria-label="End call"><Ic>{P.end}</Ic></button>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.tzc{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--sp-void);color:var(--sp-plat);font-family:'Inter',system-ui,sans-serif;padding-top:env(safe-area-inset-top,0px)}
.tzc *{box-sizing:border-box}
.tzc button{font:inherit;cursor:pointer}

/* stage = two equal tiles (portrait: stacked, landscape: side by side) */
.tzc-stage{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:10px 10px 4px}
@media (orientation:landscape) and (min-width:700px){.tzc-stage{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr)}}
.tzc-pane{position:relative;min-width:0;min-height:0;overflow:hidden;border-radius:22px;background:var(--sp-surface);border:1px solid var(--sp-rim)}
.tzc-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#000}
.tzc-mirror{transform:scaleX(-1)}
.tzc-slot{position:absolute;inset:0;z-index:6;pointer-events:none}

/* waiting / placeholder content inside a tile */
.tzc-wait{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px;text-align:center;background:var(--sp-surface)}
.tzc-camoff{background:var(--sp-surface2)}
.tzc-wait h2{margin:6px 0 0;font-size:clamp(19px,3.2vw,26px);font-weight:700;letter-spacing:-.01em;line-height:1.2}
.tzc-sub{margin:0;color:var(--sp-ash);font-size:14px;line-height:1.5;display:flex;align-items:center;justify-content:center;gap:8px}
.tzc-hint{margin:10px 0 0;max-width:30ch;color:var(--sp-ash);font-size:13px;line-height:1.5}
.tzc-timer{font-variant-numeric:tabular-nums;font-size:15px;font-weight:600;color:var(--sp-signal)}
.tzc-detail{margin:6px 0 0;max-width:34ch;color:var(--sp-ash);font-size:12.5px;line-height:1.5}
.tzc-detail.bad{color:var(--sp-live)}
.tzc-detail span{display:block;margin-top:4px;color:var(--sp-ash)}
.tzc-avatar{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:color-mix(in srgb,var(--sp-signal) 14%,var(--sp-surface2));color:var(--sp-signal);font-size:28px;line-height:1}
.tzc-left{background:color-mix(in srgb,var(--sp-void) 88%,transparent);backdrop-filter:blur(8px)}
.tzc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--sp-ice);flex:none}

/* searching: soft shimmer on the empty stranger tile + sonar rings (loading indicators only) */
.tzc-shimmer::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(105deg,transparent 30%,color-mix(in srgb,var(--sp-signal) 7%,transparent) 50%,transparent 70%);background-size:220% 100%;animation:tzc-sheen 2.6s ease-in-out infinite}
.tzc-radar{position:relative;display:grid;place-items:center;width:104px;height:104px;margin-bottom:6px}
.tzc-radar i{position:absolute;inset:0;border-radius:50%;border:2px solid var(--sp-signal);opacity:0;animation:tzc-ping 2.4s cubic-bezier(.2,.6,.3,1) infinite}
.tzc-radar i:nth-child(2){animation-delay:.8s}.tzc-radar i:nth-child(3){animation-delay:1.6s}
.tzc-radar span{position:relative;display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:var(--sp-signal);color:#fff;box-shadow:0 6px 18px color-mix(in srgb,var(--sp-signal) 35%,transparent)}
@keyframes tzc-ping{0%{transform:scale(.55);opacity:.55}100%{transform:scale(1.25);opacity:0}}
@keyframes tzc-sheen{0%{background-position:120% 0}100%{background-position:-60% 0}}
@media (prefers-reduced-motion:reduce){.tzc-radar i,.tzc-shimmer::before{animation:none}.tzc-radar i:first-child{opacity:.3;transform:scale(.9)}}

/* name chips + small badges */
.tzc-chip{position:absolute;z-index:5;display:flex;align-items:center;gap:7px;max-width:calc(100% - 24px);padding:6px 12px;border-radius:999px;background:color-mix(in srgb,#000 55%,transparent);backdrop-filter:blur(10px);color:#fff;font-size:13px}
.tzc-chip-tl{top:12px;left:12px}
.tzc-chip b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tzc-chip em{font-style:normal;font-size:11px;opacity:.7}
.tzc-muted{display:inline-flex;color:#ff7b8f}
.tzc-hear{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:7;display:flex;align-items:center;gap:7px;padding:9px 16px;border:0;border-radius:999px;background:var(--sp-signal);color:#fff;font-size:13px;font-weight:600}

/* game layers */
.tzc-arena{position:absolute;inset:0;z-index:8;pointer-events:none}
.tzc-arena>*{pointer-events:auto}
.tzc-hud{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;pointer-events:none}
.tzc-result{position:absolute;inset:0;z-index:12;display:grid;place-items:center;padding:20px;background:color-mix(in srgb,#000 45%,transparent);backdrop-filter:blur(4px)}
.tzc-result-card{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:220px;padding:24px 34px;border-radius:22px;background:var(--sp-surface);border:2px solid var(--sp-rim);text-align:center}
.tzc-result-card b{font-size:clamp(28px,6vw,40px);font-weight:800;letter-spacing:-.02em}
.tzc-result-card span{color:var(--sp-ash);font-size:16px;font-weight:600}
.tzc-result-card.win{border-color:var(--sp-ice)}.tzc-result-card.win b{color:var(--sp-ice)}
.tzc-result-card.lose{border-color:var(--sp-live)}.tzc-result-card.lose b{color:var(--sp-live)}

/* game invitation + tray */
.tzc-propose{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:14;display:flex;flex-direction:column;align-items:center;gap:10px;min-width:230px;padding:20px 24px;border-radius:20px;background:var(--sp-surface);border:1px solid var(--sp-rim);box-shadow:0 18px 50px rgba(0,0,0,.45);text-align:center}
.tzc-propose small{color:var(--sp-ash);font-size:13px}
.tzc-propose b{font-size:21px;font-weight:700;text-transform:capitalize}
.tzc-propose div{display:flex;gap:8px}
.tzc-tray{position:absolute;left:12px;right:12px;bottom:10px;z-index:14;display:flex;gap:8px;overflow-x:auto;padding:10px;border-radius:18px;background:color-mix(in srgb,var(--sp-surface) 94%,transparent);backdrop-filter:blur(12px);border:1px solid var(--sp-rim);scrollbar-width:none}
.tzc-tray::-webkit-scrollbar{display:none}
.tzc-tray button{flex:none;display:flex;align-items:center;gap:7px;padding:9px 14px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-surface2);color:var(--sp-plat);font-size:13px;font-weight:600;white-space:nowrap}
.tzc-tray button:hover{border-color:var(--sp-signal);color:var(--sp-signal)}

/* control bar */
.tzc-bar{flex:none;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px))}
.tzc-round{display:grid;place-items:center;flex:none;width:52px;height:52px;border-radius:50%;border:1px solid var(--sp-rim);background:var(--sp-surface);color:var(--sp-plat);transition:background .15s,border-color .15s}
.tzc-round:hover{background:var(--sp-surface2)}
.tzc-round.off{background:var(--sp-live);border-color:var(--sp-live);color:#fff}
.tzc-round.on{background:var(--sp-signal);border-color:var(--sp-signal);color:#fff}
.tzc-end{color:var(--sp-live);border-color:color-mix(in srgb,var(--sp-live) 45%,var(--sp-rim))}
.tzc-end:hover{background:var(--sp-live);color:#fff;border-color:var(--sp-live)}
.tzc-next{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 30px;border:0;border-radius:999px;background:var(--sp-signal);color:#fff;font-size:16px;font-weight:700;transition:background .15s}
.tzc-next:hover{background:color-mix(in srgb,var(--sp-signal) 88%,#000)}
.tzc-pill{display:inline-flex;align-items:center;justify-content:center;padding:10px 20px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-surface2);color:var(--sp-plat);font-size:14px;font-weight:600}
.tzc-pill:hover{background:var(--sp-rim)}
.tzc-pill.main{border-color:transparent;background:var(--sp-signal);color:#fff}
.tzc-pill.main:hover{background:color-mix(in srgb,var(--sp-signal) 88%,#000)}
.tzc-cancel{height:52px;padding:0 30px;font-size:16px}
.tzc button:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}
@media (max-width:420px){.tzc-bar{gap:9px}.tzc-round{width:48px;height:48px}.tzc-next{height:48px;padding:0 22px}}
`;
