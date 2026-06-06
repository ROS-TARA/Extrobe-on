/**
 * ─────────────────────────────────────────────
 * StrangerPlay — Backend Starter
 * Node.js + Express + Socket.io + MongoDB
 * 
 * TEACH: This file is the entry point for the server.
 * When you run `node server.js`, Node executes this file.
 * 
 * Architecture overview:
 *   HTTP (Express)  → serves REST API endpoints (/api/...)
 *   WebSocket (Socket.io) → handles real-time events (matching,
 *                           signaling, reactions, crowd)
 *   MongoDB (Mongoose) → stores users, match history, points
 *   WebRTC signaling → server passes "offers" and "answers"
 *                      between two browsers so they can connect
 *                      directly (peer-to-peer video)
 * 
 * Free hosting plan:
 *   Backend → Render.com (free tier, spins down after 15min idle)
 *   Database → MongoDB Atlas (free 512MB cluster)
 *   Frontend → Vercel (always free for static React)
 * ─────────────────────────────────────────────
 */

// ── Dependencies ──────────────────────────────
// Run: npm install express socket.io mongoose cors dotenv bcryptjs jsonwebtoken
const express   = require("express");
const http      = require("http");           // Node built-in — wraps Express for Socket.io
const { Server } = require("socket.io");
const mongoose  = require("mongoose");
const cors      = require("cors");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
require("dotenv").config();                  // loads .env file into process.env

// ── App setup ─────────────────────────────────
/*
  TEACH: We create an HTTP server manually instead of using
  app.listen() because Socket.io needs to attach to the same
  HTTP server as Express. Both share the same port.
*/
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"],
  },
});

// ── Middleware ────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json()); // parse JSON request bodies

// ── MongoDB connection ────────────────────────
/*
  TEACH: mongoose.connect() is async — it returns a Promise.
  We use .then()/.catch() instead of async/await here because
  this runs at startup, not inside a function.
  
  Your .env file needs: MONGO_URI=mongodb+srv://...
  Get this from MongoDB Atlas → Connect → Drivers
*/
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/strangerplay")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err.message));

// ════════════════════════════════════════════════
// MODELS (Mongoose schemas)
// ════════════════════════════════════════════════
/*
  TEACH: A Mongoose schema defines the shape of a document in MongoDB.
  Think of it like a class/blueprint. mongoose.model() turns it into
  a constructor you can use to create, find, and update documents.
  
  MongoDB is schema-less by default, but Mongoose adds structure.
  Each model corresponds to one "collection" in MongoDB.
*/

