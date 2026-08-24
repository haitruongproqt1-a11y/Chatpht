import { and, desc, eq, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import {
  callParticipants,
  callSessions,
  chatRooms,
  friendships,
  InsertUser,
  localCredentials,
  messageDeliveries,
  messageReads,
  messages,
  roomMembers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: MySql2Database<Record<string, never>> | null = null;
let _pool: Pool | null = null;

async function withDatabaseTimeout<T>(operation: Promise<T>, timeoutMs = 8_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new Error("Database connection timed out")), timeoutMs); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Use a small reusable pool. A direct one-off connection can remain pending on
// a degraded deployment and leave native authentication requests spinning.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createPool(process.env.DATABASE_URL);
      await withDatabaseTimeout(_pool.query("SELECT 1"));
      _db = drizzle({ client: _pool });
    } catch (error) {
      console.warn("[Database] Failed to initialize pool:", error instanceof Error ? error.message : error);
      void _pool?.end().catch(() => undefined);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertLocalAdmin(passwordHash: string) {
  const db = await requireDb();
  const openId = "local:admin";
  let admin = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
  if (!admin) {
    const result = await db.insert(users).values({ openId, name: "Administrator", email: null, loginMethod: "local", role: "admin", lastSignedIn: new Date() });
    admin = (await db.select().from(users).where(eq(users.id, Number(result[0].insertId))).limit(1))[0];
  } else {
    await db.update(users).set({ name: "Administrator", loginMethod: "local", role: "admin" }).where(eq(users.id, admin.id));
  }
  if (!admin) throw new Error("Unable to create local administrator");
  await db.insert(localCredentials).values({ userId: admin.id, username: "admin", passwordHash }).onDuplicateKeyUpdate({ set: { passwordHash } });
  return admin;
}

export async function getLocalLogin(username: string) {
  const db = await requireDb();
  const credential = (await db.select().from(localCredentials).where(eq(localCredentials.username, username)).limit(1))[0];
  if (!credential) return undefined;
  const user = (await db.select().from(users).where(eq(users.id, credential.userId)).limit(1))[0];
  return user ? { user, passwordHash: credential.passwordHash } : undefined;
}

export async function getLocalLoginByUserId(userId: number) {
  const db = await requireDb();
  const credential = (await db.select().from(localCredentials).where(eq(localCredentials.userId, userId)).limit(1))[0];
  if (!credential) return undefined;
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  return user ? { user, passwordHash: credential.passwordHash } : undefined;
}

export async function updateLocalPassword(userId: number, passwordHash: string) {
  const db = await requireDb();
  await db.update(localCredentials).set({ passwordHash }).where(eq(localCredentials.userId, userId));
}

export async function updateUserAvatar(userId: number, avatarUrl: string) {
  const db = await requireDb();
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function createLocalUser(username: string, passwordHash: string) {
  const db = await requireDb();
  const existing = (await db.select({ id: localCredentials.id }).from(localCredentials).where(eq(localCredentials.username, username)).limit(1))[0];
  if (existing) throw new Error("Tên tài khoản đã được sử dụng");
  const result = await db.insert(users).values({
    openId: `local:${username}`,
    name: username,
    email: null,
    loginMethod: "local",
    role: "user",
    lastSignedIn: new Date(),
  });
  const user = (await db.select().from(users).where(eq(users.id, Number(result[0].insertId))).limit(1))[0];
  if (!user) throw new Error("Không thể tạo tài khoản");
  await db.insert(localCredentials).values({ userId: user.id, username, passwordHash });
  return user;
}

export async function searchUsers(query: string, currentUserId: number) {
  const db = await requireDb();
  const normalized = query.trim();
  if (!normalized) return [];
  const numericId = /^\d+$/.test(normalized) ? Number(normalized) : null;
  const condition = numericId ? or(eq(users.id, numericId), like(users.name, `%${normalized}%`)) : like(users.name, `%${normalized}%`);
  return db.select({ id: users.id, name: users.name, role: users.role, avatarUrl: users.avatarUrl }).from(users).where(and(ne(users.id, currentUserId), condition)).limit(20);
}

export async function addFriend(currentUserId: number, otherUserId: number) {
  if (currentUserId === otherUserId) throw new Error("Không thể tự kết bạn");
  const db = await requireDb();
  const [userOneId, userTwoId] = [currentUserId, otherUserId].sort((a, b) => a - b);
  const pairKey = `${userOneId}:${userTwoId}`;
  const other = (await db.select({ id: users.id }).from(users).where(eq(users.id, otherUserId)).limit(1))[0];
  if (!other) throw new Error("Không tìm thấy người dùng");
  const existing = (await db.select().from(friendships).where(eq(friendships.pairKey, pairKey)).limit(1))[0];
  if (existing?.status === "accepted") return { pairKey, userId: otherUserId, status: "accepted" as const };
  if (existing?.status === "pending") return { pairKey, userId: otherUserId, status: "pending" as const };
  await db.insert(friendships).values({ pairKey, userOneId, userTwoId, requestedBy: currentUserId, status: "pending" }).onDuplicateKeyUpdate({ set: { requestedBy: currentUserId, status: "pending" } });
  return { pairKey, userId: otherUserId, status: "pending" as const };
}

export async function getFriends(currentUserId: number) {
  const db = await requireDb();
  const pairs = await db.select().from(friendships).where(and(or(eq(friendships.userOneId, currentUserId), eq(friendships.userTwoId, currentUserId)), eq(friendships.status, "accepted")));
  const friendIds = pairs.map((pair) => pair.userOneId === currentUserId ? pair.userTwoId : pair.userOneId);
  if (!friendIds.length) return [];
  return db.select({ id: users.id, name: users.name, role: users.role, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, friendIds));
}

export async function getIncomingFriendRequests(currentUserId: number) {
  const db = await requireDb();
  const requests = await db.select().from(friendships).where(and(or(eq(friendships.userOneId, currentUserId), eq(friendships.userTwoId, currentUserId)), eq(friendships.status, "pending")));
  const incoming = requests.filter((request) => request.requestedBy !== currentUserId);
  if (!incoming.length) return [];
  const requesterIds = incoming.map((request) => request.requestedBy);
  const people = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, requesterIds));
  return incoming.map((request) => ({ ...request, requester: people.find((person) => person.id === request.requestedBy) ?? null }));
}

