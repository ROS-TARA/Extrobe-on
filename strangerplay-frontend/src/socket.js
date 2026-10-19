import { io } from "socket.io-client";

/*
  SOCKET CONNECTION

  Env var (set on your frontend host, e.g. Netlify/Vercel):
    VITE_SOCKET_URL = https://extrobe-on.onrender.com
  If unset, the production Render URL below is used.

  AUTH: the JWT is sent in the Socket.IO handshake (`auth.token`), read from
  localStorage key "tz_token" (the key LoginSignup/Profile/Settings use).
  The server verifies it before the socket is considered connected, so there
  is no window where the socket is connected-but-not-yet-authenticated.

  The token is re-read on EVERY reconnect attempt, so a reconnecting socket
  never goes out with a stale or missing token. After login or logout, call
  reconnectSocket() so the handshake carries the new token.
*/
export const TOKEN_KEY = "tz_token";
export const USER_KEY  = "tz_user";

const readToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
};

export const socket = io(import.meta.env.VITE_SOCKET_URL || "https://extrobe-on.onrender.com", {
  auth: { token: readToken() },
  // Keep trying if Render is waking up (free tier sleeps after 15 min idle)
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 2000,
  // WebSocket is faster; polling is the fallback if WebSocket is blocked
  transports: ["websocket", "polling"],
});

// Automatic reconnects: refresh the token before each attempt.
socket.io.on("reconnect_attempt", () => {
  socket.auth = { token: readToken() };
});

// Call after login / logout / session cleanup. Drops the current connection
// and opens a new one whose handshake carries the current token.
export function reconnectSocket() {
  socket.auth = { token: readToken() };
  if (socket.connected) socket.disconnect();
  socket.connect();
}
