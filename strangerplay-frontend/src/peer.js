/*
  peer.js — one WebRTC call between two matched users.
  Framework-free on purpose (no React) so it can be tested in Node.

  Signaling goes through the existing Socket.IO connection:
    webrtc:ready  (we → server)   "my listeners are attached"
    webrtc:start  (server → offerer) both sides are ready, send the offer now
    webrtc:offer / webrtc:answer / webrtc:ice   relayed to the other player

  Why the ready gate exists: the offerer used to send its offer a fixed
  150 ms after matching. If the other browser had not attached its listener
  yet (slow network, far away), the offer was dropped and nobody ever got
  video. Now the offer is only sent after the server confirms both are ready.

  onState({ phase, detail, route }) phases:
    "signaling" → "connecting" → "connected"  or  "failed"
    route (when connected): "direct" | "relay" | "unknown"
*/
export const DEFAULT_ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function parseIceServers(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    console.warn("VITE_ICE_SERVERS is not valid JSON — ignoring it");
    return null;
  }
}

export function createPeer({
  socket,
  roomId,
  role,                          // "offer" | "answer"
  stream = null,                 // local MediaStream (camera + mic)
  iceServers = DEFAULT_ICE,
  PeerConnection = globalThis.RTCPeerConnection,
  connectTimeoutMs = 25000,
  disconnectGraceMs = 5000,
  maxIceRestarts = 2,
  onRemoteStream = () => {},
  onState = () => {},
}) {
  let closed = false;
  let restarts = 0;
  let offerSent = false;
  let connectedOnce = false;
  let timeoutTimer = null;
  let disconnectTimer = null;
  const pendingIce = [];

  const pc = new PeerConnection({ iceServers });

  const emitState = (phase, detail, route) => {
    if (!closed) onState({ phase, detail, route });
  };
  emitState("signaling", "Waiting for the other side…");

  // Our media. With no camera we still ask to RECEIVE audio/video, so the
  // offer always contains media sections (an offer with none can never
  // deliver video to us).
  const tracks = stream ? stream.getTracks() : [];
  if (tracks.length) {
    tracks.forEach((t) => pc.addTrack(t, stream));
  } else {
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });
  }

  pc.ontrack = (ev) => {
    const rs = ev.streams && ev.streams[0];
    if (rs) onRemoteStream(rs);
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate && !closed) {
      socket.emit("webrtc:ice", {
        roomId,
        candidate: typeof candidate.toJSON === "function" ? candidate.toJSON() : candidate,
      });
    }
  };

  async function routeType() {
    try {
      const stats = await pc.getStats();
      let pairId = null;
      stats.forEach((r) => {
        if (r.type === "transport" && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId;
      });
      let pair = pairId ? stats.get(pairId) : null;
      if (!pair) stats.forEach((r) => { if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") pair = r; });
      if (!pair) return "unknown";
      const local = stats.get(pair.localCandidateId);
      const remote = stats.get(pair.remoteCandidateId);
      const types = [local && local.candidateType, remote && remote.candidateType];
      return types.includes("relay") ? "relay" : "direct";
    } catch {
      return "unknown";
    }
  }

  async function sendOffer(iceRestart = false) {
    try {
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", { roomId, sdp: pc.localDescription });
      offerSent = true;
    } catch (e) {
      console.error("createOffer failed:", e);
      emitState("failed", "Couldn't start the call: " + (e && e.message));
    }
  }

  async function flushIce() {
    while (pendingIce.length) {
      const c = pendingIce.shift();
      try { await pc.addIceCandidate(c); } catch (e) { /* stale candidate */ }
    }
  }

  async function onOffer({ sdp }) {
    if (closed) return;
    try {
      await pc.setRemoteDescription(sdp);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { roomId, sdp: pc.localDescription });
      emitState("connecting", "Negotiating connection…");
    } catch (e) {
      console.error("handling offer failed:", e);
      emitState("failed", "Call setup failed: " + (e && e.message));
    }
  }

  async function onAnswer({ sdp }) {
    if (closed) return;
    try {
      await pc.setRemoteDescription(sdp);
      await flushIce();
      emitState("connecting", "Negotiating connection…");
    } catch (e) {
      console.error("handling answer failed:", e);
      emitState("failed", "Call setup failed: " + (e && e.message));
    }
  }

  async function onIce({ candidate }) {
    if (closed || !candidate) return;
    if (!pc.remoteDescription) { pendingIce.push(candidate); return; }
    try { await pc.addIceCandidate(candidate); } catch (e) { /* stale candidate */ }
  }

  function onStart() {
    if (closed || role !== "offer" || offerSent) return;
    sendOffer();
  }

  function tryRestart() {
    if (closed || role !== "offer") return;
    if (restarts >= maxIceRestarts) {
      emitState("failed", "Couldn't connect. Your network may be blocking direct video — a TURN relay server is needed.");
      return;
    }
    restarts += 1;
    emitState("connecting", `Retrying connection (${restarts}/${maxIceRestarts})…`);
    sendOffer(true);
  }

  pc.oniceconnectionstatechange = async () => {
    if (closed) return;
    const st = pc.iceConnectionState;
    if (st === "checking") emitState("connecting", "Finding a network path…");
    if (st === "connected" || st === "completed") {
      clearTimeout(timeoutTimer);
      clearTimeout(disconnectTimer);
      connectedOnce = true;
      emitState("connected", "Connected", await routeType());
    }
    if (st === "disconnected") {
      emitState("connecting", "Connection unstable…");
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => {
        if (!closed && pc.iceConnectionState === "disconnected") tryRestart();
      }, disconnectGraceMs);
    }
    if (st === "failed") tryRestart();
  };

  // Overall give-up timer so the UI never spins forever.
  timeoutTimer = setTimeout(() => {
    if (!closed && !connectedOnce) {
      emitState("failed", "Timed out connecting. Your network may be blocking direct video — a TURN relay server is needed.");
    }
  }, connectTimeoutMs);

  socket.on("webrtc:start", onStart);
  socket.on("webrtc:offer", onOffer);
  socket.on("webrtc:answer", onAnswer);
  socket.on("webrtc:ice", onIce);

  // Listeners are attached — NOW tell the server we're ready.
  socket.emit("webrtc:ready", { roomId });

  return {
    pc,
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timeoutTimer);
      clearTimeout(disconnectTimer);
      socket.off("webrtc:start", onStart);
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice", onIce);
      try { pc.close(); } catch {}
    },
  };
}
