/**
 * server.js — Tranzle backend
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
const crypto     = require("crypto");
const nodemailer = require("nodemailer");

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

// The Stripe webhook needs the RAW request body to verify its signature —
// express.json() would already have parsed/consumed it by the time the route
// handler runs, which silently breaks signature verification. Skip JSON
// parsing for that one path only; its own route below applies express.raw().
app.use((req, res, next) => {
  if (req.path === "/api/coins/webhook") return next();
  express.json()(req, res, next);
});

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
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/tranzle")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(e => {
    console.error("❌ MongoDB  ERROR:");
    console.error(e);
  });

const UserSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  username:    { type: String, required: true, unique: true, lowercase: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true },
  flag:        { type: String, default: "🌍" },
  country:     { type: String, default: "" },
  points:      { type: Number, default: 0 },
  coins:       { type: Number, default: 20 }, // free starter coins so new players aren't stuck
  wins:        { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  followers:   { type: Number, default: 0 },
  following:   { type: Number, default: 0 },
  bio:         { type: String, default: "" },
  socialLinks: {
    instagram: { type: String, default: "" },
    tiktok:    { type: String, default: "" },
    youtube:   { type: String, default: "" },
    twitter:   { type: String, default: "" },
  },
  rank:        { type: String, default: "Bronze I" },
  globalRank:  { type: Number, default: 9999 },
  // forgot-password: we store a HASH of the token, never the raw token.
  // If the DB ever leaks, a stolen hash can't be used to reset anyone's password.
  resetTokenHash:   { type: String, default: null },
  resetTokenExpiry: { type: Date,   default: null },
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
    coins: u.coins,
    wins: u.wins,
    gamesPlayed: u.gamesPlayed,
    followers: u.followers,
    following: u.following,
    bio: u.bio,
    socialLinks: u.socialLinks || {},
    rank: calculateRank(u.points),
    createdAt: u.createdAt,
  };
}

/* ─────────────────────────────────────────────
   EMAIL — Gmail SMTP via nodemailer (free, no domain needed)
   Setup (you do this once, manually):
     1. Turn on 2-Step Verification on the Gmail account you'll send from
     2. Go to https://myaccount.google.com/apppasswords
     3. Generate an "app password" (16 chars, no spaces)
     4. In tranzle-backend/.env add:
          GMAIL_USER=youraddress@gmail.com
          GMAIL_APP_PASS=the16charapppassword
     5. Restart the server
   Gmail's free tier caps at ~500 emails/day — plenty for now.
───────────────────────────────────────────── */
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

async function sendResetEmail(toEmail, resetUrl) {
  // If Gmail creds aren't set yet, don't crash the route — just log it,
  // so you can keep testing the rest of the app while you set up email.
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    console.warn("⚠️  GMAIL_USER/GMAIL_APP_PASS not set — reset email not sent. Link would be:", resetUrl);
    return;
  }
  await mailer.sendMail({
    from: `Tranzle <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your Tranzle password",
    html: `
      <div style="font-family:sans-serif;background:#0d0b08;color:#f4ede1;padding:32px;border-radius:8px;">
        <h2 style="color:#c97b3d;">Tranzle</h2>
        <p>Someone requested a password reset for this account. If that wasn't you, ignore this email.</p>
        <p><a href="${resetUrl}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#c97b3d;color:#0d0b08;text-decoration:none;border-radius:4px;font-weight:bold;">Reset password</a></p>
        <p style="font-size:12px;color:#8a7d68;margin-top:20px;">This link expires in 30 minutes.</p>
      </div>
    `,
  });
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

// POST /api/auth/forgot — request a reset link
// Always returns the same generic message whether or not the email exists.
// This stops attackers from using this route to discover which emails have accounts.
app.post("/api/auth/forgot", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });

  const generic = { message: "If that email has an account, a reset link is on its way." };

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json(generic); // don't leak whether the account exists

    // Raw token goes in the email link. Only the HASH is stored in the DB.
    // Even if the DB leaks, nobody can reset a password from the hash alone.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetTokenHash = tokenHash;
    user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/?resetToken=${rawToken}`;
    await sendResetEmail(user.email, resetUrl);

    return res.json(generic);
  } catch (e) {
    console.error("forgot-password error:", e);
    // Still return the generic message — never confirm/deny via error shape either.
    return res.json(generic);
  }
});

