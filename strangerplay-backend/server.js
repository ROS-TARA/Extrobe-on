/**
 * server.js — StrangerPlay backend
 *
 * What this file does:
 *   REST API  → signup, signin, profile, leaderboard, match history
 *   Socket.io → matchmaking queue, WebRTC signaling, reactions, match results
 *
 * WebRTC signaling explained:
 *   WebRTC connects two browsers DIRECTLY (peer-to-peer video).
 *   But before they can connect, they need to exchange two things:
 *     1. SDP offer/answer — describes codec, resolution, audio format
 *     2. ICE candidates   — possible network paths (IP:port pairs)
 *   Our server is just the POST OFFICE for these messages.
 *   Once both sides have each other's SDP + ICE, the video flows
 *   directly browser-to-browser — our server never touches video data.
 *
 * Matchmaking explained:
 *   User clicks "Find a Stranger" → emits "queue:join"
 *   Server adds them to a queue array
 *   When queue has 2+ players, pairs them:
 *     - assigns one as "offerer" (creates the SDP offer)
 *     - assigns one as "answerer" (responds with SDP answer)
 *   Emits "match:found" to both with opponent info
 *   From there, WebRTC signaling takes over
 */

require("dotenv").config();
const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const cors       = require("cors");

const app    = express();
const server = http.createServer(app);

/* ─────────────────────────────────────────────
   CORS — allow any localhost port in dev, exact Vercel URL in prod
───────────────────────────────────────────── */
const ALLOWED = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // allow same-origin requests and anything from localhost
    if (!origin || origin.startsWith("http://localhost") || ALLOWED.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error("CORS: blocked " + origin));
  },
  credentials: true,
}));

app.use(express.json());

/* ─────────────────────────────────────────────
   SOCKET.IO
───────────────────────────────────────────── */
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || origin.startsWith("http://localhost") || ALLOWED.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("CORS"));
    },
    methods: ["GET","POST"],
      pingTimeout: 60000,   // wait 60s before declaring disconnect (default: 20s)
  pingInterval: 25000, 
  },
});

/* ─────────────────────────────────────────────
   MONGODB SCHEMAS
───────────────────────────────────────────── */
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/strangerplay")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(e => console.error("❌ MongoDB error:", e.message));

const UserSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  username:    { type: String, required: true, unique: true, lowercase: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true },
  flag:        { type: String, default: "🌍" },
  country:     { type: String, default: "" },
  points:      { type: Number, default: 0 },
  wins:        { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  followers:   { type: Number, default: 0 },
  following:   { type: Number, default: 0 },
  bio:         { type: String, default: "" },
  rank:        { type: String, default: "Bronze I" },
  globalRank:  { type: Number, default: 9999 },
  createdAt:   { type: Date, default: Date.now },
});

const MatchSchema = new mongoose.Schema({
  player1:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  player2:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  winner:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  gameMode:  { type: String },
  entryFee:  { type: Number, default: 3 },
  duration:  { type: Number, default: 0 }, // seconds
  createdAt: { type: Date, default: Date.now },
});

const User  = mongoose.model("User",  UserSchema);
const Match = mongoose.model("Match", MatchSchema);

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

// JWT — signs a token that expires in 7 days
// The frontend saves this in localStorage as sp_token
// and sends it in headers as Authorization: Bearer <token>
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
}

