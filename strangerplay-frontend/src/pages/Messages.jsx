/*
  Messages.jsx — private 1-to-1 messages.

  Layout (Instagram / TikTok style): inbox with a search box and a "Recently met" strip of faces, rows with
  a blue dot for unread; chat with grouped bubbles, the other person's photo next to their last bubble, and a
  rounded composer whose send button appears when you type. On phones an open chat fills the whole screen
  (back arrow at the top-left); on a computer the inbox and the chat sit side by side.

  Inbox + chat. New messages arrive live (Socket.IO event "dm:new"); unread counts are kept on
  the server, so they are right on every device. Text only, up to 1000 characters.

  Who can you message? The server decides: by default people you have met on a call (or already
  chat with). Everything here just shows what the server says — a message the server refuses
  is shown as failed with the reason.

  Props:
    me             the signed-in user, or null (guests are asked to sign in)
    token          sign-in token
    openWith       username to open straight away (e.g. from the "Message" button on a card)
    onOpenHandled  fn — called once openWith has been used
    onUnread       fn(total) — keeps the app's unread badge in sync
    onLogin        fn — guests
    onViewProfile  fn(username) — open that player's card
*/
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { socket } from "../socket";

const API = import.meta.env.VITE_API_URL || "https://extrobe-on.onrender.com";
const imgSrc = (a) => (!a ? "" : /^https?:\/\//.test(a) ? a : API + a);
const MAX = 1000;
const REPORT_REASONS = [["spam", "Spam"], ["harassment", "Harassment"], ["inappropriate", "Inappropriate"], ["underage", "Looks under 18"], ["other", "Something else"]];
const REASON_TEXT = {
  not_met: "You can message people after you’ve met on a call.",
  blocked_by_me: "You blocked this player. Unblock them to send messages.",
  unavailable: "You can’t message this player.",
  self: "This is you.",
};

async function api(path, { method = "GET", token, body } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || "Something went wrong. Try again."); e.reason = data.reason; e.status = r.status; throw e; }
  return data;
}