// POST /api/auth/reset-password — consume the token, set new password
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "token + password required" });
  if (password.length < 8) return res.status(400).json({ error: "password must be 8+ chars" });

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiry: { $gt: new Date() }, // must not be expired
    });
    if (!user) return res.status(400).json({ error: "reset link is invalid or expired" });

    user.password = await bcrypt.hash(password, 10);
    user.resetTokenHash = null;
    user.resetTokenExpiry = null;
    await user.save();

    // Log them in immediately after reset — one less step for the user
    const jwtToken = signToken(user._id);
    return res.json({ token: jwtToken, user: safeUser(user) });
  } catch (e) {
    console.error("reset-password error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// POST /api/auth/change-password — logged-in user changing their own password
// (Different from reset-password: this requires knowing the CURRENT password,
// since the user is already authenticated — no email token needed here.)
app.post("/api/auth/change-password", auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "current + new password required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "new password must be 8+ chars" });

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: "current password is wrong" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "password updated" });
  } catch (e) {
    console.error("change-password error:", e);
    res.status(500).json({ error: "server error" });
  }
});

/* ─────────────────────────────────────────────
   COINS — purchase via Stripe Checkout
   10 coins per $1. Withdrawal/cash-out is NOT built here — see chat note:
   that needs Stripe Connect + KYC and deserves its own dedicated session,
   not a bolt-on. This route only handles buying coins with a card.
───────────────────────────────────────────── */
let stripe = null;
try { stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || ""); } catch { /* stripe not installed yet */ }

const COIN_PACKAGES = [
  { coins: 50,   usd: 5  },
  { coins: 120,  usd: 10 }, // small bonus for buying more at once
  { coins: 650,  usd: 50 },
];

