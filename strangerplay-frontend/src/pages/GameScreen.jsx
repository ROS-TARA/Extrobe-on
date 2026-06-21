/**
 * GameScreen.jsx — StrangerPlay
 *
 * Full live in-match UI for 4 game modes:
 *   Don't Laugh · Vibe Check · Mirror Me · Hot Take
 *
 * Architecture:
 *   - BlazeFace runs in setInterval (async, 33ms) → writes to faceTrack ref
 *   - rAF renderLoop reads faceTrack synchronously → draws overlay canvas
 *   - NEVER mix await inside rAF (learned from GameSection bug)
 *   - Socket calls are stubbed via socketEmit() — plug real socket later
 *   - Round system: best of 3, phases: intro → playing → roundResult → matchResult
 *
 * Props:
 *   gameMode   — "dontlaugh" | "vibecheck" | "mirrorme" | "hottake"
 *   opponent   — { name, flag, avatar, pts }
 *   entryFee   — number (points wagered)
 *   myPoints   — number
 *   onBack     — function
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "../socket";

function socketEmit(event, data) {
  if (socket && socket.connected) {
    socket.emit(event, data);
  } else {
    console.log("[socket stub]", event, data);
  }
}

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const BG = `linear-gradient(to right,#141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,#1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,#262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,#303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

const ROUND_DURATION  = 20;
const VOTE_DURATION   = 5;
const INTRO_DURATION  = 2000;
const RESULT_DURATION = 3000;
const TOTAL_ROUNDS    = 3;
const FACE_INTERVAL   = 80;   // MediaPipe is heavier, 80ms is fine (~12fps detection)

/*
  MEDIAPIPE FACE MESH
  468 facial landmarks — production quality, same as Google Meet.
  BlazeFace only gave us 6 landmarks. MediaPipe gives us exact lip geometry.
  
  Smile detection works on:
    Upper lip center  → landmark 13
    Lower lip center  → landmark 14
    Left mouth corner → landmark 61
    Right mouth corner→ landmark 291
    Left eye outer    → landmark 33
    Right eye outer   → landmark 263
  
  Mouth Aspect Ratio (MAR) = vertical mouth gap / horizontal mouth width
  Neutral mouth MAR ≈ 0.0 – 0.1
  Smile / open mouth MAR ≈ 0.3+
*/
const SMILE_MAR_THRESHOLD = 0.28;  // tune lower = more sensitive, higher = less

const CDN_FACEMESH = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
const CDN_CAMERA   = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
const CDN_DRAWING  = "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";

/* ─────────────────────────────────────────────
   GAME MODE CONFIG
───────────────────────────────────────────── */
const MODES = {
  dontlaugh: {
    label: "Don't Laugh", emoji: "😐", color: "#00f5a0", duration: 20,
    desc: "Keep a straight face. Smile = you lose the round.",
    prompts: [
      "Imagine your grandma doing the floss dance",
      "A cat slowly falling off a table in slow motion",
      "Your teacher trying to use TikTok for the first time",
      "A dog wearing tiny boots on a slippery floor",
      "Someone biting into a lemon expecting it to be an orange",
    ],
  },
  vibecheck: {
    label: "Vibe Check", emoji: "🎭", color: "#ff4d6d", duration: 15,
    desc: "Act out the vibe. Crowd votes who nailed it.",
    prompts: [
      "You just won the lottery but you're trying to act normal",
      "You are a robot that just discovered human emotions",
      "You are a very dramatic grandma at a soap opera funeral",
      "You just bit into the sourest lemon of your entire life",
      "You are an astronaut seeing Earth for the first time",
    ],
  },
  mirrorme: {
    label: "Mirror Me", emoji: "🪞", color: "#00d4ff", duration: 10,
    desc: "Copy the pose exactly. AI scores your accuracy.",
    poses: [
      "Raise both eyebrows as high as humanly possible",
      "Puff out your cheeks like a balloon about to pop",
      "Make the most confused face you have ever made",
      "Pretend you just smelled something absolutely horrible",
      "Look as surprised as you have ever been in your life",
    ],
  },
  hottake: {
    label: "Hot Take", emoji: "🌶️", color: "#ffd60a", duration: 15,
    desc: "React to the take in 5 seconds. Crowd picks best reaction.",
    prompts: [
      "Pineapple on pizza is actually really good",
      "Sleeping is a complete waste of time",
      "Cats are objectively better than dogs",
      "School should legally start at noon",
      "Putting cereal before milk should be illegal",
    ],
  },
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/*
  MOUTH ASPECT RATIO from MediaPipe landmarks
  
  lm = array of 468 {x, y, z} objects (x/y are 0-1 normalized)
  
  MAR = (top-bottom gap) / (left-right width)
  
  Landmarks used:
    13  = upper lip center
    14  = lower lip center  
    61  = left mouth corner
    291 = right mouth corner
  
  When mouth is closed/neutral: top ≈ bottom → MAR near 0
  When smiling with open mouth: big gap → MAR ≈ 0.3-0.5
  When smiling tight (no teeth): corners pull back but gap stays small
  
  We combine MAR with corner distance ratio for tight smiles too.
*/
function getMouthAspectRatio(lm) {
  if (!lm || lm.length < 292) return 0;
  const upper  = lm[13];
  const lower  = lm[14];
  const leftC  = lm[61];
  const rightC = lm[291];
  const vertical   = Math.abs(upper.y - lower.y);
  const horizontal = Math.abs(leftC.x - rightC.x) || 0.001;
  return vertical / horizontal;
}

/*
  CHEEK RAISE DETECTION — catches tight smiles (no open mouth)
  Landmark 50 = left cheek, 280 = right cheek
  Landmark 33 = left eye outer, 263 = right eye outer
  When cheeks raise, they move closer to eyes
*/
function getCheekRaise(lm) {
  if (!lm || lm.length < 292) return 0;
  const leftEye   = lm[33];
  const leftCheek = lm[50];
  const refDist   = Math.abs(lm[10].y - lm[152].y) || 0.001; // forehead to chin
  return 1 - (Math.abs(leftEye.y - leftCheek.y) / refDist);
}

// Mirror Me: compare two sets of MediaPipe landmarks (468 points)
function mirrorScore(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 10) return 50;
  let diff = 0;
  // Sample 20 evenly spaced landmarks — enough for accuracy, fast to compute
  const step = Math.floor(lm1.length / 20);
  for (let i = 0; i < lm1.length; i += step) {
    if (!lm2[i]) continue;
    const dx = lm1[i].x - lm2[i].x;
    const dy = lm1[i].y - lm2[i].y;
    diff += Math.sqrt(dx*dx + dy*dy);
  }
  return Math.max(0, Math.round(100 - diff * 80));
}

