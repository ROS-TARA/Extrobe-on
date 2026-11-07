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

/* ─────────────────────────────────────────────
   COIN RULES (edit the numbers here, nowhere else)
   - A new account starts with SIGNUP_COINS coins.
   - One game costs MIN_COINS_TO_PLAY coins to enter, so you need at least that many to play.
───────────────────────────────────────────── */
const SIGNUP_COINS = 25;
const MIN_COINS_TO_PLAY = 5;

const UserSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  username:    { type: String, required: true, unique: true, lowercase: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true },
  flag:        { type: String, default: "🌍" },
  country:     { type: String, default: "" },
  points:      { type: Number, default: 0 },
  coins:       { type: Number, default: SIGNUP_COINS }, // starter coins for new accounts (see COIN RULES above)
  // today's progress for the daily tasks; it resets by itself when the day changes (see DAILY TASKS)
  daily: {
    day:     { type: String, default: "" },
    met:     { type: [String], default: [] },   // different people matched today
    games:   { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    claimed: { type: [String], default: [] },   // task ids already collected today
  },
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
  // ── profile: all of this is saved on the server, so it is the same on every device ──
  avatarData:  { type: Buffer, select: false },   // the photo itself (≤ 60 KB JPEG/PNG/WebP), never sent in normal queries
  avatarType:  { type: String, default: "" },
  avatarV:     { type: Number, default: 0 },       // changes whenever the photo changes → cache-busting URL
  theme:       { type: String, default: "ocean" }, // card colour
  tags:        { type: [String], default: [] },    // "vibe" tags, max 5
  favGame:     { type: String, default: "" },
  blocked:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],   // people I blocked (they can't message me, I can't message them)
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

/* ── Messaging ── */
const ObjId = mongoose.Schema.Types.ObjectId;
const ConversationSchema = new mongoose.Schema({
  key:      { type: String, unique: true },                // "<smallerId>:<largerId>" — one conversation per pair
  members:  [{ type: ObjId, ref: "User" }],                // exactly two
  lastText: { type: String, default: "" },
  lastFrom: { type: ObjId },
  lastAt:   { type: Date, default: Date.now, index: true },
  unread:   { type: Object, default: {} },                 // { "<userId>": unreadCount }
}, { minimize: false });
const DirectMessageSchema = new mongoose.Schema({
  conv:      { type: ObjId, index: true },
  from:      { type: ObjId },
  text:      { type: String },
  createdAt: { type: Date, default: Date.now },
});
DirectMessageSchema.index({ conv: 1, createdAt: -1 });
const MetSchema = new mongoose.Schema({                    // "these two have been matched on a call"
  key:     { type: String, unique: true },
  members: [{ type: ObjId, ref: "User" }],
  lastAt:  { type: Date, default: Date.now },
});
const ReportSchema = new mongoose.Schema({
  by: { type: ObjId }, who: { type: ObjId }, reason: String, details: String, createdAt: { type: Date, default: Date.now },
});

const User         = mongoose.model("User",          UserSchema);
const Match        = mongoose.model("Match",         MatchSchema);
const Conversation = mongoose.model("Conversation",  ConversationSchema);
const DirectMessage= mongoose.model("DirectMessage", DirectMessageSchema);
const Met          = mongoose.model("Met",           MetSchema);
const Report       = mongoose.model("Report",        ReportSchema);

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set — using an insecure dev default. Set it in Render before real users sign up.");
}

// JWT — signs a token that expires in 7 days
// The frontend saves this in localStorage as sp_token
// and sends it in headers as Authorization: Bearer <token>
function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
}

// Middleware — verifies JWT on protected routes
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "no token" });
  try {
    req.userId = jwt.verify(h.slice(7), JWT_SECRET).id;
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
    avatar: avatarUrl(u),
    theme: u.theme || "ocean",
    tags: u.tags || [],
    favGame: u.favGame || "",
    rank: calculateRank(u.points),
    createdAt: u.createdAt,
  };
}

// What anyone may see on a public profile: no email, no coin balance.
function publicUser(u) {
  const { email, coins, ...pub } = safeUser(u);
  return pub;
}

// The photo is served from its own URL (not inside every login / socket message).
function avatarUrl(u) {
  return u.avatarV ? `/api/user/${encodeURIComponent(u.username)}/avatar?v=${u.avatarV}` : "";
}