// ── User model ────────────────────────────────
const userSchema = new mongoose.Schema({
  username:   { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 30 },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },          // stored hashed, never plain
  flag:       { type: String, default: "🌍" },           // emoji flag
  country:    { type: String, default: "" },
  bio:        { type: String, default: "", maxlength: 80 },
  points:     { type: Number, default: 0, min: 0 },
  rank:       { type: String, default: "Bronze I" },
  globalRank: { type: Number, default: 9999 },
  wins:       { type: Number, default: 0 },
  losses:     { type: Number, default: 0 },
  badges:     [{ type: String }],                        // array of badge IDs
  friends:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  settings: {
    profilePublic:    { type: Boolean, default: true },
    showOnline:       { type: Boolean, default: true },
    allowChallenges:  { type: Boolean, default: true },
    allowSpectators:  { type: Boolean, default: true },
    allowClips:       { type: Boolean, default: true },
    soundEffects:     { type: Boolean, default: true },
    notifications:    { type: Boolean, default: true },
  },
  rewardsUnlocked: [{ type: String }],    // "bronze", "silver", "gold", "diamond"
  createdAt: { type: Date, default: Date.now },
  lastSeen:  { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// ── Match model ───────────────────────────────
/*
  TEACH: ObjectId refs let us "join" collections.
  player1: ObjectId means it stores the _id of a User document.
  mongoose can populate() it to get the full user object.
*/
const matchSchema = new mongoose.Schema({
  player1:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  player2:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gameMode:    { type: String, enum: ["dont_laugh","mirror_me","vibe_check","hot_take","finish_story","speed_roast","floppy_race"], required: true },
  winner:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  entryFee:    { type: Number, default: 3 },
  ptsAwarded:  { type: Number, default: 0 },
  duration:    { type: Number, default: 0 },   // seconds
  spectators:  { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
});

const Match = mongoose.model("Match", matchSchema);

// ════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════

// ── JWT auth middleware ───────────────────────
/*
  TEACH: Middleware runs BEFORE your route handler.
  authMiddleware checks the Authorization header for a valid JWT token.
  If valid, it attaches the decoded user data to req.user.
  If invalid, it sends 401 Unauthorized immediately.
  
  Usage: app.get("/api/protected", authMiddleware, (req, res) => {...})
*/
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_this");
    req.user = decoded;    // { id, username } available in route handlers
    next();                // pass to the next function (the route handler)
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Point fee calculator ──────────────────────
/*
  TEACH: This is a pure function — given points, return the fee.
  "Pure" means: same input always gives same output, no side effects.
  These are the easiest functions to test and understand.
  
  Rules from README:
  < 100 pts    → 3 pt flat fee
  100–1000 pts → 3%
  1000–5000 pts → 5%
  5000+ pts    → 10%
*/
function calculateEntryFee(points) {
  if (points < 100)  return 3;
  if (points < 1000) return Math.max(3, Math.round(points * 0.03));
  if (points < 5000) return Math.round(points * 0.05);
  return Math.round(points * 0.10);
}

// ── Rank calculator ───────────────────────────
function calculateRank(points) {
  if (points < 100)  return "Bronze I";
  if (points < 200)  return "Bronze II";
  if (points < 350)  return "Bronze III";
  if (points < 500)  return "Silver I";
  if (points < 750)  return "Silver II";
  if (points < 1000) return "Silver III";
  if (points < 2000) return "Gold I";
  if (points < 3500) return "Gold II";
  if (points < 5000) return "Gold III";
  if (points < 7500) return "Diamond I";
  if (points < 9999) return "Diamond II";
  return "Diamond III";
}

// ── Reward checker ────────────────────────────
function checkRewards(points, currentRewards) {
  const tiers = [
    { id: "bronze",  threshold: 100 },
    { id: "silver",  threshold: 500 },
    { id: "gold",    threshold: 1000 },
    { id: "diamond", threshold: 5000 },
  ];
  const newUnlocks = [];
  for (const tier of tiers) {
    if (points >= tier.threshold && !currentRewards.includes(tier.id)) {
      newUnlocks.push(tier.id);
    }
  }
  return newUnlocks;
}

// ════════════════════════════════════════════════
// REST API ROUTES
// ════════════════════════════════════════════════

// ── Health check ──────────────────────────────
/*
  TEACH: GET /api/health is a common pattern.
  Your frontend can call this to confirm the server is alive.
  Useful for monitoring and debugging.
*/
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── AUTH: Sign up ─────────────────────────────
/*
  TEACH: POST means "create something new".
  Steps: validate input → check if user exists → hash password → 
         save user → create JWT → return token.
  
  We NEVER store plain passwords. bcrypt.hash() scrambles it
  with a "salt round" (12 = very slow = very secure = harder to crack).
*/
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, password, country, flag } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (username.length < 2 || username.length > 30) {
      return res.status(400).json({ error: "Username must be 2–30 characters" });
    }

    // Check uniqueness
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? "Email" : "Username";
      return res.status(409).json({ error: `${field} already taken` });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      username, email, password: hashed,
      country: country || "", flag: flag || "🌍",
    });

    // Sign JWT
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "dev_secret_change_this",
      { expiresIn: "30d" }
    );

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, flag: user.flag, points: user.points, rank: user.rank },
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// ── AUTH: Sign in ─────────────────────────────
app.post("/api/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "No account with that email" });

    // bcrypt.compare() checks plain vs hashed — never reverse the hash
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Wrong password" });

    // Update lastSeen
    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "dev_secret_change_this",
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: {
        id: user._id, username: user.username, flag: user.flag,
        points: user.points, rank: user.rank, globalRank: user.globalRank,
        wins: user.wins, losses: user.losses, badges: user.badges,
        rewardsUnlocked: user.rewardsUnlocked,
      },
    });

  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ error: "Server error during signin" });
  }
});