// Middleware — verifies JWT on protected routes
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "no token" });
  try {
    req.userId = jwt.verify(h.slice(7), process.env.JWT_SECRET || "dev_secret").id;
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

// Calculate points-based entry fee
// Under 100pts → flat 3pts. 100-1000 → 3%. 1000-5000 → 5%. 5000+ → 10%.
function calculateEntryFee(points) {
  if (points < 100)  return 3;
  if (points < 1000) return Math.round(points * 0.03);
  if (points < 5000) return Math.round(points * 0.05);
  return Math.round(points * 0.10);
}

// Rank label from points
function calculateRank(points) {
  if (points >= 5000) return "Diamond";
  if (points >= 1000) return "Gold";
  if (points >= 500)  return "Silver II";
  if (points >= 100)  return "Silver I";
  if (points >= 50)   return "Bronze III";
  if (points >= 20)   return "Bronze II";
  return "Bronze I";
}

// Strip password before sending user to frontend
function safeUser(u) {
  return {
    _id: u._id,
    name: u.name,
    username: u.username,
    email: u.email,
    flag: u.flag,
    country: u.country,
    points: u.points,
    wins: u.wins,
    gamesPlayed: u.gamesPlayed,
    followers: u.followers,
    following: u.following,
    bio: u.bio,
    rank: calculateRank(u.points),
    createdAt: u.createdAt,
  };
}

/* ─────────────────────────────────────────────
   REST — AUTH
───────────────────────────────────────────── */

// POST /api/auth/signup
app.post("/api/auth/signup", async (req, res) => {
  const { name, username, email, password, flag, country } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: "name, username, email, password required" });
  }
  if (password.length < 8) return res.status(400).json({ error: "password must be 8+ chars" });

  try {
    // Check uniqueness first — fast, no bcrypt needed
    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
    if (exists) {
      const field = exists.email === email.toLowerCase() ? "email" : "username";
      return res.status(409).json({ error: `${field} already taken` });
    }

    // bcrypt rounds=10 → ~200ms. rounds=12 → ~3000ms. Never use 12 in dev.
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, username: username.toLowerCase(), email: email.toLowerCase(),
      password: hash, flag: flag || "🌍", country: country || "",
      points: 0, wins: 0, gamesPlayed: 0,
    });

    const token = signToken(user._id);
    return res.status(201).json({ token, user: safeUser(user) });
  } catch (e) {
    console.error("signup error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// POST /api/auth/signin
app.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email + password required" });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "wrong email or password" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)  return res.status(401).json({ error: "wrong email or password" });

    const token = signToken(user._id);
    return res.json({ token, user: safeUser(user) });
  } catch (e) {
    console.error("signin error:", e);
    res.status(500).json({ error: "server error" });
  }
});

/* ─────────────────────────────────────────────
   REST — USER
───────────────────────────────────────────── */