function getRank(pts) {
  if (pts >= 5000) return "Diamond";
  if (pts >= 1000) return "Platinum";
  if (pts >= 500)  return "Gold";
  if (pts >= 100)  return "Silver";
  return "Bronze";
}

function rankColor(pts) {
  if (pts >= 5000) return "#00d4ff";
  if (pts >= 1000) return "#a064ff";
  if (pts >= 500)  return "#ffd60a";
  if (pts >= 100)  return "#c0c0c0";
  return "#cd7f32";
}

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
@keyframes fadeUp   {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn   {from{opacity:0}to{opacity:1}}
@keyframes pulse    {0%,100%{opacity:1}50%{opacity:.35}}
@keyframes glowP    {0%,100%{box-shadow:0 0 20px #00f5a044}50%{box-shadow:0 0 50px #00f5a099}}
@keyframes spinRing {to{transform:rotate(360deg)}}
@keyframes floatUp  {0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-80px)}}
@keyframes timerTick{0%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes slideIn  {from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
@keyframes winPop   {0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes smileWarn{0%,100%{opacity:1}50%{opacity:0.15}}
@keyframes voteGrow {from{width:0}to{width:var(--w)}}
`;

/* ─────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────── */

function RoundDots({ total, scores }) {
  return (
    <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => {
        const s = scores[i];
        const col = s === "win" ? "#00f5a0" : s === "loss" ? "#ff4d6d" : "rgba(255,255,255,0.1)";
        return <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: col, boxShadow: s ? `0 0 7px ${col}` : "none", transition: "all 0.3s" }} />;
      })}
    </div>
  );
}

function TimerRing({ seconds, total, color }) {
  const r = 26, circ = 2 * Math.PI * r;
  const danger = seconds <= 5;
  return (
    <div style={{ position: "relative", width: 70, height: 70, flexShrink: 0 }}>
      <svg width="70" height="70" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle cx="35" cy="35" r={r} fill="none"
          stroke={danger ? "#ff4d6d" : color} strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ - circ * (seconds / total)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Bebas Neue',sans-serif", fontSize: 22,
        color: danger ? "#ff4d6d" : "#f0eeea",
        textShadow: danger ? "0 0 10px rgba(255,77,109,0.7)" : "none",
        animation: danger ? "timerTick 1s infinite" : "none",
      }}>{seconds}</div>
    </div>
  );
}

function VoteBar({ label, pct, color, isMe }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5, color: isMe ? color : "#555" }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 4, width: `${pct}%`,
          background: `linear-gradient(90deg,${color},${color}88)`,
          boxShadow: isMe ? `0 0 10px ${color}55` : "none",
          "--w": `${pct}%`, animation: "voteGrow 1.2s cubic-bezier(0.34,1.56,0.64,1) both",
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function GameScreen({
  gameMode  = "dontlaugh",
  roomId    = null,
  role      = "offer",   // "offer" = caller, "answer" = callee — set by server on match:found
  opponent  = { name: "stranger_7829", flag: "🇧🇷", avatar: "🧑", pts: 3200 },
  entryFee  = 10,
  myPoints  = 74,
  onBack,
  onMatchEnd,
}) {
  const mode = MODES[gameMode] || MODES.dontlaugh;

  /* ── STATE ── */
  const [phase,          setPhase]         = useState("loading");
  const [loadStatus,     setLoadStatus]    = useState("Starting camera...");
  const [timer,          setTimer]         = useState(mode.duration);
  const [round,          setRound]         = useState(1);
  const [myRoundScores,  setMyRoundScores] = useState([]);
  const [roundResult,    setRoundResult]   = useState(null);
  const [matchWon,       setMatchWon]      = useState(null);
  const [promptIdx,      setPromptIdx]     = useState(0);
  const [smileDetected,  setSmileDetected] = useState(false);
  const [myVotePct,      setMyVotePct]     = useState(0);
  const [oppVotePct,     setOppVotePct]    = useState(0);
  const [voting,         setVoting]        = useState(false);
  const [mirrorPhase,    setMirrorPhase]   = useState("pose");
  const [myMirrorScore,  setMyMirrorScore] = useState(null);
  const [reactions,      setReactions]     = useState([]);
  const [myScore,        setMyScore]       = useState(0);
  const [oppScore,       setOppScore]      = useState(0);

  /* ── REFS ── */
  const videoRef      = useRef(null);   // hidden video — MediaPipe reads this
  const videoShowRef  = useRef(null);   // visible self-cam shown to user
  const remoteVideoRef= useRef(null);   // BUGFIX: stranger's actual video — was never rendered before
  const overlayRef    = useRef(null);   // canvas for face landmark drawing
  const animRef        = useRef(null);
  const timerIvRef     = useRef(null);
  const streamRef       = useRef(null);
  const pcRef            = useRef(null);   // RTCPeerConnection
  const pendingIceRef    = useRef([]);     // ICE candidates that arrive before remote description is set
  const phaseRef      = useRef("loading");
  const roundRef      = useRef(1);
  const poseLMRef     = useRef(null);   // stored pose for Mirror Me

  const [remoteConnected, setRemoteConnected] = useState(false);
  const [remoteLeft,       setRemoteLeft]      = useState(false);

  /*
    faceTrack ref: MediaPipe onResults callback writes here.
    rAF renderLoop reads here synchronously.
    RULE: never put setState or async calls inside requestAnimationFrame.
    MediaPipe callback runs async — we bridge via this ref.
  */
  const faceTrack = useRef({
    landmarks: null,   // 468 {x,y,z} normalized points
    mar: 0,            // mouth aspect ratio
    cheekRaise: 0,     // for tight smiles
    found: false,
  });

  /*
    BUGFIX — instant false-positive loss right after connecting:
    ROOT CAUSE: smile detection fired on a SINGLE noisy frame with
    zero smoothing. getMouthAspectRatio/getCheekRaise are both raw
    per-frame ratios — the very first few frames after MediaPipe
    locks onto a face (or after a round starts and the user is still
    settling into position) are noisy: a slight head turn, blink, or
    lighting flicker reads as "cheek raised" or "mouth open" for one
    frame, instantly ending the round. There was no requirement for
    sustained smiling, and no grace period after round start.
    FIX: require N consecutive smiling frames (debounce) before
    declaring a loss, AND ignore detections for a short grace window
    right after each round begins (tracking is still stabilizing).
  */
  const smileStreakRef = useRef(0);
  const roundStartTimeRef = useRef(0);
  const SMILE_STREAK_REQUIRED = 4;   // ~4 consecutive frames at ~12fps ≈ 330ms of sustained smiling
  const ROUND_GRACE_MS = 900;        // ignore smile detection for the first 900ms of a round

  const faceMeshRef = useRef(null);   // MediaPipe FaceMesh instance
  const mpCameraRef = useRef(null);   // MediaPipe Camera pump

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roundRef.current = round; }, [round]);

  /*
    BUGFIX — black camera feed right after matchmaking connects:
    ROOT CAUSE: the visible self-cam <video ref={videoShowRef}> only
    exists in the DOM once `phase !== "loading"` (see render below).
    But the original camera-attach code ran getUserMedia() and tried
    to attach the stream to videoShowRef BEFORE that — while phase
    was still "loading" (MediaPipe scripts were still downloading
    from CDN, which takes 1-2+ seconds). At that moment
    videoShowRef.current was null, the attach was skipped, and
    nothing ever retried it. The hidden bootstrap <video ref={videoRef}>
    DID get the stream (MediaPipe reads from it via the Camera utility),
    so face landmarks tracked perfectly — but the visible camera box
    stayed permanently black underneath them.
    FIX: this effect re-runs every time `phase` changes — which is
    exactly when videoShowRef mounts into the DOM — and re-attaches
    the live stream if it's missing. Self-healing, no race.
  */
  useEffect(() => {
    if (videoShowRef.current && streamRef.current && videoShowRef.current.srcObject !== streamRef.current) {
      videoShowRef.current.srcObject = streamRef.current;
      videoShowRef.current.play().catch(() => {});
    }
  }, [phase]);

  /* ─────────────────────────────────────────────
     MEDIAPIPE SETUP
     
     How MediaPipe Face Mesh works:
     1. We load 3 CDN scripts: face_mesh, camera_utils, drawing_utils
     2. Create a FaceMesh instance with settings
     3. Create a Camera instance that pumps video frames to FaceMesh
     4. FaceMesh calls onResults() with 468 landmarks per frame
     5. We write landmarks to faceTrack ref — rAF reads it
     
     Why MediaPipe over BlazeFace:
     - 468 landmarks vs 6 → precise lip, eye, cheek geometry
     - Runs in WASM — much faster than TensorFlow.js on mobile
     - No model download — served from CDN with cache
     - Real smile detection from lip geometry, not a rough guess
  ───────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      // 1. Get camera
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video:{ width:640, height:480, facingMode:"user" },
          audio:true,
        });
        if (!mounted) return;
        streamRef.current = s;
        videoRef.current.srcObject = s;
        await videoRef.current.play();
        if (videoShowRef.current) {
          videoShowRef.current.srcObject = s;
          await videoShowRef.current.play();
        }
      } catch {
        setLoadStatus("Camera blocked. Allow access in browser and refresh.");
        return;
      }

      // 2. Load MediaPipe scripts
      setLoadStatus("Loading face tracker...");
      try {
        await loadScript(CDN_FACEMESH);
        await loadScript(CDN_CAMERA);
        await loadScript(CDN_DRAWING);
      } catch {
        setLoadStatus("Failed to load face tracker. Check your internet.");
        return;
      }
      if (!mounted) return;

      // 3. Create FaceMesh
      const faceMesh = new window.FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,   // includes iris — not needed but gives better lip accuracy
        minDetectionConfidence: 0.6,
        minTrackingConfidence:  0.5,
      });

      // 4. Results callback — runs on every frame MediaPipe processes
      faceMesh.onResults((results) => {
        if (!mounted) return;
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const lm = results.multiFaceLandmarks[0];
          const mar        = getMouthAspectRatio(lm);
          const cheekRaise = getCheekRaise(lm);

          // A smile = open mouth (MAR) OR cheeks raised (tight smile with no teeth)
          const smiling = mar > SMILE_MAR_THRESHOLD || cheekRaise > 0.72;

          faceTrack.current = { landmarks:lm, mar, cheekRaise, found:true };

          // Only trigger smile in Don't Laugh during playing phase
          // setSmileDetected is safe here because MediaPipe callback is NOT inside rAF
          if (phaseRef.current === "playing" && gameMode === "dontlaugh") {
            const withinGrace = (Date.now() - roundStartTimeRef.current) < ROUND_GRACE_MS;
            if (withinGrace) {
              // Still settling in — don't count smile frames yet, don't flash the warning border
              smileStreakRef.current = 0;
              setSmileDetected(false);
            } else if (smiling) {
              smileStreakRef.current += 1;
              // Flash the warning border as soon as a smile is seen (visual feedback),
              // but only actually END the round once it's sustained for several frames
              setSmileDetected(true);
              // BUGFIX: guard against firing handleRoundEnd multiple times.
              // phaseRef.current updates asynchronously (one render behind),
              // so without this check a sustained smile could call
              // handleRoundEnd repeatedly in the few frames before phase
              // actually flips away from "playing".
              if (smileStreakRef.current === SMILE_STREAK_REQUIRED) {
                handleRoundEnd("smiled");
              }
            } else {
              smileStreakRef.current = 0;
              setSmileDetected(false);
            }
          }
        } else {
          faceTrack.current.found = false;
        }
      });

      faceMeshRef.current = faceMesh;

      // 5. Camera utility pumps video frames to FaceMesh
      // This replaces our old setInterval — MediaPipe controls its own frame rate
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (faceMeshRef.current) {
            await faceMeshRef.current.send({ image: videoRef.current });
          }
        },
        width: 640, height: 480,
      });
      camera.start();
      mpCameraRef.current = camera;

      setLoadStatus("Ready.");
      setPhase("intro");
      setTimeout(() => { if (mounted) { startRenderLoop(); startRound(1); } }, INTRO_DURATION);
    })();

    return () => { mounted = false; cleanup(); };
  }, []); // eslint-disable-line

  function cleanup() {
    cancelAnimationFrame(animRef.current);
    clearInterval(timerIvRef.current);
    if (mpCameraRef.current) mpCameraRef.current.stop();
    if (faceMeshRef.current) faceMeshRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    // BUGFIX: tear down the peer connection too — was never created before, now must be closed
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (socket && roomId) socket.emit("match:leave", { roomId });
  }

  /*
    ═══════════════════════════════════════════════════════════
    BUGFIX — real WebRTC peer connection (the actual missing piece)
    ROOT CAUSE: the app matched two players via socket.io and showed
    each their OWN camera only. There was no RTCPeerConnection, no
    offer/answer/ICE exchange — so neither player could ever see or
    hear the other, and there was no real "call" to disconnect from
    (only a local camera each kept running independently).
    server.js already relays webrtc:offer / webrtc:answer / webrtc:ice
    correctly — this effect is the missing client half that actually
    uses those events to establish a real peer-to-peer connection.

    Flow:
      role === "offer"  → wait for local stream, create RTCPeerConnection,
                           add local tracks, createOffer(), send via socket
      role === "answer" → wait for local stream AND the incoming offer,
                           create RTCPeerConnection, add local tracks,
                           setRemoteDescription(offer), createAnswer(), send back
      Both sides        → exchange ICE candidates as they trickle in,
                           and render the remote stream into remoteVideoRef
                           the moment ontrack fires.
    ═══════════════════════════════════════════════════════════
  */
  useEffect(() => {
    if (!roomId || !socket) return;
    let cancelled = false;

    // Free STUN server — helps peers behind NAT find each other.
    // No TURN server configured — calls between two players on
    // restrictive corporate/mobile NATs may fail to connect directly.
    // Add a TURN server (e.g. Twilio, metered.ca) here if that happens often.
    const PC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    function createPeerConnection() {
      const pc = new RTCPeerConnection(PC_CONFIG);

      // Local tracks → remote peer
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
      }

      // Remote tracks arrive → render them
      pc.ontrack = (event) => {
        if (cancelled) return;
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
        setRemoteConnected(true);
      };

      // Local ICE candidates → send to the other peer via the server relay
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice", { roomId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setRemoteConnected(true);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setRemoteConnected(false);
        }
      };

      pcRef.current = pc;
      return pc;
    }

    // Wait until the local camera stream exists before negotiating —
    // tracks must be added to the peer connection before createOffer/createAnswer.
    async function waitForLocalStream() {
      let tries = 0;
      while (!streamRef.current && tries < 100 && !cancelled) {
        await new Promise(r => setTimeout(r, 100));
        tries++;
      }
    }

    async function startAsOfferer() {
      await waitForLocalStream();
      if (cancelled || !streamRef.current) return;
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", { roomId, sdp: offer });
    }

    async function startAsAnswerer() {
      await waitForLocalStream();
      // answerer waits for the offer to arrive (handled in the socket listener below)
    }

    if (role === "offer") startAsOfferer();
    else startAsAnswerer();

    // ── Socket listeners for the signaling exchange ──
    const onOffer = async ({ sdp }) => {
      await waitForLocalStream();
      if (cancelled || !streamRef.current) return;
      const pc = pcRef.current || createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      // Flush any ICE candidates that arrived before remote description was set
      pendingIceRef.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { roomId, sdp: answer });
    };

    const onAnswer = async ({ sdp }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      pendingIceRef.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingIceRef.current = [];
    };

    const onIce = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        // Remote description not set yet — queue it for after setRemoteDescription
        pendingIceRef.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    // BUGFIX: this is the actual "stranger left" handler — the part of
    // your bug report about not being able to disable/leave the stranger.
    // Server already emits this on disconnect or explicit match:leave.
    const onOpponentLeft = () => {
      setRemoteLeft(true);
      setRemoteConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    socket.on("webrtc:offer",  onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice",    onIce);
    socket.on("opponent:left", onOpponentLeft);

    return () => {
      cancelled = true;
      socket.off("webrtc:offer",  onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice",    onIce);
      socket.off("opponent:left", onOpponentLeft);
    };
  }, [roomId, role]); // eslint-disable-line

  /* ─────────────────────────────────────────────
     OVERLAY rAF — draws face landmarks on canvas
     
     Reads faceTrack ref synchronously — NO async, NO await inside here.
     MediaPipe writes the landmarks; we just visualize them.
     
     Canvas coordinate system: MediaPipe gives 0-1 normalized coords.
     We multiply by canvas W/H to get pixel positions.
     We also mirror X (multiply by -1 + W) because the video is CSS-mirrored.
  ───────────────────────────────────────────── */
  function startRenderLoop() {
    cancelAnimationFrame(animRef.current);
    const render = () => {
      const canvas = overlayRef.current;
      if (!canvas) { animRef.current = requestAnimationFrame(render); return; }

      // IMPORTANT: always read canvas size from the element, not hardcoded
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  || 640;
      canvas.height = rect.height || 480;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ft = faceTrack.current;
      if (!ft.found || !ft.landmarks) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      const W = canvas.width, H = canvas.height;
      const lm = ft.landmarks;
      const smiling = ft.mar > SMILE_MAR_THRESHOLD || ft.cheekRaise > 0.72;
      const dotColor = smiling ? "#ff4d6d" : "#00f5a0";
      const glowCol  = smiling ? "#ff4d6d" : "#00f5a0";

      // Draw key facial landmarks — lips, eyes, nose outline
      // We only draw ~30 key points to keep it fast and readable
      const keyIndices = [
        // Lips
        61,146,91,181,84,17,314,405,321,375,291,
        13,312,311,310,415,308,
        78,95,88,178,87,14,317,402,318,324,308,
        // Eyes
        33,7,163,144,145,153,154,155,133,
        263,249,390,373,374,380,381,382,362,
        // Nose bridge
        168,6,197,195,5,
      ];

      ctx.fillStyle = dotColor;
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 6;
      keyIndices.forEach(i => {
        const p = lm[i];
        if (!p) return;
        // Mirror X because video is CSS scaleX(-1)
        const x = W - p.x * W;
        const y = p.y * H;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Draw mouth outline with thicker line when smiling
      if (smiling) {
        const mouthIdx = [61,146,91,181,84,17,314,405,321,375,291,308];
        ctx.beginPath();
        mouthIdx.forEach((i, idx) => {
          const p = lm[i];
          if (!p) return;
          const x = W - p.x * W, y = p.y * H;
          if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = "#ff4d6d";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);
  }

  /* ─────────────────────────────────────────────
     ROUND SYSTEM
  ───────────────────────────────────────────── */
  function startRound(n) {
    const prompts = mode.prompts || mode.poses || [];
    setPromptIdx(Math.floor(Math.random() * prompts.length));
    setTimer(mode.duration);
    setRound(n);
    setSmileDetected(false);
    smileStreakRef.current = 0;
    roundStartTimeRef.current = Date.now(); // BUGFIX: grace period anchor — see smile-debounce note above
    setVoting(false);
    setMyVotePct(0); setOppVotePct(0);
    setMirrorPhase("pose");
    setMyMirrorScore(null);
    poseLMRef.current = null;
    setPhase("playing");

    // MediaPipe runs continuously via its own camera loop — no startFaceInterval needed
    // We still start the render loop so face landmarks draw on canvas
    startRenderLoop();

    if (socket && socket.connected) socket.emit("round:start", { roomId, round: n, mode: gameMode });

    clearInterval(timerIvRef.current);
    let t = mode.duration;
    timerIvRef.current = setInterval(() => {
      t--; setTimer(t);
      if (t <= 0) { clearInterval(timerIvRef.current); handleRoundEnd("timeout"); }
    }, 1000);
  }

  function handleRoundEnd(reason, winner = null) {
    clearInterval(timerIvRef.current);
    cancelAnimationFrame(animRef.current);
    setSmileDetected(false);

    let iWon;
    if      (reason === "smiled")                            iWon = false;
    else if (reason === "timeout" && gameMode==="dontlaugh") iWon = true;
    else iWon = winner !== null ? winner : Math.random() > 0.5;

    const result = iWon ? "win" : "loss";
    setRoundResult(result);
    if (iWon) setMyScore(s => s+1);
    else       setOppScore(s => s+1);
    setPhase("roundResult");

    setMyRoundScores(prev => {
      const next = [...prev, result];
      socketEmit("round:end", { roomId, round: roundRef.current, result });

      const wins   = next.filter(r=>r==="win").length;
      const losses = next.filter(r=>r==="loss").length;
      const done   = wins >= 2 || losses >= 2 || next.length >= TOTAL_ROUNDS;

      setTimeout(() => {
        if (done) endMatch(wins >= losses);
        else startRound(roundRef.current + 1);
      }, RESULT_DURATION);

      return next;
    });
  }

  // BUGFIX: round-end on smile is now triggered directly inside the onResults
  // callback above (after the consecutive-frame streak check passes). The old
  // effect here used to fire on the very FIRST smileDetected=true, which
  // bypassed any debounce and caused the instant false-positive losses.
  // Removed — handleRoundEnd("smiled") is called once, from one place only.

  function endMatch(won) {
    setMatchWon(won);
    setPhase("matchResult");
    socketEmit("match:end", { roomId, won, entryFee, gameMode });
    if (onMatchEnd) onMatchEnd(won, entryFee);
  }

  /* ── Vibe Check / Hot Take — crowd vote ── */
  function triggerVote() {
    clearInterval(timerIvRef.current);
    setVoting(true);
    let elapsed = 0;
    const iv = setInterval(() => {
      elapsed++;
      const me = 35 + Math.random() * 30;
      setMyVotePct(me); setOppVotePct(100-me);
      if (elapsed >= VOTE_DURATION) {
        clearInterval(iv);
        const final = 35 + Math.random() * 35;
        setMyVotePct(final); setOppVotePct(100-final);
        handleRoundEnd("vote", final >= 50);
      }
    }, 1000);
  }

  /* ── Mirror Me ── */
  function captureMyPose() {
    // Store current 468 MediaPipe landmarks as the reference pose
    poseLMRef.current = faceTrack.current.landmarks;
    setMirrorPhase("copy");
    let t = 5; setTimer(5);
    const iv = setInterval(() => {
      t--; setTimer(t);
      if (t <= 0) {
        clearInterval(iv);
        const sc = mirrorScore(poseLMRef.current, faceTrack.current.landmarks);
        setMyMirrorScore(sc);
        handleRoundEnd("mirror", sc >= 50);
      }
    }, 1000);
  }

  /* ── Reactions ── */
  function addReaction(emoji) {
    const id = Date.now();
    setReactions(r => [...r, { id, emoji, x: Math.random()*65+10 }]);
    setTimeout(() => setReactions(r => r.filter(rx=>rx.id!==id)), 2200);
    socketEmit("reaction", { emoji });
  }

  /* ── Play again ── */
  function playAgain() {
    setMyRoundScores([]); setMyScore(0); setOppScore(0);
    setMatchWon(null); setRoundResult(null);
    setPhase("intro");
    setTimeout(() => startRound(1), INTRO_DURATION);
  }

  const prompts = mode.prompts || mode.poses || [];
  const currentPrompt = prompts[promptIdx] || prompts[0] || "";

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div style={{ minHeight:"100vh", background:BG, backgroundAttachment:"fixed", color:"#f0eeea", fontFamily:"'Syne',sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>

      {/* hidden video for face detection processing */}
      <video ref={videoRef} style={{ position:"fixed", opacity:0, pointerEvents:"none", width:1, height:1 }} muted playsInline />

      {/* ══════ NAV ══════ */}
      <nav style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", height:58, padding:"0 clamp(12px,4vw,36px)", background:"rgba(14,14,15,0.92)", backdropFilter:"blur(24px)", borderBottom:"1px solid rgba(255,255,255,0.06)", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:26, height:26, borderRadius:7, background:"linear-gradient(135deg,#00f5a0,#00d4ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, animation:"glowP 3s infinite" }}>▶</div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, background:"linear-gradient(90deg,#00f5a0,#00d4ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>StrangerPlay</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#333", marginLeft:6 }}>// {mode.label}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <RoundDots total={TOTAL_ROUNDS} scores={myRoundScores} />
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a", background:"rgba(255,214,10,0.07)", border:"1px solid rgba(255,214,10,0.14)", borderRadius:20, padding:"3px 12px" }}>{myPoints} pts</div>
          {onBack && <button onClick={()=>{ cleanup(); onBack(); }} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"6px 16px", color:"#555", fontSize:13, cursor:"pointer" }}>← back</button>}
        </div>
      </nav>

      {/* ══════ BODY ══════ */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr clamp(170px,22%,230px)", gap:12, padding:"clamp(8px,2vw,16px)", minHeight:0 }}>

        {/* ── LEFT ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, minHeight:0 }}>

          {/* score header */}
          {phase !== "loading" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:8, animation:"fadeUp 0.4s both" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(0,245,160,0.1)", border:"2px solid rgba(0,245,160,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>⭐</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#00f5a0" }}>raj_np 🇳🇵</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, lineHeight:1, color:"#00f5a0" }}>{myScore}</div>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                {phase==="playing" && !voting
                  ? <TimerRing seconds={timer} total={mode.duration} color={mode.color} />
                  : <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: voting?mode.color:"#444", letterSpacing:2, animation: voting?"pulse 1s infinite":"none" }}>
                      {voting ? "VOTING..." : `Round ${round}/${TOTAL_ROUNDS}`}
                    </div>
                }
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#ff4d6d" }}>{opponent.name} {opponent.flag}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, lineHeight:1, color:"#ff4d6d" }}>{oppScore}</div>
                </div>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,77,109,0.1)", border:"2px solid rgba(255,77,109,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{opponent.avatar}</div>
              </div>
            </div>
          )}

          {/* camera box */}
          <div style={{ position:"relative", borderRadius:16, overflow:"hidden", border:`1px solid ${mode.color}33`, background:"#080809", flex:"1 1 auto", minHeight:280 }}>

            {/* visible camera feed */}
            {phase !== "loading" && (
              <video ref={videoShowRef} autoPlay muted playsInline
                style={{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)", display:"block", position:"absolute", inset:0 }}
              />
            )}

            {/* face landmark overlay */}
            <canvas ref={overlayRef} width={640} height={480}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:2 }}
            />

            {/*
              BUGFIX — the stranger's actual video, picture-in-picture corner.
              This was completely missing before: each player only ever saw
              their own camera. Now the real remote WebRTC stream renders here.
              Small + corner-positioned so it doesn't interfere with the
              full-screen face-tracking game UI, same pattern as real video
              call apps (Zoom/FaceTime self-view convention, inverted).
            */}
            {phase !== "loading" && phase !== "matchResult" && (
              <div style={{
                position:"absolute", top:14, right:14, zIndex:6,
                width:"clamp(80px,22%,120px)", aspectRatio:"3/4",
                borderRadius:12, overflow:"hidden",
                border:`2px solid ${remoteConnected ? mode.color+"99" : "rgba(255,77,109,0.5)"}`,
                background:"#050506",
                boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
              }}>
                <video ref={remoteVideoRef} autoPlay playsInline
                  style={{ width:"100%", height:"100%", objectFit:"cover", display: remoteConnected ? "block" : "none" }}
                />
                {!remoteConnected && !remoteLeft && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, background:"rgba(8,8,9,0.9)" }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", border:"2px solid transparent", borderTopColor:mode.color, animation:"spinRing 0.9s linear infinite" }} />
                    <div style={{ fontSize:9, color:"#555", fontFamily:"'JetBrains Mono',monospace", textAlign:"center" }}>connecting...</div>
                  </div>
                )}
                {remoteLeft && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(8,8,9,0.95)" }}>
                    <div style={{ fontSize:16 }}>👋</div>
                    <div style={{ fontSize:8, color:"#ff4d6d", fontFamily:"'JetBrains Mono',monospace", textAlign:"center", padding:"0 4px" }}>left the call</div>
                  </div>
                )}
                {/* opponent label */}
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,0.6)", padding:"2px 6px", fontSize:8, fontFamily:"'JetBrains Mono',monospace", color:"#fff", textAlign:"center" }}>
                  {opponent.name} {opponent.flag}
                </div>
              </div>
            )}

            {/* stranger left the call — full overlay, gives the option to leave too */}
            {remoteLeft && (
              <div style={{ position:"absolute", inset:0, zIndex:9, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:"rgba(8,8,9,0.92)", animation:"fadeIn 0.3s both" }}>
                <div style={{ fontSize:40 }}>👋</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2, color:"#ff4d6d" }}>STRANGER LEFT</div>
                <button onClick={() => { cleanup(); onBack && onBack(); }} style={{ background:`linear-gradient(135deg,${mode.color},#00d4ff)`, color:"#0a0a0a", border:"none", borderRadius:10, padding:"11px 28px", fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:2, cursor:"pointer" }}>
                  FIND ANOTHER
                </button>
              </div>
            )}

            {/* smile border flash */}
            {smileDetected && (
              <div style={{ position:"absolute", inset:0, borderRadius:16, border:"3px solid #ff4d6d", boxShadow:"inset 0 0 40px rgba(255,77,109,0.3)", animation:"smileWarn 0.3s infinite", pointerEvents:"none", zIndex:5 }} />
            )}

            {/* ── LOADING ── */}
            {phase==="loading" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:"rgba(8,8,9,0.96)", zIndex:10 }}>
                <div style={{ width:50, height:50, borderRadius:"50%", border:"2px solid transparent", borderTopColor:"#00f5a0", borderRightColor:"#00d4ff", animation:"spinRing 1s linear infinite" }} />
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, color:"#00f5a0" }}>SETTING UP</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#444", textAlign:"center", maxWidth:240 }}>{loadStatus}</div>
              </div>
            )}

            {/* ── INTRO ── */}
            {phase==="intro" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, background:"rgba(8,8,9,0.78)", zIndex:10, animation:"fadeIn 0.3s both" }}>
                <div style={{ fontSize:52 }}>{mode.emoji}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,6vw,48px)", letterSpacing:3, color:mode.color, textShadow:`0 0 30px ${mode.color}` }}>{mode.label.toUpperCase()}</div>
                <div style={{ fontSize:13, color:"#555", textAlign:"center", maxWidth:260, lineHeight:1.6 }}>{mode.desc}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#333", letterSpacing:2, animation:"pulse 1.5s infinite" }}>starting round 1...</div>
              </div>
            )}

            {/* ── PLAYING overlay ── */}
            {phase==="playing" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:14, gap:10, zIndex:4 }}>

                {/* You smiled warning */}
                {gameMode==="dontlaugh" && smileDetected && (
                  <div style={{ position:"absolute", top:"42%", left:"50%", transform:"translate(-50%,-50%)", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(36px,8vw,56px)", color:"#ff4d6d", textShadow:"0 0 30px rgba(255,77,109,0.9)", animation:"smileWarn 0.3s infinite", whiteSpace:"nowrap", zIndex:8 }}>
                    YOU SMILED! 😂
                  </div>
                )}

                {/* prompt bar at bottom */}
                {(gameMode==="dontlaugh"||gameMode==="vibecheck"||gameMode==="hottake") && (
                  <div style={{ background:"rgba(0,0,0,0.75)", backdropFilter:"blur(14px)", borderRadius:12, padding:"12px 16px", border:`1px solid ${mode.color}33` }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:mode.color, letterSpacing:2, marginBottom:5 }}>
                      {gameMode==="dontlaugh"?"IMAGINE THIS:":gameMode==="hottake"?"HOT TAKE:":"YOUR VIBE:"}
                    </div>
                    <div style={{ fontSize:"clamp(13px,2vw,16px)", fontWeight:600, color:"#f0eeea", lineHeight:1.4 }}>{currentPrompt}</div>
                  </div>
                )}

                {/* Mirror Me controls */}
                {gameMode==="mirrorme" && (
                  <div style={{ background:"rgba(0,0,0,0.75)", backdropFilter:"blur(14px)", borderRadius:12, padding:"12px 16px", border:`1px solid ${mode.color}33` }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:mode.color, letterSpacing:2, marginBottom:5 }}>
                      {mirrorPhase==="pose"?"MAKE THIS FACE:":"NOW COPY IT EXACTLY:"}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#f0eeea", lineHeight:1.4, marginBottom:mirrorPhase==="pose"?10:0 }}>{currentPrompt}</div>
                    {mirrorPhase==="pose" && (
                      <button onClick={captureMyPose} style={{ background:`linear-gradient(135deg,${mode.color},#00d4ff)`, color:"#0a0a0a", border:"none", borderRadius:8, padding:"8px 20px", fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:2, cursor:"pointer" }}>
                        CAPTURE POSE
                      </button>
                    )}
                    {myMirrorScore!==null && (
                      <div style={{ marginTop:6, fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:mode.color }}>Accuracy: {myMirrorScore}/100</div>
                    )}
                  </div>
                )}

                {/* vote trigger */}
                {(gameMode==="vibecheck"||gameMode==="hottake") && !voting && timer<=mode.duration-5 && (
                  <button onClick={triggerVote} style={{ background:`linear-gradient(135deg,${mode.color},#a064ff)`, color:"#0a0a0a", border:"none", borderRadius:10, padding:"11px 0", fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:2, cursor:"pointer" }}>
                    START CROWD VOTE
                  </button>
                )}

                {/* vote bars */}
                {voting && (
                  <div style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(14px)", borderRadius:12, padding:14, border:`1px solid ${mode.color}33` }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#444", letterSpacing:2, marginBottom:10 }}>CROWD VOTE</div>
                    <VoteBar label="you 🇳🇵"    pct={myVotePct}  color="#00f5a0" isMe />
                    <VoteBar label={`${opponent.name} ${opponent.flag}`} pct={oppVotePct} color="#ff4d6d" />
                  </div>
                )}
              </div>
            )}

            {/* ── ROUND RESULT ── */}
            {phase==="roundResult" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, background:"rgba(8,8,9,0.88)", zIndex:10, animation:"fadeIn 0.3s both" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(48px,10vw,80px)", letterSpacing:4, lineHeight:1, color:roundResult==="win"?"#00f5a0":"#ff4d6d", textShadow:`0 0 40px ${roundResult==="win"?"rgba(0,245,160,0.7)":"rgba(255,77,109,0.7)"}`, animation:"winPop 0.5s both" }}>
                  {roundResult==="win"?"YOU WIN!":"YOU LOSE"}
                </div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#444" }}>
                  {round < TOTAL_ROUNDS ? `round ${round+1} starting...` : "wrapping up..."}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, overflow:"hidden" }}>

          {/* mode info */}
          <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14, animation:"fadeUp 0.4s both" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:24 }}>{mode.emoji}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:mode.color }}>{mode.label}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#444" }}>round {round}/{TOTAL_ROUNDS}</div>
              </div>
            </div>
            <div style={{ fontSize:12, color:"#3a3a3f", lineHeight:1.5, marginBottom:10 }}>{mode.desc}</div>
            <div style={{ padding:"8px 12px", background:"rgba(255,214,10,0.07)", border:"1px solid rgba(255,214,10,0.14)", borderRadius:10, fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffd60a" }}>
              🏆 {entryFee*2} pts pot
            </div>
          </div>

          {/* round tracker */}
          <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
            <div style={{ fontSize:10, color:"#444", letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>rounds</div>
            {Array.from({length:TOTAL_ROUNDS}).map((_,i)=>{
              const s = myRoundScores[i];
              const active = i+1===round && phase==="playing";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:s==="win"?"#00f5a0":s==="loss"?"#ff4d6d":active?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.08)", boxShadow:s?`0 0 6px ${s==="win"?"#00f5a0":"#ff4d6d"}`:active?"0 0 6px rgba(255,255,255,0.3)":"none", transition:"all 0.3s" }} />
                  <div style={{ fontSize:12, color:s?"#d0cec8":active?"#888":"#333" }}>
                    Round {i+1} {s?(s==="win"?"· won":"· lost"):active?"· now playing":"· upcoming"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* opponent */}
          <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
            <div style={{ fontSize:10, color:"#444", letterSpacing:3, textTransform:"uppercase", marginBottom:10 }}>opponent</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,77,109,0.1)", border:"1px solid rgba(255,77,109,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{opponent.avatar}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600 }}>{opponent.name} {opponent.flag}</div>
<div style={{ fontSize:11, color:rankColor(opponent?.pts || 0) }}>{getRank(opponent?.pts || 0)} · {(opponent?.pts || 0).toLocaleString()} pts</div>              </div>
            </div>
          </div>

          {/*
            BUGFIX — removed the fake "crowd watching" reaction panel here.
            This is GameScreen.jsx — the direct 1v1 Play screen between two
            matched strangers. There is no real crowd in this view; the panel
            was hardcoded fake spectator names and a fake "84 watching" count,
            cluttering the sidebar during a private match. Crowd reactions /
            emoji bar belongs in the separate Watch Live spectator screen,
            not here. If you want quick reactions between the two players
            themselves (not a crowd), that's a different, smaller feature —
            ask for it separately and it can be added back in a minimal form.
          */}
        </div>
      </div>

      {/* ══════ MATCH RESULT FULLSCREEN ══════ */}
      {phase==="matchResult" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(8,8,9,0.96)", backdropFilter:"blur(20px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, zIndex:500, animation:"fadeIn 0.4s both" }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(56px,12vw,96px)", letterSpacing:4, lineHeight:1, color:matchWon?"#00f5a0":"#ff4d6d", textShadow:`0 0 60px ${matchWon?"rgba(0,245,160,0.7)":"rgba(255,77,109,0.7)"}`, animation:"winPop 0.6s both" }}>
            {matchWon?"YOU WIN 🎉":"YOU LOSE 💀"}
          </div>

          <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
            {[["rounds won",myScore,"#00f5a0"],["rounds lost",oppScore,"#ff4d6d"],["pts pot",entryFee*2,"#ffd60a"]].map(([l,v,c])=>(
              <div key={l} style={{ textAlign:"center", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"14px 20px" }}>
                <div style={{ fontSize:10, color:"#444", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:44, color:c, lineHeight:1 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, color:matchWon?"#ffd60a":"#ff4d6d", background:matchWon?"rgba(255,214,10,0.08)":"rgba(255,77,109,0.08)", border:`1px solid ${matchWon?"rgba(255,214,10,0.2)":"rgba(255,77,109,0.2)"}`, borderRadius:12, padding:"11px 28px" }}>
            {matchWon ? `+${entryFee} pts earned` : `-${entryFee} pts lost`}
          </div>

          <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
            <button onClick={playAgain} style={{ background:"linear-gradient(135deg,#00f5a0,#00d4ff)", color:"#0a0a0a", border:"none", borderRadius:12, padding:"13px 32px", fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:2, cursor:"pointer", boxShadow:"0 0 30px rgba(0,245,160,0.35)" }}>PLAY AGAIN</button>
            {onBack && <button onClick={()=>{ cleanup(); onBack(); }} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"13px 24px", color:"#555", fontSize:14, cursor:"pointer" }}>Exit</button>}
          </div>
        </div>
      )}
    </div>
  );
}
