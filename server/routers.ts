import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { emitRoomEvent, emitUserEvent } from "./realtime";
import { sdk } from "./_core/sdk";
import { createPasswordHash, normalizeUsername, verifyPassword } from "./local-auth";
import { TRPCError } from "@trpc/server";

const roomInput = z.object({ roomId: z.number().int().positive() });
const accountCredentialsInput = z.object({
  username: z.string().trim().min(3, "Tên tài khoản cần ít nhất 3 ký tự").max(24).regex(/^[a-zA-Z0-9_.-]+$/, "Chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang"),
  password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự").max(128),
});
const issueLocalSession = async (ctx: any, user: { openId: string; name: string | null }) => {
  const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "chatpht member", expiresInMs: 7 * 24 * 60 * 60 * 1000 });
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  return token;
};
const authenticateLocalUser = async (ctx: any, input: z.infer<typeof accountCredentialsInput>) => {
  const login = await db.getLocalLogin(normalizeUsername(input.username));
  if (!login || !(await verifyPassword(input.password, login.passwordHash))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Tên tài khoản hoặc mật khẩu không đúng" });
  }
  if (login.user.deletedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Tài khoản này đã bị xóa" });
  if (login.user.suspendedUntil && login.user.suspendedUntil.getTime() > Date.now()) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Tài khoản đang bị chặn đến ${login.user.suspendedUntil.toLocaleString("vi-VN")}` });
  }
  const token = await issueLocalSession(ctx, login.user);
  return { token, user: login.user };
};
const requireRoomAdmin = async (roomId: number, userId: number) => {
  const membership = await db.getRoomMembership(roomId, userId);
  if (!membership || membership.role !== "admin") throw new Error("Room administrator permission required");
  return membership;
};
const notifyRoomMessage = async (roomId: number, senderId: number, senderName: string | null, message: Awaited<ReturnType<typeof db.createMessage>>) => {
  const members = await db.getRoomMembers(roomId);
  members.filter((member) => member.userId !== senderId).forEach((member) => emitUserEvent(member.userId, "message:notify", { ...message, senderName: senderName ?? "Người dùng" }));
};

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure.input(accountCredentialsInput).mutation(async ({ ctx, input }) => {
      const username = normalizeUsername(input.username);
      if (await db.getLocalLogin(username)) throw new TRPCError({ code: "CONFLICT", message: "Tên tài khoản đã được sử dụng" });
      const user = await db.createLocalUser(username, await createPasswordHash(input.password));
      const token = await issueLocalSession(ctx, user);
      return { token, user };
    }),
    login: publicProcedure.input(accountCredentialsInput).mutation(({ ctx, input }) => authenticateLocalUser(ctx, input)),
    loginLocal: publicProcedure.input(accountCredentialsInput).mutation(({ ctx, input }) => authenticateLocalUser(ctx, input)),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
      const login = await db.getLocalLoginByUserId(ctx.user.id);
      if (!login || !(await verifyPassword(input.currentPassword, login.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Mật khẩu hiện tại không đúng" });
      await db.updateLocalPassword(ctx.user.id, await createPasswordHash(input.newPassword));
      return { success: true };
    }),
    updateAvatar: protectedProcedure.input(z.object({ avatarUrl: z.string().url() })).mutation(async ({ ctx, input }) => {
      const user = await db.updateUserAvatar(ctx.user.id, input.avatarUrl);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy người dùng" });
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  people: router({
    search: protectedProcedure.input(z.object({ query: z.string().trim().min(1).max(64) })).query(({ ctx, input }) => db.searchUsers(input.query, ctx.user.id)),
    friends: protectedProcedure.query(({ ctx }) => db.getFriends(ctx.user.id)),
    requests: protectedProcedure.query(({ ctx }) => db.getIncomingFriendRequests(ctx.user.id)),
    outgoingRequests: protectedProcedure.query(({ ctx }) => db.getOutgoingFriendRequests(ctx.user.id)),
    respondToRequest: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), accept: z.boolean() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await db.respondToFriendRequest(ctx.user.id, input.requestId, input.accept);
        emitUserEvent(result.requestedBy, "friend:request-updated", { requestId: result.id, status: result.status });
        return result;
      } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Không thể phản hồi lời mời" }); }
    }),
    addFriend: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await db.addFriend(ctx.user.id, input.userId);
        if (result.status === "pending") emitUserEvent(input.userId, "friend:request", { fromUserId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Không thể kết bạn" });
      }
    }),
  }),
  chat: router({
    rooms: protectedProcedure.query(({ ctx }) => db.getUserRooms(ctx.user.id)),
    room: protectedProcedure.input(roomInput).query(async ({ ctx, input }) => {
      const room = await db.getRoomForMember(input.roomId, ctx.user.id);
      if (!room) throw new Error("Room not found or access denied");
      return room;
    }),
    createRoom: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional(), memberIds: z.array(z.number().int().positive()).max(50).default([]) })).mutation(() => { throw new TRPCError({ code: "BAD_REQUEST", message: "Tạo nhóm đang được ẩn; ChatPHT hiện chỉ hỗ trợ trò chuyện 1:1." }); }),
    createDirect: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new Error("Không thể tạo cuộc trò chuyện với chính bạn");
      return db.getOrCreateDirectRoom(ctx.user.id, input.userId);
    }),
    members: protectedProcedure.input(roomInput).query(async ({ ctx, input }) => {
      if (!(await db.getRoomMembership(input.roomId, ctx.user.id))) throw new Error("Room access denied");
      return db.getRoomMembers(input.roomId);
    }),
    addMember: protectedProcedure.input(roomInput.extend({ userId: z.number().int().positive() })).mutation(() => { throw new TRPCError({ code: "BAD_REQUEST", message: "Quản lý thành viên nhóm đang được ẩn; ChatPHT chỉ dùng 1:1." }); }),
    setMemberRole: protectedProcedure.input(roomInput.extend({ userId: z.number().int().positive(), role: z.enum(["member", "admin"]) })).mutation(() => { throw new TRPCError({ code: "BAD_REQUEST", message: "Phân quyền nhóm đang được ẩn; ChatPHT chỉ dùng 1:1." }); }),
    removeMember: protectedProcedure.input(roomInput.extend({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireRoomAdmin(input.roomId, ctx.user.id);
      await db.removeRoomMember(input.roomId, input.userId);
      emitRoomEvent(input.roomId, "room:member-removed", { userId: input.userId });
      return { ok: true };
    }),
    messages: protectedProcedure.input(roomInput.extend({ limit: z.number().int().min(1).max(100).default(50) })).query(async ({ ctx, input }) => {
      if (!(await db.getRoomMembership(input.roomId, ctx.user.id))) throw new Error("Room access denied");
      return db.getRoomMessages(input.roomId, input.limit);
    }),
    sendMessage: protectedProcedure.input(roomInput.extend({ body: z.string().trim().min(1).max(4000), clientMessageId: z.string().min(8).max(80) })).mutation(async ({ ctx, input }) => {
      if (!(await db.getRoomMembership(input.roomId, ctx.user.id))) throw new Error("Room access denied");
      const message = await db.createMessage({ roomId: input.roomId, senderId: ctx.user.id, clientMessageId: input.clientMessageId, body: input.body, kind: "text" });
      emitRoomEvent(input.roomId, "message:new", message);
      await notifyRoomMessage(input.roomId, ctx.user.id, ctx.user.name, message);
      return message;
    }),
    sendSticker: protectedProcedure.input(roomInput.extend({ sticker: z.string().trim().min(1).max(24), clientMessageId: z.string().min(8).max(80) })).mutation(async ({ ctx, input }) => {
      if (!(await db.getRoomMembership(input.roomId, ctx.user.id))) throw new Error("Room access denied");
      const message = await db.createMessage({ roomId: input.roomId, senderId: ctx.user.id, clientMessageId: input.clientMessageId, body: input.sticker, kind: "sticker" });
      emitRoomEvent(input.roomId, "message:new", message);
      await notifyRoomMessage(input.roomId, ctx.user.id, ctx.user.name, message);
      return message;
    }),
    markDelivered: protectedProcedure.input(roomInput.extend({ messageIds: z.array(z.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      if (!(await db.getRoomMembership(input.roomId, ctx.user.id))) throw new Error("Room access denied");
      await db.markMessagesDelivered(input.messageIds, ctx.user.id);
      emitRoomEvent(input.roomId, "message:receipt", { messageIds: input.messageIds, userId: ctx.user.id, status: "delivered" });
      return { ok: true };
    }),
    markRead: protectedProcedure.input(roomInput.extend({ messageIds: z.array(z.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      if (!(await db.getRoomMembership(input.roomId, ctx.user.id))) throw new Error("Room access denied");
      await db.markMessagesRead(input.messageIds, ctx.user.id);
      emitRoomEvent(input.roomId, "message:receipt", { messageIds: input.messageIds, userId: ctx.user.id, status: "read" });
      return { ok: true };
    }),
  }),
  calls: router({
    provider: protectedProcedure.query(() => ({ configured: Boolean(process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL), transport: "p2p-firestore" as const })),
    create: protectedProcedure.input(roomInput.extend({ mode: z.enum(["voice", "video", "share"]).default("video") })).mutation(async ({ ctx, input }) => {
      const room = await db.getRoomForMember(input.roomId, ctx.user.id);
      if (!room?.kind || room.kind !== "direct") throw new TRPCError({ code: "BAD_REQUEST", message: "P2P chỉ hỗ trợ cuộc trò chuyện 1:1." });
      const session = await db.createCallSession(input.roomId, ctx.user.id, input.mode);
      const callMessage = await db.createMessage({ roomId: input.roomId, senderId: ctx.user.id, clientMessageId: `call-offer-${session.id}`, body: `CALL_EVENT:${session.id}:${session.mode}:ringing`, kind: "system" });
      const members = await db.getRoomMembers(input.roomId);
      const invite = { ...session, callerName: ctx.user.name ?? "Người dùng", callerAvatar: ctx.user.avatarUrl ?? null };
      members.filter((member) => member.userId !== ctx.user.id).forEach((member) => emitUserEvent(member.userId, "call:invite", invite));
      emitRoomEvent(input.roomId, "call:created", session);
      emitRoomEvent(input.roomId, "message:new", callMessage);
      return session;
    }),
    answer: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const session = await db.getCallSessionForMember(input.sessionId, ctx.user.id);
      if (!session) throw new Error("Call access denied");
      await db.joinCallSession(input.sessionId, ctx.user.id);
      emitRoomEvent(session.roomId, "call:participant-joined", { sessionId: session.id, userId: ctx.user.id });
      return { session, transport: "p2p-firestore" as const };
    }),
    join: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const session = await db.getCallSessionForMember(input.sessionId, ctx.user.id);
      if (!session) throw new Error("Call access denied");
      await db.joinCallSession(input.sessionId, ctx.user.id);
      emitRoomEvent(session.roomId, "call:participant-joined", { sessionId: session.id, userId: ctx.user.id });
      return { session, transport: "p2p-firestore" as const };
    }),
    leave: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const session = await db.getCallSessionForMember(input.sessionId, ctx.user.id);
      if (!session) throw new Error("Call access denied");
      await db.leaveCallSession(input.sessionId, ctx.user.id);
      emitRoomEvent(session.roomId, "call:participant-left", { sessionId: session.id, userId: ctx.user.id });
      return { ok: true };
    }),
    decline: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const session = await db.getCallSessionForMember(input.sessionId, ctx.user.id);
      if (!session) throw new Error("Call access denied");
      if (session.createdBy === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Người tạo phiên không thể từ chối lời mời của chính mình" });
      const room = await db.getRoomForMember(session.roomId, ctx.user.id);
      const members = await db.getRoomMembers(session.roomId);
      emitUserEvent(session.createdBy, "call:declined", { sessionId: session.id, userId: ctx.user.id });
      if (room?.kind === "direct") {
        await db.endCallSession(session.id);
        const callMessage = await db.createMessage({ roomId: session.roomId, senderId: ctx.user.id, clientMessageId: `call-declined-${session.id}-${ctx.user.id}`, body: `CALL_EVENT:${session.id}:${session.mode}:ended`, kind: "system" });
        members.forEach((member) => emitUserEvent(member.userId, "call:ended", { sessionId: session.id }));
        emitRoomEvent(session.roomId, "call:ended", { sessionId: session.id });
        emitRoomEvent(session.roomId, "message:new", callMessage);
      }
      return { ok: true };
    }),
    end: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const session = await db.getCallSessionForMember(input.sessionId, ctx.user.id);
      if (!session) throw new Error("Call access denied");
      const membership = await db.getRoomMembership(session.roomId, ctx.user.id);
      if (session.createdBy !== ctx.user.id && membership?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ người tạo hoặc admin phòng có thể kết thúc cuộc gọi" });
      await db.endCallSession(session.id);
      const callMessage = await db.createMessage({ roomId: session.roomId, senderId: ctx.user.id, clientMessageId: `call-ended-${session.id}`, body: `CALL_EVENT:${session.id}:${session.mode}:ended`, kind: "system" });
      const members = await db.getRoomMembers(session.roomId);
      members.forEach((member) => emitUserEvent(member.userId, "call:ended", { sessionId: session.id }));
      emitRoomEvent(session.roomId, "call:ended", { sessionId: session.id });
      emitRoomEvent(session.roomId, "message:new", callMessage);
      return { ok: true };
    }),
    getJoinable: protectedProcedure.query(({ ctx }) => db.getJoinableCallSessions(ctx.user.id)),
    participants: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      if (!(await db.getCallSessionForMember(input.sessionId, ctx.user.id))) throw new Error("Call access denied");
      return db.getCallParticipants(input.sessionId);
    }),
  }),
  admin: router({
    metrics: adminProcedure.query(() => db.getAdminMetrics()),
    p2p: adminProcedure.query(() => ({ configured: Boolean(process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL), firestoreConfigured: Boolean(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID && process.env.EXPO_PUBLIC_FIREBASE_API_KEY) })),
    users: adminProcedure.query(() => db.getAdminUsers()),
    setUserRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId && input.role === "user") throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể tự gỡ quyền admin của chính mình" });
      return db.setAdminUserRole(input.userId, input.role);
    }),
    suspendUser: adminProcedure.input(z.object({ userId: z.number().int().positive(), durationDays: z.number().int().min(1).max(365) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể tự chặn tài khoản của chính mình" });
      const target = await db.getAdminUserById(input.userId);
      if (!target || target.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" });
      if (target.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Không thể chặn tài khoản quản trị" });
      return db.suspendAdminUser(input.userId, input.durationDays);
    }),
    restoreUser: adminProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể thay đổi trạng thái của chính mình" });
      const target = await db.getAdminUserById(input.userId);
      if (!target || target.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" });
      if (target.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Không thể thay đổi tài khoản quản trị" });
      return db.restoreAdminUser(input.userId);
    }),
    deleteUser: adminProcedure.input(z.object({ userId: z.number().int().positive(), confirmation: z.literal("DELETE") })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể tự xóa tài khoản của chính mình" });
      const target = await db.getAdminUserById(input.userId);
      if (!target || target.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" });
      if (target.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Không thể xóa tài khoản quản trị" });
      return db.deleteAdminUser(input.userId);
    }),
    activeCalls: adminProcedure.query(() => db.getActiveCallsForAdmin()),
    endCall: adminProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input }) => {
      await db.endCallSession(input.sessionId);
      return { ok: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