// GET /api/user/:username — public profile
app.get("/api/user/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() });
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

// PATCH /api/user/settings — update bio, flag, etc.
app.patch("/api/user/settings", auth, async (req, res) => {
  try {
    const { bio, flag, country } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { ...(bio !== undefined && { bio }), ...(flag && { flag }), ...(country && { country }) },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

/* ─────────────────────────────────────────────
   REST — LEADERBOARD
───────────────────────────────────────────── */
app.get("/api/leaderboard", async (req, res) => {
  try {
    const top = await User.find().sort({ points: -1 }).limit(50).lean();
    res.json(top.map((u, i) => ({ ...safeUser(u), globalRank: i + 1 })));
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

/* ─────────────────────────────────────────────
   REST — MATCH HISTORY
───────────────────────────────────────────── */
app.get("/api/matches/:userId", auth, async (req, res) => {
  try {
    const matches = await Match.find({
      $or: [{ player1: req.params.userId }, { player2: req.params.userId }]
    })
    .populate("player1 player2 winner", "username flag country points")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
    res.json(matches);
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

/* ─────────────────────────────────────────────
   SOCKET.IO — REAL-TIME
───────────────────────────────────────────── */

/*
  DATA STRUCTURES (in-memory — resets on server restart)
  
  queue: array of { socketId, userId, username, flag, points, gameMode }
  rooms: Map of roomId → { player1, player2, matchId }
    - roomId is a random string like "room_abc123"
    - player1 is the "offerer" — creates SDP offer first
    - player2 is the "answerer" — responds with SDP answer
*/
const queue = [];                // waiting players
const rooms = new Map();         // active matches

// How many sockets are connected right now
// io.engine.clientsCount is the live number — no DB needed
function broadcastOnlineCount() {
  io.emit("onlineCount", io.engine.clientsCount);
}

io.on("connection", (socket) => {
  console.log("🔌 connected:", socket.id);
  broadcastOnlineCount();

  /* ─── AUTH (optional for spectating, required for playing) ───
     After connecting, the frontend sends "auth" with the JWT token.
     We verify it and attach userId to the socket so we know who they are.
  */
  socket.on("auth", async (token) => {
    try {
      const { id } = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
      socket.userId = id;
      const user = await User.findById(id).lean();
      if (user) {
        socket.username = user.username;
        socket.userFlag = user.flag;
        socket.userPoints = user.points;
        socket.emit("auth:ok", safeUser(user));
      }
    } catch {
      socket.emit("auth:error", "invalid token");
    }
  });

  /* ─── MATCHMAKING ───────────────────────────────────────────
     Flow:
       1. Player emits "queue:join" with gameMode
       2. Server adds them to queue
       3. If queue has 2 players → pair them
       4. Emit "match:found" to both with room info
       5. Player1 (offerer) creates RTCPeerConnection and sends offer
  */
  socket.on("queue:join", async ({ gameMode = "dontlaugh" } = {}) => {
    // Remove any existing entry for this socket (prevent double-queueing)
    const existing = queue.findIndex(p => p.socketId === socket.id);
    if (existing !== -1) queue.splice(existing, 1);

    queue.push({
      socketId:  socket.id,
      userId:    socket.userId   || null,
      username:  socket.username || `anon_${socket.id.slice(0,6)}`,
      flag:      socket.userFlag || "🌍",
      points:    socket.userPoints || 0,
      gameMode,
    });

    socket.emit("queue:waiting", { position: queue.length });
    console.log(`📋 queue: ${queue.length} waiting (${gameMode})`);

    // Try to pair — find another player wanting the same game mode
    // OR fall back to any mode if waiting > 10s (handled client side with timeout)
    const idx = queue.findIndex(
      p => p.socketId !== socket.id && p.gameMode === gameMode
    );

    if (idx !== -1) {
      const p2 = queue.splice(idx, 1)[0];
      // Also remove current player from queue
      const myIdx = queue.findIndex(p => p.socketId === socket.id);
      if (myIdx !== -1) queue.splice(myIdx, 1);

      const roomId = `room_${Math.random().toString(36).slice(2, 9)}`;
      const entryFee = Math.max(
        calculateEntryFee(p2.points),
        calculateEntryFee(socket.userPoints || 0)
      );

      // p2 (the one who joined first) = answerer
      // current socket = offerer (creates the WebRTC offer)
      rooms.set(roomId, {
        offerer:  { socketId: socket.id, ...{ username: socket.username || "anon", flag: socket.userFlag || "🌍", points: socket.userPoints || 0, userId: socket.userId } },
        answerer: { socketId: p2.socketId, ...p2 },
        gameMode,
        entryFee,
        matchId: null,
        startedAt: Date.now(),
      });

      // Join both to the same socket.io room (for easy emit)
      socket.join(roomId);
      const p2Socket = io.sockets.sockets.get(p2.socketId);
      if (p2Socket) p2Socket.join(roomId);

      // Tell both players they've been matched
      // offerer gets role:"offer"  → must call createOffer()
      // answerer gets role:"answer" → waits for offer, then calls createAnswer()
      socket.emit("match:found", {
        roomId,
        role:      "offer",
        opponent:  { username: p2.username, flag: p2.flag, points: p2.points, userId: p2.userId },
        gameMode,
        entryFee,
      });

      io.to(p2.socketId).emit("match:found", {
        roomId,
        role:      "answer",
        opponent:  { username: socket.username || "anon", flag: socket.userFlag || "🌍", points: socket.userPoints || 0, userId: socket.userId },
        gameMode,
        entryFee,
      });

      console.log(`🎮 matched: ${socket.id} ↔ ${p2.socketId} | room: ${roomId} | game: ${gameMode}`);
    }
  });

  // Player cancels search
  socket.on("queue:leave", () => {
    const idx = queue.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
    socket.emit("queue:left");
    console.log(`❌ left queue: ${socket.id} | queue: ${queue.length}`);
  });

  /* ─── WEBRTC SIGNALING ──────────────────────────────────────
     The server just relays these messages — it never reads the SDP/ICE data.
     Think of it as a walkie-talkie relay:
       Browser A sends offer → server → Browser B
       Browser B sends answer → server → Browser A
       Both send ICE candidates → server → other side
  */

  // Offerer sends SDP offer to answerer
  socket.on("webrtc:offer", ({ roomId, sdp }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const targetId = room.answerer.socketId;
    io.to(targetId).emit("webrtc:offer", { sdp, fromId: socket.id });
    console.log(`📡 offer relayed → ${targetId}`);
  });

  // Answerer sends SDP answer back to offerer
  socket.on("webrtc:answer", ({ roomId, sdp }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const targetId = room.offerer.socketId;
    io.to(targetId).emit("webrtc:answer", { sdp });
    console.log(`📡 answer relayed → ${targetId}`);
  });

  // ICE candidates flow both ways — relay to the other person in the room
  socket.on("webrtc:ice", ({ roomId, candidate }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const targetId = room.offerer.socketId === socket.id
      ? room.answerer.socketId
      : room.offerer.socketId;
    io.to(targetId).emit("webrtc:ice", { candidate });
  });

  /* ─── IN-MATCH EVENTS ───────────────────────────────────────*/

  // Crowd reaction — broadcast to everyone in the room
  socket.on("reaction", ({ roomId, emoji }) => {
    socket.to(roomId).emit("reaction", { emoji, fromId: socket.id });
  });

  // Round started — both players sync
  socket.on("round:start", ({ roomId, round, mode }) => {
    socket.to(roomId).emit("round:start", { round, mode });
  });

  // Round ended — relay result to opponent
  socket.on("round:end", ({ roomId, round, result }) => {
    socket.to(roomId).emit("round:end", { round, result });
  });

  // Match finished — save to DB and update points
  socket.on("match:end", async ({ roomId, won, entryFee, gameMode }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only update DB if both players are authenticated
    const myInfo    = room.offerer.socketId   === socket.id ? room.offerer   : room.answerer;
    const oppInfo   = room.offerer.socketId   === socket.id ? room.answerer  : room.offerer;

    if (myInfo.userId && oppInfo.userId) {
      try {
        // Winner gets entryFee * 2 points, loser loses entryFee
        const [winInc, loseInc] = [entryFee, -entryFee];
        if (won) {
          await User.findByIdAndUpdate(myInfo.userId,  { $inc: { points: winInc,  wins: 1, gamesPlayed: 1 } });
          await User.findByIdAndUpdate(oppInfo.userId, { $inc: { points: loseInc, gamesPlayed: 1 } });
        } else {
          await User.findByIdAndUpdate(myInfo.userId,  { $inc: { points: loseInc, gamesPlayed: 1 } });
          await User.findByIdAndUpdate(oppInfo.userId, { $inc: { points: winInc,  wins: 1, gamesPlayed: 1 } });
        }

        // Save match record
        await Match.create({
          player1: myInfo.userId,
          player2: oppInfo.userId,
          winner: won ? myInfo.userId : oppInfo.userId,
          gameMode,
          entryFee,
        });
      } catch (e) {
        console.error("match:end DB error:", e.message);
      }
    }

    rooms.delete(roomId);
  });

  // Player leaves mid-match — tell opponent
  socket.on("match:leave", ({ roomId }) => {
    socket.to(roomId).emit("opponent:left");
    rooms.delete(roomId);
  });

  /* ─── DISCONNECT ────────────────────────────────────────────*/
  socket.on("disconnect", () => {
    console.log("🔌 disconnected:", socket.id);

    // Remove from queue if they were searching
    const qi = queue.findIndex(p => p.socketId === socket.id);
    if (qi !== -1) queue.splice(qi, 1);

    // Find any active room and tell the opponent
    for (const [roomId, room] of rooms.entries()) {
      if (room.offerer.socketId === socket.id || room.answerer.socketId === socket.id) {
        socket.to(roomId).emit("opponent:left");
        rooms.delete(roomId);
        break;
      }
    }

    broadcastOnlineCount();
  });
});

/* ─────────────────────────────────────────────
   START SERVER
───────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 StrangerPlay server running on port ${PORT}`);
});