export async function getOutgoingFriendRequests(currentUserId: number) {
  const db = await requireDb();
  const requests = await db.select().from(friendships).where(and(eq(friendships.requestedBy, currentUserId), eq(friendships.status, "pending")));
  if (!requests.length) return [];
  const recipientIds = requests.map((request) => request.userOneId === currentUserId ? request.userTwoId : request.userOneId);
  const people = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, recipientIds));
  return requests.map((request) => ({ ...request, recipient: people.find((person) => person.id === (request.userOneId === currentUserId ? request.userTwoId : request.userOneId)) ?? null }));
}

export async function respondToFriendRequest(currentUserId: number, requestId: number, accept: boolean) {
  const db = await requireDb();
  const request = (await db.select().from(friendships).where(eq(friendships.id, requestId)).limit(1))[0];
  if (!request || request.status !== "pending" || request.requestedBy === currentUserId || (request.userOneId !== currentUserId && request.userTwoId !== currentUserId)) throw new Error("Lời mời không hợp lệ");
  await db.update(friendships).set({ status: accept ? "accepted" : "rejected" }).where(eq(friendships.id, requestId));
  return { ...request, status: accept ? "accepted" as const : "rejected" as const };
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

export async function getRoomMembership(roomId: number, userId: number) {
  const db = await requireDb();
  const found = await db.select().from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))).limit(1);
  return found[0];
}

export async function getRoomForMember(roomId: number, userId: number) {
  const member = await getRoomMembership(roomId, userId);
  if (!member) return undefined;
  const db = await requireDb();
  const result = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
  const room = result[0];
  if (!room) return undefined;
  if (room.kind !== "direct") return { ...room, membershipRole: member.role };
  const peers = await db.select({ userId: roomMembers.userId }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), ne(roomMembers.userId, userId))).limit(1);
  const peer = peers[0] ? await db.select({ name: users.name }).from(users).where(eq(users.id, peers[0].userId)).limit(1) : [];
  return { ...room, name: peer[0]?.name || room.name, membershipRole: member.role };
}

