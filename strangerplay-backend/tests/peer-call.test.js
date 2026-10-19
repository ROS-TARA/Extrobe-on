/*
  End-to-end signaling test: two logged-in users are matched by the REAL
  server.js (MongoDB stubbed), then each side runs the REAL peer.js with a
  real WebRTC stack (werift, pure JS). Passes only if both peers reach
  ICE "connected" through the server's relay.
  Run:  npm i -D socket.io-client werift   then   node tests/peer-call.test.js
*/
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

process.env.PORT = "3998";
process.env.JWT_SECRET = "test_secret";
process.env.MONGO_URI = "mongodb://stub";

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io: connect } = require("socket.io-client");
const { RTCPeerConnection } = require("werift");

const USERS = {
  "64b000000000000000000001": { _id: "64b000000000000000000001", username: "alice", flag: "🇳🇵", points: 10 },
  "64b000000000000000000002": { _id: "64b000000000000000000002", username: "bob",   flag: "🇯🇵", points: 20 },
  "64b000000000000000000003": { _id: "64b000000000000000000003", username: "mallory", flag: "🌍", points: 0 },
};
mongoose.connect = async () => {};
mongoose.Model.findById = (id) => ({ lean: async () => USERS[id] || null });
require(path.join(__dirname, "..", "server.js"));

const URL = "http://localhost:3998";
const tok = (id) => jwt.sign({ id }, "test_secret");
function client(id) {
  const s = connect(URL, { auth: { token: tok(id) }, transports: ["websocket"], reconnection: false, forceNew: true });
  s.events = [];
  s.onAny((ev, ...a) => s.events.push([ev, ...a]));
  return s;
}
const waitFor = (s, ev, ms = 4000) => new Promise((res, rej) => {
  const hit = s.events.find(e => e[0] === ev);
  if (hit) return res(hit[1]);
  const t = setTimeout(() => rej(new Error(`timeout waiting for ${ev}; saw ${JSON.stringify(s.events.map(e => e[0]))}`)), ms);
  s.onAny((e, ...a) => { if (e === ev) { clearTimeout(t); res(a[0]); } });
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function matchedPair() {
  const a = client("64b000000000000000000001");
  const b = client("64b000000000000000000002");
  await Promise.all([waitFor(a, "auth:ok"), waitFor(b, "auth:ok")]);
  a.emit("queue:join", {}); b.emit("queue:join", {});
  const [ma, mb] = await Promise.all([waitFor(a, "match:found"), waitFor(b, "match:found")]);
  return { a, b, ma, mb };
}

function startPeer(mod, sock, info, states) {
  return mod.createPeer({
    socket: sock, roomId: info.roomId, role: info.role,
    PeerConnection: RTCPeerConnection, iceServers: [],
    connectTimeoutMs: 15000,
    onState: (s) => states.push(s),
  });
}
const reached = (states, phase) => states.some(s => s.phase === phase);
async function until(fn, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(50); }
  return false;
}

test("both peers reach ICE connected through the real server (answerer starts LATE)", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "peer.mjs")).href);
  const { a, b, ma, mb } = await matchedPair();
  const first  = ma.role === "offer" ? [a, ma] : [b, mb];
  const second = ma.role === "offer" ? [b, mb] : [a, ma];
  const sOff = [], sAns = [];

  // Offerer sets up immediately; answerer is 800 ms late. In the OLD code the
  // offer would have been sent and lost in exactly this situation.
  const pOff = startPeer(mod, first[0], first[1], sOff);
  await sleep(800);
  assert.ok(!first[0].events.some(e => e[0] === "webrtc:answer"), "no answer yet");
  const pAns = startPeer(mod, second[0], second[1], sAns);

  assert.ok(await until(() => reached(sOff, "connected") && reached(sAns, "connected")),
    `not connected. offerer=${JSON.stringify(sOff)} answerer=${JSON.stringify(sAns)}`);
  assert.equal(first[0].events.filter(e => e[0] === "webrtc:start").length, 1, "exactly one start signal");
  pOff.close(); pAns.close(); a.close(); b.close();
});

test("answerer ready FIRST also works", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "peer.mjs")).href);
  const { a, b, ma, mb } = await matchedPair();
  const off = ma.role === "offer" ? [a, ma] : [b, mb];
  const ans = ma.role === "offer" ? [b, mb] : [a, ma];
  const sOff = [], sAns = [];
  const pAns = startPeer(mod, ans[0], ans[1], sAns);
  await sleep(500);
  const pOff = startPeer(mod, off[0], off[1], sOff);
  assert.ok(await until(() => reached(sOff, "connected") && reached(sAns, "connected")),
    `not connected. offerer=${JSON.stringify(sOff)} answerer=${JSON.stringify(sAns)}`);
  pOff.close(); pAns.close(); a.close(); b.close();
});

test("outsider cannot inject offer/answer/ice/ready into someone else's room", async () => {
  const { a, b, ma } = await matchedPair();
  const m = client("64b000000000000000000003");
  await waitFor(m, "auth:ok");
  const fake = { type: "offer", sdp: "v=0\r\n" };
  m.emit("webrtc:offer",  { roomId: ma.roomId, sdp: fake });
  m.emit("webrtc:answer", { roomId: ma.roomId, sdp: fake });
  m.emit("webrtc:ice",    { roomId: ma.roomId, candidate: { candidate: "x" } });
  m.emit("webrtc:ready",  { roomId: ma.roomId });
  await sleep(400);
  for (const s of [a, b]) {
    for (const ev of ["webrtc:offer", "webrtc:answer", "webrtc:ice", "webrtc:start"])
      assert.ok(!s.events.some(e => e[0] === ev), `${ev} leaked to a legitimate player`);
  }
  a.close(); b.close(); m.close();
});

test("wrong role cannot send offer/answer; garbage payloads are dropped", async () => {
  const { a, b, ma, mb } = await matchedPair();
  const off = ma.role === "offer" ? [a, ma] : [b, mb];
  const ans = ma.role === "offer" ? [b, mb] : [a, ma];
  const sdp = { type: "offer", sdp: "v=0\r\n" };
  ans[0].emit("webrtc:offer",  { roomId: ans[1].roomId, sdp });   // answerer pretending to be offerer
  off[0].emit("webrtc:answer", { roomId: off[1].roomId, sdp });   // offerer pretending to be answerer
  off[0].emit("webrtc:offer",  { roomId: off[1].roomId, sdp: "not an object" });
  off[0].emit("webrtc:offer",  { roomId: { evil: 1 }, sdp });
  off[0].emit("webrtc:offer");                                   // no payload at all
  await sleep(400);
  assert.ok(!off[0].events.some(e => e[0] === "webrtc:answer"));
  assert.ok(!ans[0].events.some(e => e[0] === "webrtc:offer"));
  a.close(); b.close();
});

test.after(() => setTimeout(() => process.exit(process.exitCode || 0), 300));
