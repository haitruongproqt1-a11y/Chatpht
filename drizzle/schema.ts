import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  suspendedUntil: timestamp("suspendedUntil"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const localCredentials = mysqlTable("local_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  pairKey: varchar("pairKey", { length: 48 }).notNull().unique(),
  userOneId: int("userOneId").notNull(),
  userTwoId: int("userTwoId").notNull(),
  requestedBy: int("requestedBy").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("friendship_user_one_idx").on(table.userOneId),
  index("friendship_user_two_idx").on(table.userTwoId),
]);

export const chatRooms = mysqlTable("chat_rooms", {
  id: int("id").autoincrement().primaryKey(),
  kind: mysqlEnum("kind", ["direct", "group"]).default("group").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 500 }),
  directKey: varchar("directKey", { length: 128 }).unique(),
  ownerId: int("ownerId").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const roomMembers = mysqlTable("room_members", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["member", "admin"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("room_member_unique").on(table.roomId, table.userId),
  index("room_member_user_idx").on(table.userId),
]);

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  senderId: int("senderId").notNull(),
  clientMessageId: varchar("clientMessageId", { length: 80 }),
  body: text("body").notNull(),
  kind: mysqlEnum("kind", ["text", "image", "video", "file", "sticker", "system"]).default("text").notNull(),
  attachmentUrl: text("attachmentUrl"),
  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentMimeType: varchar("attachmentMimeType", { length: 160 }),
  attachmentSize: int("attachmentSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  editedAt: timestamp("editedAt"),
}, (table) => [
  index("message_room_created_idx").on(table.roomId, table.createdAt),
  uniqueIndex("message_client_id_unique").on(table.roomId, table.senderId, table.clientMessageId),
]);

export const messageReads = mysqlTable("message_reads", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  readAt: timestamp("readAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("message_read_unique").on(table.messageId, table.userId)]);

export const messageDeliveries = mysqlTable("message_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("message_delivery_unique").on(table.messageId, table.userId)]);

export const callSessions = mysqlTable("call_sessions", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  p2pRoom: varchar("p2pRoom", { length: 160 }).notNull().unique(),
  createdBy: int("createdBy").notNull(),
  mode: mysqlEnum("mode", ["voice", "video", "share"]).default("video").notNull(),
  status: mysqlEnum("status", ["ringing", "active", "ended"]).default("ringing").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
}, (table) => [index("call_room_status_idx").on(table.roomId, table.status)]);

export const callParticipants = mysqlTable("call_participants", {
  id: int("id").autoincrement().primaryKey(),
  callSessionId: int("callSessionId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
}, (table) => [
  uniqueIndex("call_participant_unique").on(table.callSessionId, table.userId),
  index("call_participant_user_idx").on(table.userId),
]);

export type ChatRoom = typeof chatRooms.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type CallSession = typeof callSessions.$inferSelect;