// ── USER: Get profile ─────────────────────────
app.get("/api/user/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select("-password -email");  // never send password or email to frontend

    if (!user) return res.status(404).json({ error: "User not found" });

    // Hide private profiles
    if (!user.settings.profilePublic) {
      return res.json({ username: user.username, flag: user.flag, private: true });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── USER: Update settings ─────────────────────
app.patch("/api/user/settings", authMiddleware, async (req, res) => {
  try {
    const allowed = ["bio", "country", "flag", "settings"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, select: "-password" }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ── LEADERBOARD ───────────────────────────────
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const users = await User.find({ "settings.profilePublic": true })
      .sort({ points: -1 })
      .limit(limit)
      .select("username flag country points rank wins losses globalRank");

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── MATCH: History ────────────────────────────
app.get("/api/matches/:userId", authMiddleware, async (req, res) => {
  try {
    const matches = await Match.find({
      $or: [{ player1: req.params.userId }, { player2: req.params.userId }]
    })
      .populate("player1 player2 winner", "username flag")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ════════════════════════════════════════════════
// SOCKET.IO — REAL-TIME ENGINE
// ════════════════════════════════════════════════
/*
  TEACH: Socket.io gives us two-way real-time communication.
  Unlike HTTP (request → response → done), WebSocket connections
  STAY OPEN. Either side can send at any time.
  
  io.on("connection", ...) fires every time a new browser connects.
  Each connection gets a unique socket.id.
  
  socket.emit()  → sends to THIS user only
  socket.to(id)  → sends to a specific socket id
  io.to(room)    → sends to everyone in a room
  socket.join()  → puts socket in a named room
*/

// ── In-memory matchmaking state ───────────────
/*
  TEACH: These Maps store temporary data in RAM — not in MongoDB.
  Why? Matchmaking state changes every second; writing to DB that
  fast would be slow and expensive. RAM is fine for things that
  only live for the duration of a connection.
  
  If server restarts, this state resets — that's OK.
  Active matches and queue clear naturally.
  
  Map vs Object: Map is better for dynamic keys because it has
  .size, .has(), and doesn't pollute the prototype chain.
*/
const matchQueue     = new Map();   // socketId → { userId, username, points, gameMode, joinedAt }
const activeMatches  = new Map();   // matchId  → { player1, player2, room, gameMode, startedAt }
const userSockets    = new Map();   // userId   → socketId (so we can find users by ID)
const spectatorRooms = new Map();   // matchId  → Set of spectator socketIds

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // ── User registers their identity ───────────
  /*
    Frontend sends this right after connecting:
    socket.emit("register", { userId, username, points })
  */
  socket.on("register", ({ userId, username, points }) => {
    userSockets.set(userId, socket.id);
    socket.data.userId   = userId;
    socket.data.username = username;
    socket.data.points   = points;
    console.log(`👤 Registered: ${username} (${userId})`);
  });

  // ── Matchmaking: join queue ──────────────────
  /*
    TEACH: When a user clicks "Find Match", they emit "join_queue".
    We check if there's already someone waiting:
      - YES → create a match, notify both, remove from queue
      - NO  → add them to the queue, tell them to wait
    
    This is a simple O(1) first-in-first-out queue.
    Production upgrade: match by skill level, game mode preference, etc.
  */
  socket.on("join_queue", ({ gameMode = "random" }) => {
    const userId   = socket.data.userId;
    const username = socket.data.username;
    const points   = socket.data.points || 0;

    if (!userId) return socket.emit("error", { message: "Not registered" });

    // Check if already in queue
    if (matchQueue.has(socket.id)) {
      return socket.emit("queue_status", { status: "already_waiting" });
    }

    // Look for an opponent
    let opponent = null;
    for (const [oppSocketId, oppData] of matchQueue.entries()) {
      // Skip if same user somehow
      if (oppData.userId === userId) continue;
      // Skip if different game mode preference (unless random)
      if (gameMode !== "random" && oppData.gameMode !== "random" && oppData.gameMode !== gameMode) continue;

      opponent = { socketId: oppSocketId, ...oppData };
      matchQueue.delete(oppSocketId);
      break;
    }

    if (opponent) {
      // Found a match — create room
      const matchId  = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const chosenGame = gameMode !== "random" ? gameMode : opponent.gameMode !== "random" ? opponent.gameMode : pickRandomGame();
      const fee      = calculateEntryFee(Math.min(points, opponent.points));

      // Both players join the match room
      socket.join(matchId);
      const oppSocket = io.sockets.sockets.get(opponent.socketId);
      if (oppSocket) oppSocket.join(matchId);

      const matchData = {
        matchId, room: matchId, gameMode: chosenGame, entryFee: fee,
        player1: { socketId: opponent.socketId, userId: opponent.userId, username: opponent.username, points: opponent.points },
        player2: { socketId: socket.id, userId, username, points },
        startedAt: Date.now(),
      };
      activeMatches.set(matchId, matchData);

      // Notify both players
      const payload = { matchId, gameMode: chosenGame, entryFee: fee };
      io.to(opponent.socketId).emit("match_found", { ...payload, opponent: { username, points } });
      socket.emit("match_found", { ...payload, opponent: { username: opponent.username, points: opponent.points } });

      console.log(`🎮 Match created: ${opponent.username} vs ${username} | Game: ${chosenGame} | Fee: ${fee}pts`);

    } else {
      // No opponent — add to queue
      matchQueue.set(socket.id, { userId, username, points, gameMode, joinedAt: Date.now() });
      socket.emit("queue_status", { status: "waiting", queueSize: matchQueue.size });
      console.log(`⏳ ${username} waiting in queue (size: ${matchQueue.size})`);
    }
  });

  // ── Matchmaking: leave queue ─────────────────
  socket.on("leave_queue", () => {
    matchQueue.delete(socket.id);
    socket.emit("queue_status", { status: "left" });
  });

  // ── WebRTC Signaling ─────────────────────────
  /*
    TEACH: WebRTC peer-to-peer video needs a "signaling server"
    to exchange setup info before the direct connection is made.
    
    The flow:
    1. Player A creates an "offer" (SDP = Session Description Protocol)
    2. Server forwards offer to Player B
    3. Player B creates an "answer" and sends back via server
    4. Both exchange "ICE candidates" (network path info)
    5. After all that, they connect DIRECTLY (server no longer needed)
    
    The server is just a messenger here — it never processes the video.
    That's why WebRTC scales well: video bandwidth doesn't go through your server.
  */
  socket.on("webrtc_offer", ({ targetSocketId, offer }) => {
    socket.to(targetSocketId).emit("webrtc_offer", { from: socket.id, offer });
  });

  socket.on("webrtc_answer", ({ targetSocketId, answer }) => {
    socket.to(targetSocketId).emit("webrtc_answer", { from: socket.id, answer });
  });

  socket.on("webrtc_ice_candidate", ({ targetSocketId, candidate }) => {
    socket.to(targetSocketId).emit("webrtc_ice_candidate", { from: socket.id, candidate });
  });

  // ── In-match events ──────────────────────────
  /*
    TEACH: socket.to(room) broadcasts to everyone in the room EXCEPT sender.
    io.to(room) broadcasts to everyone INCLUDING sender.
    
    For reactions, we want everyone to see them → io.to(matchId)
    For "opponent did X", the sender already knows → socket.to(matchId)
  */

  // Crowd reaction (any spectator or player sends an emoji)
  socket.on("crowd_reaction", ({ matchId, emoji }) => {
    io.to(matchId).emit("crowd_reaction", { emoji, from: socket.data.username });
  });

  // Game-specific event (e.g. "I laughed!" in Don't Laugh)
  socket.on("game_event", ({ matchId, event, data }) => {
    socket.to(matchId).emit("game_event", { event, data, from: socket.data.username });
  });

  // Floppy Face Race: face position update
  socket.on("face_position", ({ matchId, y, isDead }) => {
    socket.to(matchId).emit("opponent_face", { y, isDead });
  });

  // ── Game result ───────────────────────────────
  /*
    TEACH: Both players should emit this when the game ends
    on their side. The server validates, awards points, and
    saves to MongoDB.
    
    In production: never trust the client to report who won.
    The server should be the one deciding based on game logic.
    For now, we accept the result and award points accordingly.
  */
  socket.on("match_result", async ({ matchId, winnerId, loserId }) => {
    const match = activeMatches.get(matchId);
    if (!match) return;

    // Prevent double processing
    if (match.settled) return;
    match.settled = true;

    try {
      const fee = match.entryFee;

      // Update winner: +fee, +1 win
      const winner = await User.findByIdAndUpdate(
        winnerId,
        {
          $inc: { points: fee, wins: 1 },
        },
        { new: true }
      );

      // Update rank for winner
      if (winner) {
        const newRank = calculateRank(winner.points);
        const newRewards = checkRewards(winner.points, winner.rewardsUnlocked || []);
        await User.findByIdAndUpdate(winnerId, {
          rank: newRank,
          $push: { rewardsUnlocked: { $each: newRewards } },
        });

        // Notify winner of new rewards
        const winnerSocket = userSockets.get(winnerId);
        if (winnerSocket && newRewards.length > 0) {
          io.to(winnerSocket).emit("reward_unlocked", { rewards: newRewards });
        }
      }

      // Update loser: -fee (floor at 0), +1 loss
      const loser = await User.findById(loserId);
      if (loser) {
        const newPoints = Math.max(0, loser.points - fee);
        await User.findByIdAndUpdate(loserId, {
          points: newPoints,
          rank: calculateRank(newPoints),
          $inc: { losses: 1 },
        });
      }

      // Save match record
      await Match.create({
        player1: match.player1.userId,
        player2: match.player2.userId,
        gameMode: match.gameMode,
        winner: winnerId,
        entryFee: fee,
        ptsAwarded: fee,
        duration: Math.round((Date.now() - match.startedAt) / 1000),
        spectators: (spectatorRooms.get(matchId) || new Set()).size,
      });

      // Notify both players of result
      io.to(matchId).emit("match_settled", {
        winnerId, loserId, fee,
        winnerPoints: winner?.points,
      });

      activeMatches.delete(matchId);
      console.log(`🏆 Match ${matchId} settled. Winner: ${winnerId} +${fee}pts`);

    } catch (err) {
      console.error("Match result error:", err);
      io.to(matchId).emit("error", { message: "Failed to save match result" });
    }
  });

  // ── Spectating ────────────────────────────────
  socket.on("spectate", ({ matchId }) => {
    if (!activeMatches.has(matchId)) {
      return socket.emit("error", { message: "Match not found or already ended" });
    }
    socket.join(matchId);
    if (!spectatorRooms.has(matchId)) spectatorRooms.set(matchId, new Set());
    spectatorRooms.get(matchId).add(socket.id);

    const match = activeMatches.get(matchId);
    socket.emit("spectate_joined", {
      matchId,
      gameMode: match.gameMode,
      player1: match.player1.username,
      player2: match.player2.username,
    });

    // Tell players someone is watching
    io.to(matchId).emit("spectator_joined", { count: spectatorRooms.get(matchId).size });
  });

  // ── Direct challenge ──────────────────────────
  socket.on("challenge_user", ({ targetUsername, gameMode }) => {
    // Find target's socket
    const challenger = socket.data.username;
    let targetSocketId = null;

    for (const [uid, sid] of userSockets.entries()) {
      const targetSocket = io.sockets.sockets.get(sid);
      if (targetSocket?.data?.username === targetUsername) {
        targetSocketId = sid;
        break;
      }
    }

    if (!targetSocketId) {
      return socket.emit("challenge_response", { success: false, message: `${targetUsername} is offline or unavailable` });
    }

    io.to(targetSocketId).emit("incoming_challenge", {
      from: challenger,
      fromSocketId: socket.id,
      gameMode,
    });
  });

  socket.on("accept_challenge", ({ fromSocketId, gameMode }) => {
    // Treat as two people in queue who matched
    const challenger = io.sockets.sockets.get(fromSocketId);
    if (!challenger) return;

    const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fee = calculateEntryFee(Math.min(socket.data.points || 0, challenger.data.points || 0));

    socket.join(matchId);
    challenger.join(matchId);

    const matchData = {
      matchId, room: matchId, gameMode,
      player1: { socketId: fromSocketId, userId: challenger.data.userId, username: challenger.data.username, points: challenger.data.points },
      player2: { socketId: socket.id, userId: socket.data.userId, username: socket.data.username, points: socket.data.points },
      startedAt: Date.now(),
    };
    activeMatches.set(matchId, matchData);

    io.to(fromSocketId).emit("match_found", { matchId, gameMode, entryFee: fee, opponent: { username: socket.data.username } });
    socket.emit("match_found", { matchId, gameMode, entryFee: fee, opponent: { username: challenger.data.username } });
  });

  socket.on("decline_challenge", ({ fromSocketId }) => {
    io.to(fromSocketId).emit("challenge_declined", { by: socket.data.username });
  });

  // ── Disconnect ────────────────────────────────
  /*
    TEACH: Always clean up state when a user disconnects.
    Leaving their socket in matchQueue or userSockets causes memory leaks
    and ghost entries that break matchmaking.
  */
  socket.on("disconnect", () => {
    const { userId, username } = socket.data;
    console.log(`🔌 Disconnected: ${username || socket.id}`);

    // Remove from queue
    matchQueue.delete(socket.id);

    // Remove from userSockets map
    if (userId) userSockets.delete(userId);

    // Remove from spectator rooms
    for (const [matchId, sockets] of spectatorRooms.entries()) {
      sockets.delete(socket.id);
      if (sockets.size === 0) spectatorRooms.delete(matchId);
    }

    // If in an active match, notify opponent
    for (const [matchId, match] of activeMatches.entries()) {
      if (match.player1.socketId === socket.id || match.player2.socketId === socket.id) {
        socket.to(matchId).emit("opponent_disconnected", { username });
        // Give opponent a walk-over win after timeout (implement later)
        break;
      }
    }
  });
});

// ── Helper: pick random game ──────────────────
function pickRandomGame() {
  const games = ["dont_laugh","mirror_me","vibe_check","hot_take","finish_story","speed_roast","floppy_race"];
  return games[Math.floor(Math.random() * games.length)];
}

// ════════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════════
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
  ─────────────────────────────────────────
  🎮 StrangerPlay Server running
  Port     : ${PORT}
  API      : http://localhost:${PORT}/api
  Socket.io: ws://localhost:${PORT}
  MongoDB  : ${process.env.MONGO_URI ? "Atlas (connected)" : "Local fallback"}
  ─────────────────────────────────────────
  `);
});

/**
 * ─────────────────────────────────────────────
 * .env file you need to create (never commit this):
 * 
 *   PORT=3001
 *   MONGO_URI=mongodb+srv://YOUR_USER:YOUR_PASS@cluster0.xxxxx.mongodb.net/strangerplay
 *   JWT_SECRET=some_long_random_string_here_make_it_64_chars
 *   FRONTEND_URL=https://your-vercel-app.vercel.app
 * 
 * package.json dependencies to install:
 *   npm install express socket.io mongoose cors dotenv bcryptjs jsonwebtoken
 * 
 * package.json scripts to add:
 *   "start": "node server.js",
 *   "dev": "nodemon server.js"
 *   
 * (npm install -D nodemon for auto-restart during development)
 * 
 * To deploy on Render.com (free):
 *   1. Push this file to GitHub
 *   2. New Web Service on render.com → connect repo
 *   3. Build: npm install  |  Start: node server.js
 *   4. Add env vars in Render dashboard
 * ─────────────────────────────────────────────
 */