export async function getUserRooms(userId: number) {
  const db = await requireDb();
  const memberships = await db.select().from(roomMembers).where(eq(roomMembers.userId, userId));
  if (!memberships.length) return [];
  const roomIds = memberships.map((entry) => entry.roomId);
  const rooms = await db.select().from(chatRooms).where(inArray(chatRooms.id, roomIds)).orderBy(desc(chatRooms.lastMessageAt));
  const directIds = rooms.filter((room) => room.kind === "direct").map((room) => room.id);
  const directMembers = directIds.length ? await db.select({ roomId: roomMembers.roomId, userId: roomMembers.userId }).from(roomMembers).where(inArray(roomMembers.roomId, directIds)) : [];
  const peerIds = [...new Set(directMembers.filter((member) => member.userId !== userId).map((member) => member.userId))];
  const people = peerIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, peerIds)) : [];
  return rooms.map((room) => {
    const peerId = room.kind === "direct" ? directMembers.find((member) => member.roomId === room.id && member.userId !== userId)?.userId : undefined;
    const name = peerId ? people.find((person) => person.id === peerId)?.name || room.name : room.name;
    return { ...room, name, membershipRole: memberships.find((item) => item.roomId === room.id)?.role ?? "member" };
  });
}

export async function createRoom(input: { ownerId: number; name: string; description?: string; kind: "direct" | "group"; memberIds: number[]; directKey?: string }) {
  const db = await requireDb();
  const result = await db.insert(chatRooms).values({
    ownerId: input.ownerId,
    name: input.name,
    description: input.description ?? null,
    kind: input.kind,
    directKey: input.directKey ?? null,
  });
  const roomId = Number(result[0].insertId);
  const memberIds = [...new Set([input.ownerId, ...input.memberIds])];
  await db.insert(roomMembers).values(memberIds.map((userId) => ({ roomId, userId, role: userId === input.ownerId ? "admin" as const : "member" as const })));
  const created = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
  return created[0];
}

export async function getOrCreateDirectRoom(userId: number, peerUserId: number) {
  const db = await requireDb();
  const directKey = [userId, peerUserId].sort((a, b) => a - b).join(":");
  const existing = await db.select().from(chatRooms).where(eq(chatRooms.directKey, directKey)).limit(1);
  if (existing[0]) return existing[0];
  const peer = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, peerUserId)).limit(1);
  if (!peer[0]) throw new Error("Không tìm thấy thành viên này");
  return createRoom({ ownerId: userId, name: peer[0].name || `Thành viên ${peerUserId}`, kind: "direct", memberIds: [peerUserId], directKey });
}

export async function getRoomMembers(roomId: number) {
  const db = await requireDb();
  const members = await db.select().from(roomMembers).where(eq(roomMembers.roomId, roomId));
  if (!members.length) return [];
  const people = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, members.map((member) => member.userId)));
  return members.map((member) => ({ ...member, user: people.find((person) => person.id === member.userId) ?? null }));
}

export async function addRoomMember(roomId: number, userId: number) {
  const db = await requireDb();
  await db.insert(roomMembers).values({ roomId, userId, role: "member" }).onDuplicateKeyUpdate({ set: { role: "member" } });
  return getRoomMembership(roomId, userId);
}

export async function updateRoomMemberRole(roomId: number, userId: number, role: "member" | "admin") {
  const db = await requireDb();
  await db.update(roomMembers).set({ role }).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  return getRoomMembership(roomId, userId);
}

