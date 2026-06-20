import { io } from "socket.io-client";
 
/*
  SOCKET CONNECTION — reads VITE_SOCKET_URL from environment
  
  ── LOCAL DEV ──
  In strangerplay-frontend/.env:
    VITE_SOCKET_URL=http://localhost:3001
  
  ── PRODUCTION (Netlify + Render) ──
  On Netlify dashboard:
    Site Settings → Environment Variables → Add variable
    Key:   VITE_SOCKET_URL
    Value: https://YOUR-APP-NAME.onrender.com
  
  THIS IS WHY MATCHMAKING FAILS ON NETLIFY:
  Without VITE_SOCKET_URL set in Netlify env vars, the code
  falls back to "http://localhost:3001" — which is YOUR laptop,
  not a server. Netlify's build machine has no localhost server.
  The socket connects to nothing → queue:join goes nowhere → no match.
*/
export const socket = io(import.meta.env.VITE_SOCKET_URL || "https://extrobe-on.onrender.com", {
  // Keep trying if Render is waking up (free tier sleeps after 15 min idle)
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 2000,
  // WebSocket is faster; polling is the fallback if WebSocket is blocked
  transports: ["websocket", "polling"],
});
 