/* ─────────────────────────────────────────────
   PROFILE VALIDATION — nothing from the browser is trusted
───────────────────────────────────────────── */
const PROFILE_THEMES = ["ocean", "sky", "violet", "mint", "sunset", "rose", "graphite"];
const SOCIAL_KEYS = ["instagram", "tiktok", "youtube", "twitter"];
const stripCtl = (v) => String(v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

// Returns { update } with only the fields that were sent and are valid, or { error }.
function parseProfile(body = {}) {
  const update = {};
  const bad = (error) => ({ error });
  if (body.name !== undefined) {
    const v = typeof body.name === "string" ? stripCtl(body.name) : "";
    if (v.length < 1 || v.length > 30) return bad("name must be 1–30 characters");
    update.name = v;
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== "string") return bad("bio must be text");
    const v = body.bio.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();
    if (v.length > 140) return bad("bio is too long (max 140 characters)");
    update.bio = v;
  }
  if (body.country !== undefined) {
    const v = typeof body.country === "string" ? stripCtl(body.country) : "";
    if (v.length > 40) return bad("country is too long");
    update.country = v;
  }
  if (body.flag !== undefined) {
    const v = typeof body.flag === "string" ? body.flag.trim() : "";
    if (!/^[\p{Regional_Indicator}\p{Extended_Pictographic}\u200d\ufe0f]{1,12}$/u.test(v)) return bad("flag must be an emoji");
    update.flag = v;
  }
  if (body.favGame !== undefined) {
    const v = typeof body.favGame === "string" ? stripCtl(body.favGame) : "";
    if (v && !/^[\p{L}\p{N} '’\-]{1,24}$/u.test(v)) return bad("invalid favourite game");
    update.favGame = v;
  }
  if (body.theme !== undefined) {
    if (!PROFILE_THEMES.includes(body.theme)) return bad("invalid card colour");
    update.theme = body.theme;
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > 5) return bad("choose up to 5 tags");
    const seen = new Set(), tags = [];
    for (const t of body.tags) {
      const v = typeof t === "string" ? stripCtl(t) : "";
      if (!/^[\p{L}\p{N} &'’\-]{1,16}$/u.test(v)) return bad("a tag has invalid characters or is too long (max 16)");
      if (!seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); tags.push(v); }
    }
    update.tags = tags;
  }
  if (body.socialLinks !== undefined) {
    if (!body.socialLinks || typeof body.socialLinks !== "object") return bad("invalid social links");
    for (const key of SOCIAL_KEYS) {
      if (body.socialLinks[key] === undefined) continue;
      const raw = typeof body.socialLinks[key] === "string" ? body.socialLinks[key].trim() : null;
      if (raw === null) return bad(`invalid ${key} handle`);
      const handle = raw.replace(/^@/, "");
      // handles only (no URLs) — so a link can never smuggle in "javascript:" or another site
      if (handle && !/^[A-Za-z0-9._]{1,30}$/.test(handle)) return bad(`${key}: use just your username, like  yourname`);
      update[`socialLinks.${key}`] = handle;
    }
  }
  return { update };
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
      points: 0, wins: 0, gamesPlayed: 0, coins: SIGNUP_COINS,
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
    res.json(publicUser(user));   // public: never includes the email address or coin balance
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

// PATCH /api/user/settings — update bio, flag, etc.
app.patch("/api/user/settings", auth, async (req, res) => {
  try {
    const { username, email, bio, flag, country, socialLinks } = req.body;
    // bio / flag / country / social links go through the same validation as the profile editor
    const picked = {};
    if (bio !== undefined) picked.bio = bio;
    if (flag) picked.flag = flag;
    if (country) picked.country = country;
    if (socialLinks && typeof socialLinks === "object") picked.socialLinks = socialLinks;
    const parsed = parseProfile(picked);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const update = parsed.update;

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
   DAILY TASKS — real progress kept on the server, coins paid by the server only.
   Change a reward or a goal by editing DAILY_TASKS. Nothing else needs to change.
───────────────────────────────────────────── */
// BEGIN DAILY
const DAILY_OFFSET_MIN = Number.isFinite(Number(process.env.DAILY_RESET_OFFSET_MIN)) && process.env.DAILY_RESET_OFFSET_MIN !== undefined && process.env.DAILY_RESET_OFFSET_MIN !== ""
  ? Number(process.env.DAILY_RESET_OFFSET_MIN) : 345;   // minutes after UTC when "your day" starts; 345 = Nepal (UTC+5:45)
// Game tasks stay locked ("coming soon") until game results are decided by the server, not by the players' browsers.
// Set GAME_TASKS_LIVE=1 in Render only after that is built.
const GAME_TASKS_LIVE = process.env.GAME_TASKS_LIVE === "1";

const DAILY_TASKS = [
  { id: "checkin", title: "Daily check-in",  desc: "Open Tranzle today.",                 goal: 1,  reward: 2,  counter: null },
  { id: "meet3",   title: "Meet 3 people",   desc: "Get matched with 3 different people.", goal: 3,  reward: 3,  counter: "met" },
  { id: "meet10",  title: "Meet 10 people",  desc: "Get matched with 10 different people.", goal: 10, reward: 8,  counter: "met" },
  { id: "play3",   title: "Play 3 games",    desc: "Finish 3 games today.",               goal: 3,  reward: 5,  counter: "games", needsGames: true },
  { id: "play10",  title: "Play 10 games",   desc: "Finish 10 games today.",              goal: 10, reward: 15, counter: "games", needsGames: true },
  { id: "win3",    title: "Win 3 games",     desc: "Win 3 games today.",                  goal: 3,  reward: 10, counter: "wins",  needsGames: true },
];

// "2025-01-31" for the current day in the reset time zone
function dailyKey(now = Date.now()) {
  return new Date(now + DAILY_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}
// the moment (ms) the current day ends
function nextResetAt(now = Date.now()) {
  return Date.parse(dailyKey(now) + "T00:00:00Z") + 86400000 - DAILY_OFFSET_MIN * 60000;
}
// start a fresh day for this user if their saved day is old; returns today's key
async function rollDaily(userId) {
  const day = dailyKey();
  await User.updateOne(
    { _id: userId, "daily.day": { $ne: day } },
    { $set: { daily: { day, met: [], games: 0, wins: 0, claimed: [] } } }
  );
  return day;
}
// count one thing for today ("met" needs the other person's id so the same person counts once)
async function bumpDaily(userId, field, otherId) {
  if (!userId) return;
  try {
    await rollDaily(userId);
    const upd = field === "met" ? { $addToSet: { "daily.met": String(otherId) } } : { $inc: { ["daily." + field]: 1 } };
    await User.updateOne({ _id: userId }, upd);
  } catch (e) { console.error("daily bump failed:", e.message); }
}
// what the app shows: each task with real progress
function dailyView(user, now = Date.now()) {
  const day = dailyKey(now);
  const d = user.daily && user.daily.day === day ? user.daily : null;
  const tasks = DAILY_TASKS.map((t) => {
    const soon = !!t.needsGames && !GAME_TASKS_LIVE;
    const raw = t.counter === "met" ? (d ? d.met.length : 0) : t.counter ? (d ? d[t.counter] || 0 : 0) : 1;
    const progress = Math.min(t.goal, raw);
    const claimed = !!(d && d.claimed.includes(t.id));
    return { id: t.id, title: t.title, desc: t.desc, goal: t.goal, reward: t.reward, progress, claimed, soon, claimable: !soon && !claimed && progress >= t.goal };
  });
  return { day, resetsAt: nextResetAt(now), coins: user.coins, tasks };
}
// END DAILY

// GET /api/rewards/daily — today's tasks and my progress
app.get("/api/rewards/daily", auth, async (req, res) => {
  try {
    await rollDaily(req.userId);
    const user = await User.findById(req.userId).select("coins daily");
    if (!user) return res.status(404).json({ error: "user not found" });
    res.set("Cache-Control", "no-store");
    res.json(dailyView(user));
  } catch (e) {
    console.error("daily get error:", e.message);
    res.status(500).json({ error: "server error" });
  }
});

// POST /api/rewards/daily/:id/claim — collect a finished task (once per day, checked and paid atomically)
app.post("/api/rewards/daily/:id/claim", auth, async (req, res) => {
  try {
    const task = DAILY_TASKS.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "unknown task" });
    if (task.needsGames && !GAME_TASKS_LIVE) return res.status(400).json({ error: "This task isn't available yet." });
    const day = await rollDaily(req.userId);
    const filter = { _id: req.userId, "daily.day": day, "daily.claimed": { $ne: task.id } };
    if (task.counter === "met") filter.$expr = { $gte: [{ $size: { $ifNull: ["$daily.met", []] } }, task.goal] };
    else if (task.counter) filter["daily." + task.counter] = { $gte: task.goal };
    const user = await User.findOneAndUpdate(
      filter,
      { $inc: { coins: task.reward }, $addToSet: { "daily.claimed": task.id } },
      { returnDocument: "after" }
    );
    if (!user) return res.status(409).json({ error: "Not ready to collect yet." });
    res.json(dailyView(user));
  } catch (e) {
    console.error("daily claim error:", e.message);
    res.status(500).json({ error: "server error" });
  }
});

/* ─────────────────────────────────────────────
   PROFILE — the signed-in user's own account + editable profile
───────────────────────────────────────────── */
// GET /api/me — my full account (the app calls this on start so every device shows the latest)
app.get("/api/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.set("Cache-Control", "no-store");
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

// PATCH /api/user/profile — name, bio, country, flag, tags, favourite game, card colour, social handles
app.patch("/api/user/profile", auth, async (req, res) => {
  try {
    const parsed = parseProfile(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!Object.keys(parsed.update).length) return res.status(400).json({ error: "nothing to update" });
    const user = await User.findByIdAndUpdate(req.userId, parsed.update, { new: true });
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(safeUser(user));
  } catch (e) {
    console.error("profile update error:", e.message);
    res.status(500).json({ error: "server error" });
  }
});

// Profile photo: the browser crops it to a small square first; we still re-check everything.
const AVATAR_MAX_BYTES = 60 * 1024;
function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

// POST /api/user/avatar   { image: "data:image/jpeg;base64,...." }
app.post("/api/user/avatar", auth, async (req, res) => {
  try {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(req.body && req.body.image || "");
    if (!m) return res.status(400).json({ error: "send a JPEG, PNG or WebP image" });
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > AVATAR_MAX_BYTES) return res.status(400).json({ error: "that photo is too large — try a smaller one" });
    const type = sniffImage(buf);            // the file's real type, not what the browser claims
    if (!type) return res.status(400).json({ error: "that doesn't look like a valid image" });
    const user = await User.findByIdAndUpdate(req.userId, { avatarData: buf, avatarType: type, avatarV: Date.now() }, { new: true });
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(safeUser(user));
  } catch (e) {
    console.error("avatar upload error:", e.message);
    res.status(500).json({ error: "server error" });
  }
});

// DELETE /api/user/avatar
app.delete("/api/user/avatar", auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.userId, { $unset: { avatarData: 1 }, avatarType: "", avatarV: 0 }, { new: true });
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

// GET /api/user/:username/avatar — public image; the ?v= in the URL changes with the photo, so browsers can cache it forever
app.get("/api/user/:username/avatar", async (req, res) => {
  try {
    const user = await User.findOne({ username: String(req.params.username).toLowerCase() }).select("+avatarData avatarType avatarV");
    if (!user || !user.avatarData || !user.avatarV) return res.status(404).end();
    res.set({
      "Content-Type": user.avatarType || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    res.send(Buffer.from(user.avatarData));
  } catch {
    res.status(500).end();
  }
});

/* ─────────────────────────────────────────────
   MESSAGING — private 1-to-1 text messages

   Who may message whom:
     DM_POLICY=met      (default) people who have met on a call, or already have a conversation
     DM_POLICY=anyone   any signed-in player (set this env var on Render to open it up)
   Always: no messaging yourself, nobody who blocked you, nobody you blocked.
   Text only, max 1000 characters, 15 messages per 30 seconds.
───────────────────────────────────────────── */
const DM_POLICY  = String(process.env.DM_POLICY || "met").toLowerCase() === "anyone" ? "anyone" : "met";
const DM_MAX_LEN = 1000;
const dmRate = new Map();                                   // userId -> recent send times
const pairKey = (a, b) => [String(a), String(b)].sort().join(":");
const sameId  = (a, b) => String(a) === String(b);
function dmRateOk(userId) {
  const now = Date.now(), arr = (dmRate.get(userId) || []).filter((t) => now - t < 30000);
  if (arr.length >= 15) { dmRate.set(userId, arr); return false; }
  arr.push(now); dmRate.set(userId, arr); return true;
}
const peerCard = (u) => ({ username: u.username, name: u.name, flag: u.flag, avatar: avatarUrl(u) });
const PEER_FIELDS = "name username flag avatarV";

// Can `me` message `peer`?  → { ok } or { ok:false, reason }
async function dmCheck(me, peer) {
  if (sameId(me._id, peer._id)) return { ok: false, reason: "self" };
  if ((me.blocked || []).some((id) => sameId(id, peer._id))) return { ok: false, reason: "blocked_by_me" };
  if ((peer.blocked || []).some((id) => sameId(id, me._id))) return { ok: false, reason: "unavailable" };   // don't reveal who blocked whom
  if (DM_POLICY === "anyone") return { ok: true };
  const key = pairKey(me._id, peer._id);
  if (await Conversation.findOne({ key }).select("_id").lean()) return { ok: true };
  if (await Met.findOne({ key }).select("_id").lean()) return { ok: true };
  return { ok: false, reason: "not_met" };
}
async function dmContext(req, res) {            // loads me + the other player, or answers with an error
  const me = await User.findById(req.userId).select(PEER_FIELDS + " blocked");
  const peer = await User.findOne({ username: String(req.params.username).toLowerCase() }).select(PEER_FIELDS + " blocked");
  if (!me) { res.status(401).json({ error: "please sign in again" }); return null; }
  if (!peer) { res.status(404).json({ error: "player not found" }); return null; }
  return { me, peer };
}
const dmOut = (m, myId) => ({ _id: String(m._id), fromMe: sameId(m.from, myId), text: m.text, createdAt: m.createdAt });
async function unreadTotal(userId) {
  const convs = await Conversation.find({ members: userId }).select("unread").lean();
  return convs.reduce((n, c) => n + ((c.unread && c.unread[String(userId)]) || 0), 0);
}

// GET /api/messages/conversations — my inbox
app.get("/api/messages/conversations", auth, async (req, res) => {
  try {
    const me = String(req.userId);
    const convs = await Conversation.find({ members: me }).sort({ lastAt: -1 }).limit(60).lean();
    const otherIds = convs.map((c) => (c.members || []).map(String).find((id) => id !== me)).filter(Boolean);
    const users = await User.find({ _id: { $in: otherIds } }).select(PEER_FIELDS).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const out = [];
    for (const c of convs) {
      const u = byId.get((c.members || []).map(String).find((id) => id !== me));
      if (!u) continue;
      out.push({ with: peerCard(u), lastText: c.lastText || "", lastFromMe: sameId(c.lastFrom, me), lastAt: c.lastAt, unread: (c.unread && c.unread[me]) || 0 });
    }
    res.set("Cache-Control", "no-store");
    res.json({ conversations: out, unread: out.reduce((n, c) => n + c.unread, 0), policy: DM_POLICY });
  } catch (e) { console.error("inbox error:", e.message); res.status(500).json({ error: "server error" }); }
});

// GET /api/messages/unread — just the number (for the badge)
app.get("/api/messages/unread", auth, async (req, res) => {
  try { res.set("Cache-Control", "no-store"); res.json({ count: await unreadTotal(req.userId) }); }
  catch { res.status(500).json({ error: "server error" }); }
});

// GET /api/messages/met — people I have met on a call (for "start a chat")
app.get("/api/messages/met", auth, async (req, res) => {
  try {
    const me = String(req.userId);
    const [mine, rows] = await Promise.all([User.findById(me).select("blocked").lean(), Met.find({ members: me }).sort({ lastAt: -1 }).limit(40).lean()]);
    const ids = rows.map((r) => (r.members || []).map(String).find((id) => id !== me)).filter(Boolean);
    const users = await User.find({ _id: { $in: ids } }).select(PEER_FIELDS + " blocked").lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const blocked = (mine && mine.blocked || []).map(String);
    const out = [];
    for (const r of rows) {
      const id = (r.members || []).map(String).find((x) => x !== me), u = byId.get(id);
      if (!u || blocked.includes(id) || (u.blocked || []).some((b) => sameId(b, me))) continue;
      out.push({ ...peerCard(u), lastAt: r.lastAt });
    }
    res.set("Cache-Control", "no-store");
    res.json({ people: out });
  } catch (e) { console.error("met error:", e.message); res.status(500).json({ error: "server error" }); }
});

// GET /api/messages/with/:username[?before=ISO] — one conversation (newest 30; opening it marks it read)
app.get("/api/messages/with/:username", auth, async (req, res) => {
  try {
    const ctx = await dmContext(req, res); if (!ctx) return;
    const { me, peer } = ctx, myId = String(me._id), key = pairKey(me._id, peer._id);
    const chk = await dmCheck(me, peer);
    const conv = await Conversation.findOne({ key }).lean();
    let messages = [], hasMore = false;
    if (conv) {
      const before = req.query.before ? new Date(String(req.query.before)) : null;
      const filter = { conv: conv._id };
      if (before && !isNaN(before)) filter.createdAt = { $lt: before };
      const rows = await DirectMessage.find(filter).sort({ createdAt: -1 }).limit(31).lean();
      hasMore = rows.length > 30;
      messages = rows.slice(0, 30).reverse().map((m) => dmOut(m, myId));
      if (!before) await Conversation.updateOne({ _id: conv._id }, { $set: { ["unread." + myId]: 0 } });
    }
    res.set("Cache-Control", "no-store");
    res.json({ peer: peerCard(peer), canMessage: chk.ok, reason: chk.ok ? null : chk.reason, blockedByMe: chk.reason === "blocked_by_me", messages, hasMore, policy: DM_POLICY });
  } catch (e) { console.error("thread error:", e.message); res.status(500).json({ error: "server error" }); }
});

// POST /api/messages/with/:username  { text }
app.post("/api/messages/with/:username", auth, async (req, res) => {
  try {
    const raw = req.body && req.body.text;
    if (typeof raw !== "string") return res.status(400).json({ error: "write a message first" });
    const text = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return res.status(400).json({ error: "write a message first" });
    if (text.length > DM_MAX_LEN) return res.status(400).json({ error: `messages can be up to ${DM_MAX_LEN} characters` });
    const ctx = await dmContext(req, res); if (!ctx) return;
    const { me, peer } = ctx, myId = String(me._id), peerId = String(peer._id);
    const chk = await dmCheck(me, peer);
    if (!chk.ok) return res.status(403).json({ error: chk.reason === "not_met" ? "You can message people after you've met on a call." : chk.reason === "blocked_by_me" ? "You blocked this player." : "You can't message this player.", reason: chk.reason });
    if (!dmRateOk(myId)) return res.status(429).json({ error: "You're sending messages too fast. Wait a few seconds." });

    const key = pairKey(myId, peerId);
    let conv = await Conversation.findOne({ key });
    if (!conv) { try { conv = await Conversation.create({ key, members: [myId, peerId] }); } catch { conv = await Conversation.findOne({ key }); } }
    const msg = await DirectMessage.create({ conv: conv._id, from: myId, text });
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastText: text.slice(0, 120), lastFrom: myId, lastAt: msg.createdAt }, $inc: { ["unread." + peerId]: 1 } });

    // live delivery: to the other player's devices, and to my other devices
    io.to("user:" + peerId).emit("dm:new", { with: me.username, peer: peerCard(me), message: dmOut(msg, peerId) });
    io.to("user:" + myId).emit("dm:new", { with: peer.username, peer: peerCard(peer), message: dmOut(msg, myId) });
    res.status(201).json({ message: dmOut(msg, myId) });
  } catch (e) { console.error("send error:", e.message); res.status(500).json({ error: "server error" }); }
});

// POST /api/messages/with/:username/read
app.post("/api/messages/with/:username/read", auth, async (req, res) => {
  try {
    const ctx = await dmContext(req, res); if (!ctx) return;
    const { me, peer } = ctx;
    await Conversation.updateOne({ key: pairKey(me._id, peer._id) }, { $set: { ["unread." + String(me._id)]: 0 } });
    res.json({ count: await unreadTotal(me._id) });
  } catch { res.status(500).json({ error: "server error" }); }
});

// POST / DELETE /api/user/:username/block
for (const method of ["post", "delete"]) {
  app[method]("/api/user/:username/block", auth, async (req, res) => {
    try {
      const ctx = await dmContext(req, res); if (!ctx) return;
      if (sameId(ctx.me._id, ctx.peer._id)) return res.status(400).json({ error: "you can't block yourself" });
      await User.updateOne({ _id: ctx.me._id }, method === "post" ? { $addToSet: { blocked: ctx.peer._id } } : { $pull: { blocked: ctx.peer._id } });
      res.json({ blocked: method === "post" });
    } catch { res.status(500).json({ error: "server error" }); }
  });
}

// POST /api/report  { username, reason, details }
const REPORT_REASONS = ["spam", "harassment", "inappropriate", "underage", "other"];
app.post("/api/report", auth, async (req, res) => {
  try {
    const { username, reason, details } = req.body || {};
    if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: "choose a reason" });
    const who = await User.findOne({ username: String(username || "").toLowerCase() }).select("_id");
    if (!who) return res.status(404).json({ error: "player not found" });
    if (sameId(who._id, req.userId)) return res.status(400).json({ error: "you can't report yourself" });
    const text = typeof details === "string" ? details.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300) : "";
    await Report.create({ by: req.userId, who: who._id, reason, details: text });
    console.log(`🚩 report | reason=${reason} | about=${String(username).toLowerCase()} | by=${req.userId}`);
    res.status(201).json({ ok: true });
  } catch (e) { console.error("report error:", e.message); res.status(500).json({ error: "server error" }); }
});

/* ─────────────────────────────────────────────
   REST — LEADERBOARD
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   ICE SERVERS — STUN + (optional) TURN relay for video calls
   Logged-in users only. TURN credentials are short-lived and are issued by
   Cloudflare using secrets that live ONLY in Render env vars:
     CF_TURN_KEY_ID      (Cloudflare dashboard → Realtime → TURN → your key)
     CF_TURN_API_TOKEN   (that key's API token)
   If those are not set, this returns plain STUN and the app still works
   for users whose networks allow direct connections.
   One set of credentials is cached and shared for ICE_CACHE_MS so a busy
   site can't burn through the Cloudflare API; each set expires on its own.
───────────────────────────────────────────── */
const STUN_ONLY = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const ICE_TTL_SECONDS = 4 * 60 * 60;       // credential lifetime
const ICE_CACHE_MS    = 30 * 60 * 1000;    // reuse for 30 min (well inside the TTL)
let iceCache = { servers: null, at: 0 };

async function fetchCloudflareIce() {
  const base = process.env.CF_TURN_API_BASE || "https://rtc.live.cloudflare.com";
  const r = await fetch(
    `${base}/v1/turn/keys/${encodeURIComponent(process.env.CF_TURN_KEY_ID)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.CF_TURN_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: ICE_TTL_SECONDS }),
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!r.ok) throw new Error(`Cloudflare TURN API returned ${r.status}`);
  const data = await r.json();
  const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
  if (!list.length) throw new Error("Cloudflare TURN API returned no iceServers");
  return list;
}

// Any TURN provider that gives a fixed username/password (Metered, ExpressTURN, your own coturn...).
// Render env vars:  TURN_URLS (comma separated), TURN_USERNAME, TURN_CREDENTIAL
function staticTurnServers() {
  const { TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL } = process.env;
  if (!TURN_URLS || !TURN_USERNAME || !TURN_CREDENTIAL) return null;
  const urls = TURN_URLS.split(",").map(u => u.trim()).filter(u => /^turns?:/i.test(u));
  if (!urls.length) return null;
  return [...STUN_ONLY, { urls, username: TURN_USERNAME, credential: TURN_CREDENTIAL }];
}

function iceSource() {
  if (process.env.CF_TURN_KEY_ID && process.env.CF_TURN_API_TOKEN) return "cloudflare";
  if (staticTurnServers()) return "static TURN_* vars";
  return "none (STUN only)";
}

app.get("/api/ice", auth, async (req, res) => {
  res.set("Cache-Control", "no-store");
  console.log(`🧊 ICE servers requested | relay source: ${iceSource()}`);
  if (!process.env.CF_TURN_KEY_ID || !process.env.CF_TURN_API_TOKEN) {
    const fixed = staticTurnServers();
    if (fixed) return res.json({ iceServers: fixed, turn: true });
    return res.json({ iceServers: STUN_ONLY, turn: false });
  }
  try {
    if (!iceCache.servers || Date.now() - iceCache.at > ICE_CACHE_MS) {
      iceCache = { servers: await fetchCloudflareIce(), at: Date.now() };
    }
    res.json({ iceServers: iceCache.servers, turn: true });
  } catch (e) {
    console.error("⚠️  TURN credential fetch failed:", e.message);   // never log the token
    res.json({ iceServers: iceCache.servers || STUN_ONLY, turn: !!iceCache.servers });
  }
});

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

/* ─────────────────────────────────────────────
   SOCKET AUTH — runs once per connection, BEFORE the "connection" event
   The client sends its JWT in the handshake: io(url, { auth: { token } }).
   Because this finishes before any event handler can fire, socket.userId is
   already set (or definitely not set) by the time "queue:join" can arrive.
     - no token        → guest: may connect and spectate, cannot play
     - valid token     → socket.userId/username/flag/points are set
     - bad/expired     → still connects as guest, socket.authError is set, and
                         the client is told via "auth:error" so it can show a
                         message and send the user to log in again
───────────────────────────────────────────── */
io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token || typeof token !== "string") return next();
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(id).lean();
    if (!user) {
      socket.authError = "account not found";
      return next();
    }
    socket.userId     = String(user._id);
    socket.username   = user.username;
    socket.userFlag   = user.flag;
    socket.userPoints = user.points;
    socket.authUser   = safeUser(user);
  } catch (e) {
    socket.authError = e && e.name === "TokenExpiredError" ? "session expired" : "invalid token";
  }
  next();
});

io.on("connection", (socket) => {
  console.log("🔌 connected:", socket.id, socket.userId ? "(authenticated)" : "(guest)");
  if (socket.userId)         socket.join("user:" + socket.userId);    // live messages are delivered to this room
  if (socket.userId)         socket.emit("auth:ok", socket.authUser);
  else if (socket.authError) socket.emit("auth:error", socket.authError);
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

  /* ─── MATCHMAKING ───────────────────────────────────────────
     Flow:
       1. Player emits "queue:join" with gameMode
       2. Server adds them to queue
       3. If queue has 2 players → pair them
       4. Emit "match:found" to both with room info
       5. Player1 (offerer) creates RTCPeerConnection and sends offer
  */
  socket.on("queue:join", async ({ gameMode = null } = {}) => {
    /* ── BUG FIX 1: require authentication ──────────────────────────
       Before this fix, ANY socket could join the queue — logged out tabs,
       unauthenticated browsers, bots. socket.userId is set by the "auth"
       event (JWT verify). If it's missing, the socket never sent a valid
       token → reject immediately.
    ─────────────────────────────────────────────────────────────── */
    if (!socket.userId) {
      socket.emit("queue:error", socket.authError
        ? `Your login is no longer valid (${socket.authError}). Please log in again.`
        : "You must be logged in to play.");
      console.warn(`⛔ queue:join rejected — no auth | socket: ${socket.id}`);
      return;
    }

    /* ── BUG FIX 2: remove ALL existing entries for this userId ─────
       Before this fix, opening 10 tabs meant 10 queue entries, all with
       the same userId. The server matched any two sockets with different
       socketIds — so Tab 1 matched Tab 2, Tab 3 matched Tab 4, etc.
       Same person, different tab = matched with yourself.

       Fix: when a user joins, evict every OTHER socket belonging to the
       same userId from the queue. One user = one queue slot, always.
       Also remove any stale entry for this exact socket (double-queue guard).
    ─────────────────────────────────────────────────────────────── */
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].userId === socket.userId || queue[i].socketId === socket.id) {
        console.log(`🧹 evicting stale queue entry for userId ${socket.userId} (tab conflict or re-join)`);
        queue.splice(i, 1);
      }
    }

    queue.push({
      socketId:  socket.id,
      userId:    socket.userId,
      username:  socket.username || `anon_${socket.id.slice(0,6)}`,
      flag:      socket.userFlag || "🌍",
      points:    socket.userPoints || 0,
      gameMode,
    });

    socket.emit("queue:waiting", { position: queue.length });
    console.log(`📋 queue: ${queue.length} waiting`);

    /* ── BUG FIX 3: never match two sockets with the same userId ────
       Even after the eviction above, add a userId check to the find
       as a second layer of defence — covers race conditions where two
       tabs emit queue:join within the same event loop tick before the
       eviction above runs for the second one.
    ─────────────────────────────────────────────────────────────── */
    const idx = queue.findIndex(
      p => p.socketId !== socket.id && p.userId !== socket.userId
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

      // Daily tasks: count this match for both people (each different person counts once a day).
      if (socket.userId && p2.userId) { bumpDaily(socket.userId, "met", p2.userId); bumpDaily(p2.userId, "met", socket.userId); }

      // Remember that these two have met, so they can message each other afterwards.
      if (socket.userId && p2.userId) {
        Met.updateOne(
          { key: pairKey(socket.userId, p2.userId) },
          { $set: { members: [socket.userId, p2.userId], lastAt: new Date() } },
          { upsert: true }
        ).catch((e) => console.error("met record failed:", e.message));
      }

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
  // Entering any game costs MIN_COINS_TO_PLAY coins (see COIN RULES at the top). Paying the winner comes with the real games.
  const GAME_COSTS = {
    dontlaugh: MIN_COINS_TO_PLAY, vibecheck: MIN_COINS_TO_PLAY, hottake: MIN_COINS_TO_PLAY, mirrorme: MIN_COINS_TO_PLAY,
    echo: MIN_COINS_TO_PLAY, finishmystory: MIN_COINS_TO_PLAY, floppy: MIN_COINS_TO_PLAY,
  };

  socket.on("proposeGame", ({ roomId, game }) => {
    if (!rooms.has(roomId)) return;
    io.to(roomId).emit("gameProposed", { game, proposedBy: socket.id });
  });

  socket.on("acceptGame", async ({ roomId, game }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const cost = GAME_COSTS[game] || MIN_COINS_TO_PLAY;

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
        io.to(roomId).emit("gameRejected", { game, reason: "not enough coins", need: cost, userId: p.userId });
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

  /*
    Signaling rules (enforced here, not trusted from the client):
      - only the two players in a room may signal in it
      - only the offerer may send "webrtc:offer", only the answerer "webrtc:answer"
      - READY GATE: each side emits "webrtc:ready" once its listeners are
        attached. When BOTH are ready the server tells the offerer to start
        with "webrtc:start". This stops the offer being sent before the other
        browser is listening (which silently lost the call before).
  */
  const roomFor = (roomId) => {
    if (typeof roomId !== "string") return null;
    const room = rooms.get(roomId);
    if (!room) return null;
    if (room.offerer.socketId !== socket.id && room.answerer.socketId !== socket.id) return null;
    return room;
  };
  const otherSide = (room) =>
    room.offerer.socketId === socket.id ? room.answerer.socketId : room.offerer.socketId;
  const validSdp = (sdp) => sdp && typeof sdp === "object" && typeof sdp.sdp === "string" && sdp.sdp.length < 100000;

  socket.on("webrtc:ready", ({ roomId } = {}) => {
    const room = roomFor(roomId);
    if (!room) return;
    room.ready = room.ready || new Set();
    room.ready.add(socket.id);
    if (room.ready.size === 2 && !room.started) {
      room.started = true;
      io.to(room.offerer.socketId).emit("webrtc:start", { roomId });
      console.log(`🟢 both ready → offerer told to start | room: ${roomId}`);
    }
  });

  // Offerer sends SDP offer to answerer (also used for ICE restarts)
  socket.on("webrtc:offer", ({ roomId, sdp } = {}) => {
    const room = roomFor(roomId);
    if (!room || room.offerer.socketId !== socket.id || !validSdp(sdp)) return;
    io.to(room.answerer.socketId).emit("webrtc:offer", { sdp, fromId: socket.id });
    console.log(`📡 offer relayed → ${room.answerer.socketId}`);
  });

  // Answerer sends SDP answer back to offerer
  socket.on("webrtc:answer", ({ roomId, sdp } = {}) => {
    const room = roomFor(roomId);
    if (!room || room.answerer.socketId !== socket.id || !validSdp(sdp)) return;
    io.to(room.offerer.socketId).emit("webrtc:answer", { sdp });
    console.log(`📡 answer relayed → ${room.offerer.socketId}`);
  });

  // ICE candidates flow both ways — relay to the other person in the room
  socket.on("webrtc:ice", ({ roomId, candidate } = {}) => {
    const room = roomFor(roomId);
    if (!room || !candidate || typeof candidate !== "object") return;
    io.to(otherSide(room)).emit("webrtc:ice", { candidate });
  });

  /*
    Call reports: each browser sends a snapshot of how its WebRTC call is going
    (connection states, candidate TYPES, bytes/frames received — no IP addresses,
    no credentials) so a failed call can be diagnosed from the Render log alone.
    Only the two players in a room can report, max one report per 2 s, 8 KB cap.
  */
  socket.on("call:report", ({ roomId, tag, build, report } = {}) => {
    const room = roomFor(roomId);
    if (!room) return;
    const now = Date.now();
    if (socket._lastReport && now - socket._lastReport < 2000) return;
    socket._lastReport = now;
    let text;
    try { text = JSON.stringify(report); } catch { return; }
    if (!text) return;
    if (text.length > 8000) text = text.slice(0, 8000) + "…(truncated)";
    const side = room.offerer.socketId === socket.id ? "offerer" : "answerer";
    console.log(`📊 call report | ${roomId} | ${side} | ${String(tag).slice(0, 20)} | build=${String(build).slice(0, 20)} | ${text}`);
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
  socket.on("match:end", async ({ roomId, won, gameMode }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    // The fee comes from the server's own record of this room — never from the browser (a browser could send any number).
    const entryFee = Number(room.entryFee) || 0;

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

        // Daily tasks (they stay locked until GAME_TASKS_LIVE=1, see DAILY TASKS)
        await bumpDaily(myInfo.userId, "games"); await bumpDaily(oppInfo.userId, "games");
        await bumpDaily(won ? myInfo.userId : oppInfo.userId, "wins");

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
  /*
    NEXT / End call. Only a member of a live room can end it, so a late or
    malicious "match:leave" for an old/foreign room is ignored (before, a stale
    NEXT could end someone's brand-new call). Both sockets also leave the
    Socket.IO room so no later message can reach them through it.
  */
  socket.on("match:leave", ({ roomId } = {}) => {
    const room = roomFor(roomId);
    if (!room) return;
    const otherId = otherSide(room);
    io.to(otherId).emit("opponent:left", { roomId });
    socket.leave(roomId);
    const other = io.sockets.sockets.get(otherId);
    if (other) other.leave(roomId);
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
        const otherId = room.offerer.socketId === socket.id ? room.answerer.socketId : room.offerer.socketId;
        io.to(otherId).emit("opponent:left", { roomId });
        const other = io.sockets.sockets.get(otherId);
        if (other) other.leave(roomId);
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
  console.log(`🧊 TURN relay: ${iceSource()}` + (process.env.TURN_URLS ? ` | TURN_URLS has ${process.env.TURN_URLS.split(",").filter(u => /^turns?:/i.test(u.trim())).length} valid address(es) of ${process.env.TURN_URLS.split(",").length}` : ""));
});