export async function removeRoomMember(roomId: number, userId: number) {
  const db = await requireDb();
  await db.delete(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
}

export async function getRoomMessages(roomId: number, limit = 50) {
  const db = await requireDb();
  const roomMessages = await db.select().from(messages).where(eq(messages.roomId, roomId)).orderBy(desc(messages.createdAt)).limit(limit);
  if (!roomMessages.length) return [];
  const messageIds = roomMessages.map((message) => message.id);
  const deliveries = await db.select({ messageId: messageDeliveries.messageId, count: sql<number>`count(*)` }).from(messageDeliveries).where(inArray(messageDeliveries.messageId, messageIds)).groupBy(messageDeliveries.messageId);
  const reads = await db.select({ messageId: messageReads.messageId, count: sql<number>`count(*)` }).from(messageReads).where(inArray(messageReads.messageId, messageIds)).groupBy(messageReads.messageId);
  return roomMessages.map((message) => ({ ...message, receipt: { deliveredCount: Number(deliveries.find((item) => item.messageId === message.id)?.count ?? 0), readCount: Number(reads.find((item) => item.messageId === message.id)?.count ?? 0) } }));
}

export async function createMessage(input: { roomId: number; senderId: number; clientMessageId?: string; body: string; kind: "text" | "image" | "video" | "file" | "sticker" | "system"; attachmentUrl?: string; attachmentName?: string; attachmentMimeType?: string; attachmentSize?: number }) {
  const db = await requireDb();
  const values = {
    ...input,
    clientMessageId: input.clientMessageId ?? null,
    attachmentUrl: input.attachmentUrl ?? null,
    attachmentName: input.attachmentName ?? null,
    attachmentMimeType: input.attachmentMimeType ?? null,
    attachmentSize: input.attachmentSize ?? null,
  };
  if (input.clientMessageId) {
    await db.insert(messages).values(values).onDuplicateKeyUpdate({ set: { clientMessageId: input.clientMessageId } });
    const existing = await db.select().from(messages).where(and(eq(messages.roomId, input.roomId), eq(messages.senderId, input.senderId), eq(messages.clientMessageId, input.clientMessageId))).limit(1);
    if (existing[0]) {
      await db.update(chatRooms).set({ lastMessageAt: new Date() }).where(eq(chatRooms.id, input.roomId));
      return existing[0];
    }
  }
  const result = await db.insert(messages).values(values);
  const messageId = Number(result[0].insertId);
  await db.update(chatRooms).set({ lastMessageAt: new Date() }).where(eq(chatRooms.id, input.roomId));
  const created = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  return created[0];
}

export async function markMessagesDelivered(messageIds: number[], userId: number) {
  if (!messageIds.length) return;
  const db = await requireDb();
  await db.insert(messageDeliveries).values(messageIds.map((messageId) => ({ messageId, userId }))).onDuplicateKeyUpdate({ set: { deliveredAt: new Date() } });
}

export async function markMessagesRead(messageIds: number[], userId: number) {
  if (!messageIds.length) return;
  const db = await requireDb();
  await db.insert(messageReads).values(messageIds.map((messageId) => ({ messageId, userId }))).onDuplicateKeyUpdate({ set: { readAt: new Date() } });
}

export async function createCallSession(roomId: number, createdBy: number, mode: "voice" | "video" | "share" = "video") {
  const db = await requireDb();
  const existing = await db.select().from(callSessions).where(and(eq(callSessions.roomId, roomId), eq(callSessions.mode, mode), inArray(callSessions.status, ["ringing", "active"]))).orderBy(desc(callSessions.startedAt)).limit(1);
  if (existing[0]) return existing[0];
  const p2pRoom = `cp-room-${roomId}-call-${crypto.randomUUID().slice(0, 8)}`;
  const result = await db.insert(callSessions).values({ roomId, createdBy, p2pRoom, mode, status: "ringing" });
  const sessionId = Number(result[0].insertId);
  const created = await db.select().from(callSessions).where(eq(callSessions.id, sessionId)).limit(1);
  return created[0];
}

export async function getCallSessionForMember(sessionId: number, userId: number) {
  const db = await requireDb();
  const session = await db.select().from(callSessions).where(eq(callSessions.id, sessionId)).limit(1);
  if (!session[0]) return undefined;
  const member = await getRoomMembership(session[0].roomId, userId);
  return member ? session[0] : undefined;
}

export async function joinCallSession(sessionId: number, userId: number) {
  const db = await requireDb();
  await db.insert(callParticipants).values({ callSessionId: sessionId, userId, leftAt: null }).onDuplicateKeyUpdate({ set: { leftAt: null, joinedAt: new Date() } });
  await db.update(callSessions).set({ status: "active" }).where(eq(callSessions.id, sessionId));
}

export async function leaveCallSession(sessionId: number, userId: number) {
  const db = await requireDb();
  await db.update(callParticipants).set({ leftAt: new Date() }).where(and(eq(callParticipants.callSessionId, sessionId), eq(callParticipants.userId, userId)));
  const [remaining] = await db.select({ count: sql<number>`count(*)` }).from(callParticipants).where(and(eq(callParticipants.callSessionId, sessionId), sql`${callParticipants.leftAt} is null`));
  if (Number(remaining.count) === 0) await db.update(callSessions).set({ status: "ended", endedAt: new Date() }).where(eq(callSessions.id, sessionId));
}

export async function endCallSession(sessionId: number) {
  const db = await requireDb();
  await db.update(callSessions).set({ status: "ended", endedAt: new Date() }).where(eq(callSessions.id, sessionId));
  await db.update(callParticipants).set({ leftAt: new Date() }).where(and(eq(callParticipants.callSessionId, sessionId), sql`${callParticipants.leftAt} is null`));
}

export async function getCallParticipants(sessionId: number) {
  const db = await requireDb();
  const participants = await db.select().from(callParticipants).where(eq(callParticipants.callSessionId, sessionId));
  if (!participants.length) return [];
  const people = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, participants.map((participant) => participant.userId)));
  return participants.map((participant) => ({ ...participant, user: people.find((person) => person.id === participant.userId) ?? null }));
}