app.post("/api/coins/checkout", auth, async (req, res) => {
  if (!stripe || !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Payments aren't set up yet — add STRIPE_SECRET_KEY to .env and run `npm install stripe`." });
  }
  const { packageIndex } = req.body;
  const pkg = COIN_PACKAGES[packageIndex];
  if (!pkg) return res.status(400).json({ error: "invalid package" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${pkg.coins} Tranzle coins` },
          unit_amount: pkg.usd * 100,
        },
        quantity: 1,
      }],
      metadata: { userId: req.userId, coins: pkg.coins },
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/?coinsPurchased=1`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("stripe checkout error:", e);
    res.status(500).json({ error: "couldn't start checkout" });
  }
});

// Stripe calls this when payment actually succeeds — coins are only credited
// here, never directly from the frontend, so a user can't just fake success_url
// and grant themselves free coins.
app.post("/api/coins/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) return res.status(503).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("webhook signature invalid:", e.message);
    return res.status(400).end();
  }
  if (event.type === "checkout.session.completed") {
    const { userId, coins } = event.data.object.metadata;
    await User.findByIdAndUpdate(userId, { $inc: { coins: Number(coins) } });
  }
  res.json({ received: true });
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
    const { username, email, bio, flag, country, socialLinks } = req.body;
    const update = {};
    if (bio !== undefined) update.bio = bio;
    if (flag)               update.flag = flag;
    if (country)            update.country = country;
    if (socialLinks && typeof socialLinks === "object") {
      // Merge rather than overwrite — Profile only sends what it has, and
      // Settings might only send some fields. Build it as dot-paths so
      // Mongo merges instead of replacing the whole sub-object with undefineds.
      for (const key of ["instagram", "tiktok", "youtube", "twitter"]) {
        if (socialLinks[key] !== undefined) update[`socialLinks.${key}`] = socialLinks[key];
      }
    }

    // username/email are unique-indexed — a blind update would crash with a
    // duplicate-key error if someone else already has that value. Check first,
    // and exclude the current user from the collision check.
    if (username) {
      const taken = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.userId } });
      if (taken) return res.status(409).json({ error: "username already taken" });
      update.username = username.toLowerCase();
    }
    if (email) {
      const taken = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.userId } });
      if (taken) return res.status(409).json({ error: "email already taken" });
      update.email = email.toLowerCase();
    }

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(safeUser(user));
  } catch (e) {
    console.error("settings update error:", e);
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

// Live broadcasts — keyed by socket.id of the broadcaster.
// This is the missing piece that made "Go Live" invisible everywhere else:
// GoLivePage never told anyone it started, and WatchLivePage never asked.
const liveStreams = new Map();   // socket.id -> { id, mode, title, user, viewers }

function broadcastLiveRooms() {
  io.emit("liveRooms", Array.from(liveStreams.values()));
}

// How many sockets are connected right now
// io.engine.clientsCount is the live number — no DB needed
function broadcastOnlineCount() {
  io.emit("onlineCount", io.engine.clientsCount);
}

io.on("connection", (socket) => {
  console.log("🔌 connected:", socket.id);
  broadcastOnlineCount();

  // Someone tapped "Start Streaming" / "Find Opponent & Go Live" in GoLivePage
  socket.on("golive:start", ({ mode, title, user }) => {
    liveStreams.set(socket.id, {
      id: socket.id,
      mode,                              // "stream" | "match"
      title: title || "Live now",
      user: user || { username: "anonymous" },
      viewers: 0,
      startedAt: Date.now(),
    });
    broadcastLiveRooms();
  });

  // "End Stream" button, or they just close the tab (handled in disconnect below too)
  socket.on("golive:end", () => {
    liveStreams.delete(socket.id);
    broadcastLiveRooms();
  });

  // Send the current list to anyone who just opened WatchLivePage
  socket.on("liveRooms:get", () => {
    socket.emit("liveRooms", Array.from(liveStreams.values()));
  });

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
  socket.on("queue:join", async ({ gameMode = null } = {}) => {
    // Remove any existing entry for this socket (prevent double-queueing)
    const existing = queue.findIndex(p => p.socketId === socket.id);
    if (existing !== -1) queue.splice(existing, 1);

    queue.push({
      socketId:  socket.id,
      userId:    socket.userId   || null,
      username:  socket.username || `anon_${socket.id.slice(0,6)}`,
      flag:      socket.userFlag || "🌍",
      points:    socket.userPoints || 0,
      gameMode,  // null — game is chosen AFTER connecting, not before
    });

    socket.emit("queue:waiting", { position: queue.length });
    console.log(`📋 queue: ${queue.length} waiting`);

    // Match ANY two waiting players — purely on availability.
    // Game mode is null until both strangers agree on one in the call.
    // Old behavior (match by gameMode) meant null never matched null because
    // the server required gameMode equality — and "dontlaugh" default meant
    // users were dropped straight into Don't Laugh before saying hi.
    const idx = queue.findIndex(p => p.socketId !== socket.id);

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

  /* ─── IN-CALL GAME SELECTION ─────────────────────────────────
     Two strangers connect with no game chosen (gameMode is null until
     now). Either one can propose a game from the in-call rail; the other
     accepts, and THAT'S the moment coins get spent — not at queue time. */
  const GAME_COSTS = {
    dontlaugh: 1, vibecheck: 1, hottake: 1, mirrorme: 1,
    echo: 1, finishmystory: 1,
  };

  socket.on("proposeGame", ({ roomId, game }) => {
    if (!rooms.has(roomId)) return;
    io.to(roomId).emit("gameProposed", { game, proposedBy: socket.id });
  });

  socket.on("acceptGame", async ({ roomId, game }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const cost = GAME_COSTS[game] || 1;

    const players = [room.offerer, room.answerer].filter(p => p.userId);
    // Atomic, race-safe deduction: only succeeds if the balance is still
    // >= cost at the moment of the update. Two simultaneous spends can't
    // both succeed and push someone's coins negative.
    for (const p of players) {
      const updated = await User.findOneAndUpdate(
        { _id: p.userId, coins: { $gte: cost } },
        { $inc: { coins: -cost } },
        { new: true }
      );
      if (!updated) {
        io.to(roomId).emit("gameRejected", { game, reason: "not enough coins", userId: p.userId });
        return;
      }
    }

    room.gameMode = game;
    io.to(roomId).emit("gameStarted", { game, cost });
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

    // If they were live and just closed the tab — pull them off Watch Live too
    if (liveStreams.has(socket.id)) {
      liveStreams.delete(socket.id);
      broadcastLiveRooms();
    }

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
  console.log(`🚀 Tranzle server running on port ${PORT}`);
});