import { io, Socket } from "socket.io-client";
import { resolveApiOrigin } from "./apiBase";

export interface SocialProofEvent {
  id: string;
  type: "deposit" | "level_up" | "earning";
  message: string;
  createdAt: string;
}

let socket: Socket | null = null;
let listenersAttached = false;

function getAccessTokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem("authTokens");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { accessToken?: unknown };
    const token = parsed?.accessToken;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function getRealtimeSocket(): Socket | null {
  const token = getAccessTokenFromStorage();
  if (!token) {
    return null;
  }

  if (socket && socket.connected) {
    return socket;
  }

  const url = resolveApiOrigin();

  socket = io(url, {
    autoConnect: true,
    transports: ["websocket"],
    auth: {
      token
    }
  });

  if (!listenersAttached) {
    listenersAttached = true;
  }

  return socket;
}