export async function getJoinableCallSessions(userId: number) {
  const rooms = await getUserRooms(userId);
  if (!rooms.length) return [];
  const db = await requireDb();
  return db.select().from(callSessions).where(and(inArray(callSessions.roomId, rooms.map((room) => room.id)), inArray(callSessions.status, ["ringing", "active"])));
}

export async function getAdminMetrics() {
  const db = await requireDb();
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(isNull(users.deletedAt));
  const [roomCount] = await db.select({ count: sql<number>`count(*)` }).from(chatRooms);
  const [callCount] = await db.select({ count: sql<number>`count(*)` }).from(callSessions);
  const [fileBytes] = await db.select({ total: sql<number>`coalesce(sum(${messages.attachmentSize}), 0)` }).from(messages);
  return { users: Number(userCount.count), rooms: Number(roomCount.count), calls: Number(callCount.count), fileBytes: Number(fileBytes.total) };
}

export async function getAdminUsers() {
  const db = await requireDb();
  return db.select({ id: users.id, name: users.name, role: users.role, avatarUrl: users.avatarUrl, lastSignedIn: users.lastSignedIn, suspendedUntil: users.suspendedUntil }).from(users).where(isNull(users.deletedAt)).orderBy(desc(users.lastSignedIn));
}

export async function getAdminUserById(userId: number) {
  const db = await requireDb();
  return (await db.select({ id: users.id, name: users.name, role: users.role, suspendedUntil: users.suspendedUntil, deletedAt: users.deletedAt }).from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function suspendAdminUser(userId: number, durationDays: number) {
  const db = await requireDb();
  const suspendedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  await db.update(users).set({ suspendedUntil }).where(eq(users.id, userId));
  return (await db.select({ id: users.id, suspendedUntil: users.suspendedUntil }).from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function restoreAdminUser(userId: number) {
  const db = await requireDb();
  await db.update(users).set({ suspendedUntil: null }).where(eq(users.id, userId));
  return { ok: true } as const;
}

export async function deleteAdminUser(userId: number) {
  const db = await requireDb();
  const deletedAt = new Date();
  await db.update(users).set({
    openId: `deleted:${userId}:${deletedAt.getTime()}`,
    name: "Tài khoản đã xóa",
    avatarUrl: null,
    role: "user",
    suspendedUntil: null,
    deletedAt,
  }).where(eq(users.id, userId));
  await db.delete(localCredentials).where(eq(localCredentials.userId, userId));
  return { ok: true } as const;
}

export async function setAdminUserRole(userId: number, role: "user" | "admin") {
  const db = await requireDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return (await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function getActiveCallsForAdmin() {
  const db = await requireDb();
  return db.select().from(callSessions).where(inArray(callSessions.status, ["ringing", "active"])).orderBy(desc(callSessions.startedAt));
}