/* "2m", "Yesterday", "Oct 4" */
function shortTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function Avatar({ person, size = 44 }) {
  const [bad, setBad] = useState(false);
  const src = imgSrc(person && person.avatar);
  useEffect(() => setBad(false), [src]);
  if (src && !bad) return <img className="tmsg-av" src={src} alt="" width={size} height={size} onError={() => setBad(true)} referrerPolicy="no-referrer" style={{ width: size, height: size }} />;
  const letter = ((person && (person.name || person.username)) || "?").trim().charAt(0).toUpperCase();
  return <span className="tmsg-av tmsg-ini" style={{ width: size, height: size, fontSize: size * 0.42 }}>{letter}</span>;
}
const Ic = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export default function Messages({ me, token, openWith, onOpenHandled, onUnread, onLogin, onViewProfile }) {
  const [convos, setConvos] = useState([]);
  const [listState, setListState] = useState("loading");     // loading | ok | error
  const [policy, setPolicy] = useState("met");
  const [active, setActive] = useState(null);                // username of the open chat
  const [thread, setThread] = useState(null);                // { state, peer, canMessage, reason, blockedByMe, messages, hasMore }
  const [text, setText] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [met, setMet] = useState(null);
  const [findName, setFindName] = useState("");
  const [findErr, setFindErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [report, setReport] = useState(null);                // { reason, details, busy }
  const [toast, setToast] = useState("");
  const [q, setQ] = useState("");                            // inbox search

  const activeRef = useRef(null); activeRef.current = active;
  const listRef = useRef(null), stickRef = useRef(true), keepRef = useRef(null), tmpN = useRef(0), toastT = useRef(null), taRef = useRef(null);
  const say = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2600); };
  useEffect(() => () => clearTimeout(toastT.current), []);

  /* ── inbox ── */
  const loadConvos = useCallback(async () => {
    try {
      const d = await api("/api/messages/conversations", { token });
      setConvos(d.conversations || []); setPolicy(d.policy || "met"); setListState("ok");
    } catch { setListState((s) => (s === "ok" ? s : "error")); }
  }, [token]);
  useEffect(() => { if (me && token) loadConvos(); }, [me && me.username, token, loadConvos]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (listState === "ok" && onUnread) onUnread(convos.reduce((n, c) => n + (c.unread || 0), 0)); }, [convos, listState]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* "Recently met" faces at the top of the inbox */
  useEffect(() => {
    if (!me || !token) return;
    let dead = false;
    api("/api/messages/met", { token }).then((d) => { if (!dead) setMet(d.people || []); }).catch(() => { if (!dead) setMet((m) => m || []); });
    return () => { dead = true; };
  }, [me && me.username, token]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── message list helpers ── */
  const setMessages = (fn) => setThread((t) => (t ? { ...t, messages: fn(t.messages) } : t));
  const addMsg = (m) => setMessages((list) => (list.some((x) => x._id === m._id) ? list : [...list, m]));
  const bumpConvo = (who, peer, m) => setConvos((list) => {
    const i = list.findIndex((c) => c.with.username === who), isOpen = activeRef.current === who;
    const base = i >= 0 ? list[i] : { with: peer, unread: 0 };
    const item = { ...base, with: peer || base.with, lastText: m.text.slice(0, 120), lastFromMe: m.fromMe, lastAt: m.createdAt, unread: m.fromMe || isOpen ? 0 : (base.unread || 0) + 1 };
    return [item, ...list.filter((_, k) => k !== i)];
  });

  /* ── live delivery ── */
  useEffect(() => {
    const onNew = (p) => {
      if (!p || !p.message || !p.with) return;
      bumpConvo(p.with, p.peer, p.message);
      if (activeRef.current === p.with) {
        addMsg(p.message);
        if (!p.message.fromMe) api(`/api/messages/with/${encodeURIComponent(p.with)}/read`, { method: "POST", token }).catch(() => {});
      }
    };
    socket.on("dm:new", onNew);
    return () => socket.off("dm:new", onNew);
  }, [token]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── open / close a chat ── */
  async function openThread(username) {
    const u = String(username || "").trim().replace(/^@/, "").toLowerCase();
    if (!u) return;
    setActive(u); setMenu(false); setConfirmBlock(false); setNewOpen(false); setText(""); stickRef.current = true;
    setThread({ state: "loading", messages: [] });
    try {
      const d = await api(`/api/messages/with/${encodeURIComponent(u)}`, { token });
      if (activeRef.current !== u) return;
      setThread({ state: "ok", ...d });
      setConvos((l) => l.map((c) => (c.with.username === u ? { ...c, unread: 0 } : c)));
    } catch (e) {
      if (activeRef.current === u) setThread({ state: "error", error: e.message, messages: [] });
    }
  }
  function closeThread() { setActive(null); setThread(null); setMenu(false); loadConvos(); }
  useEffect(() => { if (openWith && me) { openThread(openWith); onOpenHandled && onOpenHandled(); } }, [openWith]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEarlier() {
    if (!thread || !thread.messages.length) return;
    const el = listRef.current; keepRef.current = el ? el.scrollHeight : 0;
    try {
      const d = await api(`/api/messages/with/${encodeURIComponent(active)}?before=${encodeURIComponent(thread.messages[0].createdAt)}`, { token });
      setThread((t) => (t ? { ...t, hasMore: d.hasMore, messages: [...d.messages, ...t.messages] } : t));
    } catch (e) { keepRef.current = null; say(e.message); }
  }

  /* keep the view at the newest message (unless the person scrolled up to read) */
  useLayoutEffect(() => {
    const el = listRef.current; if (!el) return;
    if (keepRef.current != null) { el.scrollTop += el.scrollHeight - keepRef.current; keepRef.current = null; return; }
    const last = thread && thread.messages[thread.messages.length - 1];
    if (stickRef.current || (last && last.fromMe)) el.scrollTop = el.scrollHeight;
  }, [thread && thread.messages.length, active]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── sending ── */
  async function send(retryOf) {
    const body = (retryOf ? retryOf.text : text).trim();
    if (!body || !thread || !thread.canMessage) return;
    const tmp = { _id: "tmp-" + ++tmpN.current, fromMe: true, text: body, createdAt: new Date().toISOString(), pending: true };
    if (retryOf) setMessages((l) => l.filter((m) => m._id !== retryOf._id));
    else { setText(""); if (taRef.current) taRef.current.style.height = "auto"; }
    stickRef.current = true;
    setMessages((l) => [...l, tmp]);
    try {
      const r = await api(`/api/messages/with/${encodeURIComponent(active)}`, { method: "POST", token, body: { text: body } });
      setMessages((l) => (l.some((m) => m._id === r.message._id) ? l.filter((m) => m._id !== tmp._id) : l.map((m) => (m._id === tmp._id ? r.message : m))));
      bumpConvo(active, thread.peer, r.message);
    } catch (e) {
      setMessages((l) => l.map((m) => (m._id === tmp._id ? { ...m, pending: false, failed: true, error: e.message } : m)));
      if (e.reason) setThread((t) => (t ? { ...t, canMessage: false, reason: e.reason, blockedByMe: e.reason === "blocked_by_me" } : t));
    }
  }
  // Enter sends on computers; on phones Enter adds a new line (there is a Send button). "pointer: coarse" = the MAIN input is a finger,
  // so touch-screen laptops (mouse + keyboard) still send with Enter.
  const isTouch = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey && !isTouch) { e.preventDefault(); send(); } };
  const grow = (e) => { const el = e.target; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; };

  /* ── new message sheet ── */
  async function openNew() {
    setNewOpen(true); setFindErr(""); setFindName("");
    try { setMet((await api("/api/messages/met", { token })).people || []); } catch { setMet([]); }
  }

  /* ── block / report ── */
  async function toggleBlock() {
    const blocked = thread.blockedByMe;
    try {
      await api(`/api/user/${encodeURIComponent(active)}/block`, { method: blocked ? "DELETE" : "POST", token });
      setThread((t) => ({ ...t, blockedByMe: !blocked, canMessage: blocked ? t.reason !== "not_met" : false, reason: blocked ? (t.reason === "blocked_by_me" ? null : t.reason) : "blocked_by_me" }));
      say(blocked ? "Unblocked" : "Blocked — they can’t message you");
      if (blocked) openThread(active);
    } catch (e) { say(e.message); }
    setMenu(false); setConfirmBlock(false);
  }
  async function sendReport() {
    setReport((r) => ({ ...r, busy: true }));
    try {
      await api("/api/report", { method: "POST", token, body: { username: active, reason: report.reason, details: report.details } });
      setReport(null); say("Report sent. Thank you.");
    } catch (e) { setReport((r) => ({ ...r, busy: false, error: e.message })); }
  }

  if (!me) {
    return (
      <div className="tmsg-wrap"><style>{CSS}</style>
        <div className="tmsg-empty tmsg-solo"><div className="tmsg-bigic"><Ic size={30}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></Ic></div>
          <h2>Messages</h2><p>Sign in to chat with people you’ve met.</p>
          <button className="tmsg-btn tmsg-solid" onClick={onLogin}>Sign in</button></div>
      </div>
    );
  }

  const peer = thread && thread.peer;
  const msgs = (thread && thread.messages) || [];
  const ql = q.trim().toLowerCase();
  const shown = ql ? convos.filter((c) => (c.with.name || "").toLowerCase().includes(ql) || c.with.username.toLowerCase().includes(ql)) : convos;
  const faces = met || [];
  const sameDay = (x, y) => new Date(x.createdAt).toDateString() === new Date(y.createdAt).toDateString();
  const close = (x, y) => Math.abs(new Date(y.createdAt) - new Date(x.createdAt)) < 5 * 60000;

  return (
    <div className="tmsg-wrap">
      <style>{CSS}</style>
      <div className={`tmsg ${active ? "has-active" : ""}`}>

        {/* ═══ inbox ═══ */}
        <aside className="tmsg-list" aria-label="Conversations">
          <header className="tmsg-lh"><h1>Messages</h1>
            <button className="tmsg-ic" onClick={openNew} aria-label="New message" title="New message"><Ic><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Ic></button>
          </header>

          <div className="tmsg-searchrow">
            <label className="tmsg-search">
              <Ic size={18}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Ic>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search your messages" autoCapitalize="none" autoCorrect="off" />
            </label>
          </div>

          {faces.length > 0 && (
            <div className="tmsg-faces" aria-label="Recently met">
              <h3>Recently met</h3>
              <div className="tmsg-strip">
                {faces.map((p) => (
                  <button key={p.username} className="tmsg-face" onClick={() => openThread(p.username)} aria-label={`Chat with ${p.name || p.username}`}>
                    <span className="tmsg-ring"><Avatar person={p} size={58} /></span>
                    <span>{(p.name || p.username).split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="tmsg-rows">
            {listState === "loading" && <p className="tmsg-note">Loading…</p>}
            {listState === "error" && <p className="tmsg-note">Couldn’t load your messages. <button className="tmsg-link" onClick={loadConvos}>Try again</button></p>}
            {listState === "ok" && convos.length === 0 && (
              <div className="tmsg-empty"><div className="tmsg-bigic"><Ic size={30}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></Ic></div>
                <h2>No messages yet</h2>
                <p>{policy === "met" ? "After you meet someone on a call, you can keep chatting here." : "Message anyone by their username."}</p>
                <button className="tmsg-btn tmsg-solid" onClick={openNew}>New message</button></div>
            )}
            {listState === "ok" && convos.length > 0 && shown.length === 0 && <p className="tmsg-note">No chats match “{q.trim()}”.</p>}
            {shown.map((c) => (
              <button key={c.with.username} className={`tmsg-row ${active === c.with.username ? "on" : ""} ${c.unread ? "unread" : ""}`} onClick={() => openThread(c.with.username)}>
                <Avatar person={c.with} size={56} />
                <span className="tmsg-rb">
                  <span className="tmsg-rt"><b>{c.with.name || c.with.username}</b></span>
                  <span className="tmsg-rp"><span>{c.lastFromMe ? "You: " : ""}{c.lastText}</span><time>· {shortTime(c.lastAt)}</time></span>
                </span>
                {c.unread > 0 && <i className="tmsg-dot" aria-label={`${c.unread} unread`} />}
              </button>
            ))}
          </div>
        </aside>

        {/* ═══ chat ═══ */}
        <section className="tmsg-thread" aria-label="Chat">
          {!active ? (
            <div className="tmsg-empty tmsg-pick"><div className="tmsg-bigic"><Ic size={30}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></Ic></div>
              <h2>Your messages</h2><p>Pick a conversation, or start a new one.</p>
              <button className="tmsg-btn tmsg-solid" onClick={openNew}>New message</button></div>
          ) : (
            <>
              <header className="tmsg-th">
                <button className="tmsg-ic tmsg-back" onClick={closeThread} aria-label="Back to messages"><Ic size={24}><path d="m15 18-6-6 6-6" /></Ic></button>
                <button className="tmsg-who" onClick={() => onViewProfile && onViewProfile(active)} aria-label={`Open ${active}'s profile`}>
                  <Avatar person={peer || { username: active }} size={40} />
                  <span><b>{(peer && peer.name) || active}</b><small>@{active}</small></span>
                </button>
                <div className="tmsg-menuwrap">
                  <button className="tmsg-ic" onClick={() => { setMenu(!menu); setConfirmBlock(false); }} aria-label="Chat options" aria-expanded={menu}><Ic><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></Ic></button>
                  {menu && (
                    <div className="tmsg-menu" role="menu">
                      <button role="menuitem" onClick={() => { setMenu(false); onViewProfile && onViewProfile(active); }}>View profile</button>
                      {confirmBlock
                        ? <button role="menuitem" className="tmsg-danger" onClick={toggleBlock}>Tap again to {thread && thread.blockedByMe ? "unblock" : "block"}</button>
                        : <button role="menuitem" onClick={() => (thread && thread.blockedByMe ? toggleBlock() : setConfirmBlock(true))}>{thread && thread.blockedByMe ? "Unblock" : "Block"}</button>}
                      <button role="menuitem" className="tmsg-danger" onClick={() => { setMenu(false); setReport({ reason: "", details: "" }); }}>Report</button>
                    </div>
                  )}
                </div>
              </header>

              <div className="tmsg-msgs" ref={listRef} onScroll={(e) => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
                {thread && thread.state === "loading" && <p className="tmsg-note">Loading…</p>}
                {thread && thread.state === "error" && <p className="tmsg-note">{thread.error} <button className="tmsg-link" onClick={() => openThread(active)}>Try again</button></p>}
                {thread && thread.hasMore && <button className="tmsg-more" onClick={loadEarlier}>Load earlier messages</button>}

                {thread && thread.state === "ok" && !thread.hasMore && (
                  <div className="tmsg-intro">
                    <Avatar person={peer || { username: active }} size={84} />
                    <b>{(peer && peer.name) || active}</b>
                    <small>@{active}</small>
                    <button className="tmsg-btn tmsg-ghost" onClick={() => onViewProfile && onViewProfile(active)}>View profile</button>
                    {msgs.length === 0 && <p>No messages yet. Say hi 👋</p>}
                  </div>
                )}

                {msgs.map((m, i) => {
                  const p = msgs[i - 1], n = msgs[i + 1];
                  const newDay = !p || !sameDay(p, m);
                  const joinPrev = !!p && !newDay && p.fromMe === m.fromMe && close(p, m);
                  const joinNext = !!n && sameDay(m, n) && n.fromMe === m.fromMe && close(m, n);
                  return (
                    <div key={m._id}>
                      {newDay && <div className="tmsg-day"><span>{dayLabel(m.createdAt)}</span></div>}
                      <div className={`tmsg-line ${m.fromMe ? "me" : "them"} ${joinPrev ? "jp" : ""} ${joinNext ? "jn" : ""}`}>
                        {!m.fromMe && <span className="tmsg-sp">{!joinNext && <Avatar person={peer || { username: active }} size={28} />}</span>}
                        <div className={`tmsg-b ${m.failed ? "failed" : ""}`}><p>{m.text}</p></div>
                      </div>
                      {!joinNext && !m.failed && <div className={`tmsg-t ${m.fromMe ? "me" : ""}`}>{m.pending ? "Sending…" : shortTime(m.createdAt)}</div>}
                      {m.failed && <div className="tmsg-fail">{m.error || "Couldn’t send."} <button className="tmsg-link" onClick={() => send(m)}>Retry</button></div>}
                    </div>
                  );
                })}
              </div>

              {thread && thread.state === "ok" && !thread.canMessage ? (
                <div className="tmsg-lock">{REASON_TEXT[thread.reason] || "You can’t message this player."}
                  {thread.reason === "blocked_by_me" && <button className="tmsg-link" onClick={toggleBlock}>Unblock</button>}</div>
              ) : (
                <form className="tmsg-comp" onSubmit={(e) => { e.preventDefault(); send(); }}>
                  <div className="tmsg-pill">
                    <textarea ref={taRef} rows={1} value={text} maxLength={MAX} placeholder="Message…" aria-label="Message"
                      disabled={!thread || thread.state !== "ok"} onChange={(e) => setText(e.target.value)} onInput={grow} onKeyDown={onKey} />
                    {text.length > MAX - 150 && <span className="tmsg-ctr">{MAX - text.length}</span>}
                    {text.trim() && thread && thread.state === "ok" && (
                      <button className="tmsg-send" type="submit" aria-label="Send message"><Ic size={20}><path d="M12 19V5M5 12l7-7 7 7" /></Ic></button>
                    )}
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      {/* ═══ new message ═══ */}
      {newOpen && (
        <div className="tmsg-scrim" onPointerDown={(e) => e.target === e.currentTarget && setNewOpen(false)}>
          <div className="tmsg-sheet" role="dialog" aria-modal="true" aria-label="New message">
            <div className="tmsg-sh"><b>New message</b><button className="tmsg-ic" onClick={() => setNewOpen(false)} aria-label="Close">×</button></div>
            <form onSubmit={async (e) => { e.preventDefault(); setFindErr(""); await openThread(findName); }} className="tmsg-find">
              <input value={findName} onChange={(e) => { setFindName(e.target.value); setFindErr(""); }} placeholder="Username" aria-label="Username" autoCapitalize="none" autoCorrect="off" maxLength={31} autoFocus />
              <button className="tmsg-btn tmsg-solid" type="submit" disabled={!findName.trim()}>Chat</button>
            </form>
            {findErr && <p className="tmsg-err">{findErr}</p>}
            <h3>{policy === "met" ? "Recently met" : "People you’ve met"}</h3>
            {met === null ? <p className="tmsg-note">Loading…</p> : met.length === 0 ? (
              <p className="tmsg-note">{policy === "met" ? "Nobody yet. After a call with someone, they show up here so you can keep chatting." : "Nobody yet."}</p>
            ) : (
              <ul className="tmsg-met">
                {met.map((p) => (
                  <li key={p.username}><button onClick={() => openThread(p.username)}><Avatar person={p} size={40} /><span><b>{p.name || p.username}</b><small>@{p.username} · {shortTime(p.lastAt)}</small></span></button></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ═══ report ═══ */}
      {report && (
        <div className="tmsg-scrim" onPointerDown={(e) => e.target === e.currentTarget && setReport(null)}>
          <div className="tmsg-sheet" role="dialog" aria-modal="true" aria-label="Report">
            <div className="tmsg-sh"><b>Report @{active}</b><button className="tmsg-ic" onClick={() => setReport(null)} aria-label="Close">×</button></div>
            <p className="tmsg-note">What’s wrong? Only you and the team see this.</p>
            <div className="tmsg-chips">
              {REPORT_REASONS.map(([k, l]) => <button key={k} type="button" className={report.reason === k ? "on" : ""} onClick={() => setReport({ ...report, reason: k })} aria-pressed={report.reason === k}>{l}</button>)}
            </div>
            <textarea className="tmsg-det" rows={3} maxLength={300} placeholder="Add details (optional)" value={report.details} onChange={(e) => setReport({ ...report, details: e.target.value })} aria-label="Details" />
            {report.error && <p className="tmsg-err">{report.error}</p>}
            <div className="tmsg-save"><button className="tmsg-btn tmsg-ghost" onClick={() => setReport(null)}>Cancel</button>
              <button className="tmsg-btn tmsg-solid" onClick={sendReport} disabled={!report.reason || report.busy}>{report.busy ? "Sending…" : "Send report"}</button></div>
          </div>
        </div>
      )}

      {toast && <div className="tmsg-toast" role="status">{toast}</div>}
    </div>
  );
}

/* ───────── styles — theme variables only, no motion ───────── */
const CSS = `
.tmsg-wrap{max-width:1020px;margin:0 auto;color:var(--sp-plat);font-family:'Inter',system-ui,sans-serif}
.tmsg-wrap *{box-sizing:border-box}
.tmsg-wrap button{font:inherit;color:inherit;cursor:pointer}
.tmsg{display:grid;grid-template-columns:370px minmax(0,1fr);height:min(780px,calc(100dvh - 130px));border:1px solid var(--sp-rim);border-radius:16px;background:var(--sp-surface);overflow:hidden}
.tmsg-list{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--sp-rim)}
.tmsg-thread{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--sp-surface)}

/* inbox */
.tmsg-lh{display:flex;align-items:center;gap:8px;padding:14px 16px 8px}
.tmsg-lh h1{flex:1;margin:0;font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;letter-spacing:-.3px}
.tmsg-wrap .tmsg-ic{display:grid;place-items:center;flex:none;width:40px;height:40px;border:0;border-radius:50%;background:none;color:var(--sp-plat);font-size:22px;line-height:1}
.tmsg-wrap .tmsg-ic:hover{background:var(--sp-void)}
.tmsg-searchrow{padding:4px 16px 10px}
.tmsg-search{display:flex;align-items:center;gap:10px;height:40px;padding:0 14px;border-radius:12px;background:var(--sp-void);color:var(--sp-ghost)}
.tmsg-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;color:var(--sp-plat);font:inherit;font-size:15px}
.tmsg-search input::placeholder{color:var(--sp-ghost)}
.tmsg-faces{padding:2px 0 8px}
.tmsg-faces h3{margin:0 16px 8px;color:var(--sp-ash);font-size:13px;font-weight:600}
.tmsg-strip{display:flex;gap:14px;overflow-x:auto;padding:2px 16px 4px;scrollbar-width:none}
.tmsg-strip::-webkit-scrollbar{display:none}
.tmsg-wrap .tmsg-face{flex:none;width:66px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:0;border:0;background:none;font-size:12px;color:var(--sp-ash)}
.tmsg-face>span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tmsg-ring{display:grid;place-items:center;padding:3px;border-radius:50%;background:linear-gradient(135deg,var(--sp-signal),color-mix(in srgb,var(--sp-signal) 40%,#a855f7))}
.tmsg-ring .tmsg-av{border:2px solid var(--sp-surface)}
.tmsg-rows{flex:1;min-height:0;overflow:auto;padding-bottom:6px}
.tmsg-wrap .tmsg-row{display:flex;align-items:center;gap:12px;width:100%;padding:9px 16px;border:0;background:none;text-align:left}
.tmsg-wrap .tmsg-row:hover{background:var(--sp-void)}
.tmsg-wrap .tmsg-row.on{background:color-mix(in srgb,var(--sp-signal) 9%,transparent)}
.tmsg-av{display:block;flex:none;border-radius:50%;object-fit:cover}
.tmsg-ini{display:grid;place-items:center;background:var(--sp-signal);color:#fff;font-weight:700;font-family:'Space Grotesk',sans-serif}
.tmsg-rb{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.tmsg-rt b{display:block;font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tmsg-rp{display:flex;gap:5px;color:var(--sp-ash);font-size:14px;min-width:0}
.tmsg-rp span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tmsg-rp time{flex:none;white-space:nowrap}
.tmsg-row.unread .tmsg-rt b{font-weight:700}
.tmsg-row.unread .tmsg-rp{color:var(--sp-plat);font-weight:600}
.tmsg-dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--sp-signal)}

/* chat header */
.tmsg-th{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--sp-rim);min-height:62px;background:var(--sp-surface)}
.tmsg-back{display:none!important}
.tmsg-wrap .tmsg-who{display:flex;align-items:center;gap:10px;flex:1;min-width:0;padding:4px 6px;border:0;border-radius:12px;background:none;text-align:left}
.tmsg-who:hover{background:var(--sp-void)}
.tmsg-who span{display:flex;flex-direction:column;min-width:0}
.tmsg-who b{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tmsg-who small{color:var(--sp-ash);font-size:12px}
.tmsg-menuwrap{position:relative}
.tmsg-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:5;min-width:190px;padding:6px;border:1px solid var(--sp-rim);border-radius:14px;background:var(--sp-surface);box-shadow:0 10px 28px rgba(0,0,0,.2)}
.tmsg-wrap .tmsg-menu button{display:block;width:100%;padding:11px 12px;border:0;border-radius:9px;background:none;text-align:left;font-size:14px}
.tmsg-wrap .tmsg-menu button:hover{background:var(--sp-void)}
.tmsg-wrap .tmsg-danger{color:var(--sp-live)}

/* messages */
.tmsg-msgs{flex:1;min-height:0;overflow:auto;padding:12px 14px 8px;display:flex;flex-direction:column;background:var(--sp-surface)}
.tmsg-intro{display:flex;flex-direction:column;align-items:center;gap:2px;padding:22px 12px 18px;text-align:center}
.tmsg-intro b{margin-top:8px;font-size:18px;font-weight:700}
.tmsg-intro small{margin-bottom:10px;color:var(--sp-ash);font-size:14px}
.tmsg-intro p{margin:14px 0 0;color:var(--sp-ash);font-size:14px}
.tmsg-day{display:flex;justify-content:center;margin:14px 0 8px}
.tmsg-day span{color:var(--sp-ghost);font-size:12px;font-weight:600}
.tmsg-line{display:flex;align-items:flex-end;gap:8px;margin-top:8px}
.tmsg-line.jp{margin-top:2px}
.tmsg-line.me{justify-content:flex-end}
.tmsg-sp{flex:none;width:28px;height:28px}
.tmsg-b{max-width:min(76%,480px);padding:9px 14px;border-radius:20px;overflow-wrap:anywhere}
.tmsg-b p{margin:0;font-size:15px;line-height:1.4;white-space:pre-wrap}
.tmsg-line.me .tmsg-b{background:linear-gradient(135deg,var(--sp-signal),color-mix(in srgb,var(--sp-signal) 72%,#000));color:#fff}
.tmsg-line.them .tmsg-b{background:var(--sp-void);color:var(--sp-plat)}
.tmsg-line.me.jp .tmsg-b{border-top-right-radius:6px}.tmsg-line.me.jn .tmsg-b{border-bottom-right-radius:6px}
.tmsg-line.them.jp .tmsg-b{border-top-left-radius:6px}.tmsg-line.them.jn .tmsg-b{border-bottom-left-radius:6px}
.tmsg-b.failed{opacity:.55}
.tmsg-t{margin:3px 4px 0 44px;color:var(--sp-ghost);font-size:11px}
.tmsg-t.me{margin:3px 4px 0 0;text-align:right}
.tmsg-fail{margin:4px 4px 0;color:var(--sp-live);font-size:12px;text-align:right}
.tmsg-wrap .tmsg-more{align-self:center;margin:4px 0 10px;padding:7px 14px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-surface);color:var(--sp-ash);font-size:13px;font-weight:600}
.tmsg-note{margin:12px 16px;color:var(--sp-ash);font-size:14px}
.tmsg-wrap .tmsg-link{padding:0;border:0;background:none;color:var(--sp-signal);font-weight:600;text-decoration:underline}

/* composer */
.tmsg-comp{padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px));background:var(--sp-surface)}
.tmsg-pill{position:relative;display:flex;align-items:flex-end;gap:6px;padding:4px 4px 4px 16px;border:1px solid var(--sp-rim);border-radius:24px;background:var(--sp-surface)}
.tmsg-pill:focus-within{border-color:var(--sp-signal)}
.tmsg-pill textarea{flex:1;min-height:38px;max-height:120px;padding:9px 0;border:0;outline:0;background:none;color:var(--sp-plat);font:inherit;font-size:16px;line-height:1.35;resize:none}
.tmsg-pill textarea::placeholder{color:var(--sp-ghost)}
.tmsg-wrap .tmsg-send{display:grid;place-items:center;flex:none;width:38px;height:38px;border:0;border-radius:50%;background:var(--sp-signal);color:#fff}
.tmsg-wrap .tmsg-send:hover{background:color-mix(in srgb,var(--sp-signal) 88%,#000)}
.tmsg-ctr{position:absolute;right:50px;top:-10px;padding:1px 7px;border-radius:999px;background:var(--sp-surface2);color:var(--sp-ash);font-size:11px;font-weight:700}
.tmsg-lock{padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--sp-rim);background:var(--sp-surface);color:var(--sp-ash);font-size:14px;text-align:center}.tmsg-lock .tmsg-link{margin-left:8px}

/* empty states, buttons, sheets */
.tmsg-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:36px 24px;text-align:center;color:var(--sp-ash)}
.tmsg-empty h2{margin:0;color:var(--sp-plat);font-family:'Space Grotesk',sans-serif;font-size:21px}.tmsg-empty p{margin:0 0 8px;max-width:30ch}
.tmsg-pick{flex:1}.tmsg-solo{min-height:50vh;border:1px solid var(--sp-rim);border-radius:16px;background:var(--sp-surface)}
.tmsg-bigic{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:color-mix(in srgb,var(--sp-signal) 12%,transparent);color:var(--sp-signal)}
.tmsg-wrap .tmsg-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border:0;border-radius:8px;font-size:14px;font-weight:600}
.tmsg-wrap .tmsg-solid{background:var(--sp-signal);color:#fff}.tmsg-wrap .tmsg-solid:hover:not(:disabled){background:color-mix(in srgb,var(--sp-signal) 88%,#000)}.tmsg-wrap .tmsg-solid:disabled{opacity:.5;cursor:not-allowed}
.tmsg-wrap .tmsg-ghost{background:var(--sp-surface2);border:1px solid var(--sp-rim)}

.tmsg-scrim{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
.tmsg-sheet{width:100%;max-width:480px;max-height:88dvh;overflow:auto;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));border:1px solid var(--sp-rim);border-bottom:0;border-radius:22px 22px 0 0;background:var(--sp-surface)}
.tmsg-sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.tmsg-sh b{font-family:'Space Grotesk',sans-serif;font-size:18px}
.tmsg-find{display:flex;gap:8px}.tmsg-find input{flex:1;padding:11px 14px;border:1px solid var(--sp-rim);border-radius:10px;background:var(--sp-void);color:var(--sp-plat);font:inherit;font-size:16px}
.tmsg-find input:focus,.tmsg-det:focus{outline:2px solid var(--sp-signal);border-color:transparent}
.tmsg-sheet h3{margin:16px 0 4px;color:var(--sp-ash);font-size:13px;font-weight:600}
.tmsg-met{margin:0;padding:0;list-style:none}.tmsg-wrap .tmsg-met button{display:flex;align-items:center;gap:12px;width:100%;padding:9px 4px;border:0;border-radius:10px;background:none;text-align:left}
.tmsg-wrap .tmsg-met button:hover{background:var(--sp-void)}.tmsg-met span{display:flex;flex-direction:column}.tmsg-met small{color:var(--sp-ash);font-size:12px}
.tmsg-err{margin:8px 0 0;color:var(--sp-live);font-size:14px}
.tmsg-chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.tmsg-wrap .tmsg-chips button{padding:8px 14px;border:1px solid var(--sp-rim);border-radius:999px;background:var(--sp-void);font-size:14px;font-weight:600}
.tmsg-wrap .tmsg-chips button.on{border-color:var(--sp-signal);background:color-mix(in srgb,var(--sp-signal) 14%,var(--sp-surface));color:var(--sp-signal)}
.tmsg-det{width:100%;padding:11px 14px;border:1px solid var(--sp-rim);border-radius:10px;background:var(--sp-void);color:var(--sp-plat);font:inherit;font-size:16px;resize:none}
.tmsg-save{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
.tmsg-toast{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:95;padding:11px 18px;border-radius:999px;background:#242526;color:#fff;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.tmsg-wrap button:focus-visible,.tmsg-wrap a:focus-visible{outline:2px solid var(--sp-signal);outline-offset:2px}

@media (min-width:700px){.tmsg-scrim{align-items:center}.tmsg-sheet{border-radius:20px;border-bottom:1px solid var(--sp-rim)}}

/* phones: the inbox is a normal page; an open chat takes the whole screen (like Instagram) */
@media (max-width:860px){
  .tmsg{display:block;height:auto;overflow:visible}
  .tmsg-list{border-right:0;border-radius:16px;background:var(--sp-surface);border:1px solid var(--sp-rim)}
  .tmsg-rows{overflow:visible}
  .tmsg-thread{display:none}
  .tmsg.has-active .tmsg-list{display:none}
  .tmsg.has-active .tmsg-thread{display:flex;position:fixed;inset:0;z-index:40;padding-top:env(safe-area-inset-top,0px)}
  .tmsg-back{display:grid!important}
  .tmsg-b{max-width:80%}
}
`;
