import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import * as db from "./db";
import { sdk, type AuthenticatedUser } from "./_core/sdk";

let io: Server | null = null;
const channel = (roomId: number) => `room:${roomId}`;
const userChannel = (userId: number) => `user:${userId}`;
const activeSockets = new Map<number, Set<string>>();

export function emitRoomEvent(roomId: number, event: string, payload: unknown) {
  io?.to(channel(roomId)).emit(event, payload);
}

export function emitUserEvent(userId: number, event: string, payload: unknown) {
  io?.to(userChannel(userId)).emit(event, payload);
}

function onlineUserIds() { return [...activeSockets.entries()].filter(([, sockets]) => sockets.size > 0).map(([userId]) => userId); }

export function registerRealtime(server: HttpServer) {
  io = new Server(server, {
    path: "/api/socket.io",
    cors: { origin: true, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      socket.data.user = await sdk.authenticateRequest(socket.request as any);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthenticatedUser;
    socket.join(userChannel(user.id));
    const existing = activeSockets.get(user.id) ?? new Set<string>();
    const wasOffline = existing.size === 0;
    existing.add(socket.id);
    activeSockets.set(user.id, existing);
    socket.emit("presence:snapshot", onlineUserIds());
    if (wasOffline) io?.emit("presence:online", { userId: user.id });

    socket.on("room:join", async ({ roomId }: { roomId: number }, acknowledge?: (result: { ok: boolean }) => void) => {
      const membership = await db.getRoomMembership(roomId, user.id);
      if (!membership) return acknowledge?.({ ok: false });
      await socket.join(channel(roomId));
      acknowledge?.({ ok: true });
    });

    socket.on("room:leave", ({ roomId }: { roomId: number }) => socket.leave(channel(roomId)));

    socket.on("typing", async ({ roomId, isTyping }: { roomId: number; isTyping: boolean }) => {
      const membership = await db.getRoomMembership(roomId, user.id);
      if (membership) socket.to(channel(roomId)).emit("typing", { roomId, userId: user.id, isTyping });
    });

    socket.on("message:send", async (payload: { roomId: number; body: string }, acknowledge?: (result: { ok: boolean; message?: unknown }) => void) => {
      const membership = await db.getRoomMembership(payload.roomId, user.id);
      const body = payload.body?.trim();
      if (!membership || !body || body.length > 4000) return acknowledge?.({ ok: false });
      const message = await db.createMessage({ roomId: payload.roomId, senderId: user.id, body, kind: "text" });
      emitRoomEvent(payload.roomId, "message:new", message);
      acknowledge?.({ ok: true, message });
    });

    socket.on("disconnect", () => {
      const sockets = activeSockets.get(user.id);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        activeSockets.delete(user.id);
        io?.emit("presence:offline", { userId: user.id });
      }
    });
  });

  return io;
}
