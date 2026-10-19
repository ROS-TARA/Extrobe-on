/*
  Integration test for socket handshake auth + queue.
  Runs the REAL server.js with MongoDB stubbed out (no database needed).
  Run:  npm i -D socket.io-client   then   node --test tests/
*/
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

process.env.PORT = "3999";
process.env.JWT_SECRET = "test_secret";
process.env.MONGO_URI = "mongodb://stub";

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io: connect } = require("socket.io-client");

const USERS = {
  "64b000000000000000000001": { _id: "64b000000000000000000001", username: "alice", flag: "🇳🇵", points: 10 },
  "64b000000000000000000002": { _id: "64b000000000000000000002", username: "bob",   flag: "🇯🇵", points: 20 },
};
// Stub the DB: no real MongoDB in the test.
mongoose.connect = async () => {};
mongoose.Model.findById = (id) => ({ lean: async () => USERS[id] || null });

require(path.join(__dirname, "..", "server.js"));

const URL = "http://localhost:3999";
const tok = (id, opts) => jwt.sign({ id }, "test_secret", opts);

function client(token) {
  const s = connect(URL, { auth: token === undefined ? {} : { token }, transports: ["websocket"], reconnection: false, forceNew: true });
  s.events = [];
  s.onAny((ev, ...a) => s.events.push([ev, ...a]));
  return s;
}
const waitFor = (s, ev, ms = 3000) => new Promise((res, rej) => {
  const hit = s.events.find(e => e[0] === ev);
  if (hit) return res(hit[1]);
  const t = setTimeout(() => rej(new Error(`timeout waiting for ${ev}; saw ${JSON.stringify(s.events.map(e => e[0]))}`)), ms);
  s.onAny((e, ...a) => { if (e === ev) { clearTimeout(t); res(a[0]); } });
});
const connected = (s) => new Promise((res, rej) => { s.on("connect", res); s.on("connect_error", rej); });

test("valid token → auth:ok, no auth:error", async () => {
  const s = client(tok("64b000000000000000000001"));
  await connected(s);
  const user = await waitFor(s, "auth:ok");
  assert.equal(user.username, "alice");
  assert.ok(!s.events.some(e => e[0] === "auth:error"));
  s.close();
});

test("no token → guest; queue:join rejected with clear message", async () => {
  const s = client();
  await connected(s);
  s.emit("queue:join", { gameMode: null });
  const msg = await waitFor(s, "queue:error");
  assert.match(msg, /logged in/i);
  s.close();
});

test("invalid token → auth:error, and queue:join rejected", async () => {
  const s = client("not.a.jwt");
  await connected(s);
  assert.equal(await waitFor(s, "auth:error"), "invalid token");
  s.emit("queue:join", {});
  assert.match(await waitFor(s, "queue:error"), /log in again/i);
  s.close();
});

test("expired token → auth:error 'session expired'", async () => {
  const s = client(tok("64b000000000000000000001", { expiresIn: -10 }));
  await connected(s);
  assert.equal(await waitFor(s, "auth:error"), "session expired");
  s.close();
});

test("token signed with wrong secret → rejected", async () => {
  const s = client(jwt.sign({ id: "64b000000000000000000001" }, "other"));
  await connected(s);
  assert.equal(await waitFor(s, "auth:error"), "invalid token");
  s.close();
});

test("valid JWT but account does not exist → auth:error", async () => {
  const s = client(tok("64b0000000000000000000ff"));
  await connected(s);
  assert.equal(await waitFor(s, "auth:error"), "account not found");
  s.emit("queue:join", {});
  await waitFor(s, "queue:error");
  s.close();
});

test("two different authenticated users join immediately → matched once, one offerer one answerer", async () => {
  const a = client(tok("64b000000000000000000001"));
  const b = client(tok("64b000000000000000000002"));
  await Promise.all([connected(a), connected(b)]);
  await Promise.all([waitFor(a, "auth:ok"), waitFor(b, "auth:ok")]);
  a.emit("queue:join", { gameMode: null });
  b.emit("queue:join", { gameMode: null });
  const [ma, mb] = await Promise.all([waitFor(a, "match:found"), waitFor(b, "match:found")]);
  assert.equal(ma.roomId, mb.roomId);
  assert.deepEqual([ma.role, mb.role].sort(), ["answer", "offer"]);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(a.events.filter(e => e[0] === "match:found").length, 1);
  assert.equal(b.events.filter(e => e[0] === "match:found").length, 1);
  a.close(); b.close();
});

test("same user in two tabs never matches with themselves", async () => {
  const t1 = client(tok("64b000000000000000000001"));
  const t2 = client(tok("64b000000000000000000001"));
  await Promise.all([connected(t1), connected(t2)]);
  await Promise.all([waitFor(t1, "auth:ok"), waitFor(t2, "auth:ok")]);
  t1.emit("queue:join", {});
  t2.emit("queue:join", {});
  await new Promise(r => setTimeout(r, 500));
  assert.ok(!t1.events.some(e => e[0] === "match:found"));
  assert.ok(!t2.events.some(e => e[0] === "match:found"));
  t1.close(); t2.close();
});

test.after(() => setTimeout(() => process.exit(process.exitCode || 0), 200));
