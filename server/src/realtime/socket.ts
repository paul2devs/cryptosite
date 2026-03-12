import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import { User } from "../models/User";
import { Deposit } from "../models/Deposit";

interface AuthedSocket extends Socket {
  userId?: string;
}

interface SocialProofEvent {
  id: string;
  type: "deposit" | "level_up" | "earning";
  message: string;
  createdAt: string;
}

let io: Server | null = null;
const userSockets = new Map<string, Set<string>>();

export function initSocketServer(server: HttpServer): void {
  if (io) {
    return;
  }

  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173"
    }
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth && (socket.handshake.auth.token as string | undefined)) ||
      (socket.handshake.query && (socket.handshake.query.token as string | undefined));

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const authed = socket as AuthedSocket;
    const userId = authed.userId;
    if (userId) {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);
    }

    socket.on("disconnect", () => {
      if (!userId) {
        return;
      }
      const set = userSockets.get(userId);
      if (!set) {
        return;
      }
      set.delete(socket.id);
      if (set.size === 0) {
        userSockets.delete(userId);
      }
    });
  });
}

export function emitSocialProofDeposit(deposit: Deposit, userAlias: string): void {
  if (!io) {
    return;
  }
  const event: SocialProofEvent = {
    id: deposit.deposit_id,
    type: "deposit",
    message: `${userAlias} just deposited ${deposit.amount} ${deposit.crypto_type}`,
    createdAt: new Date(deposit.timestamp || new Date()).toISOString()
  };
  io.emit("social_proof_event", event);
}

export function emitLevelUpEvent(user: User, level: number): void {
  if (!io) {
    return;
  }
  const alias = `${user.name.slice(0, 2).toUpperCase()}${user.user_id.slice(0, 2)}`;
  const event: SocialProofEvent = {
    id: `${user.user_id}:${level}:${Date.now()}`,
    type: "level_up",
    message: `Level ${level} unlocked by user ${alias}`,
    createdAt: new Date().toISOString()
  };
  io.emit("social_proof_event", event);
}

