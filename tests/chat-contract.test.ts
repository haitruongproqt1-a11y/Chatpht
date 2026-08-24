import { beforeEach, describe, expect, it, vi } from "vitest";
const dbMocks = vi.hoisted(() => ({
  getRoomMembership: vi.fn(),
  getRoomForMember: vi.fn(),
  getRoomMembers: vi.fn(),
  createMessage: vi.fn(),
  createCallSession: vi.fn(),
}));
const realtimeMocks = vi.hoisted(() => ({ emitRoomEvent: vi.fn(), emitUserEvent: vi.fn() }));

vi.mock("../server/db", () => dbMocks);
vi.mock("../server/realtime", () => realtimeMocks);

import { appRouter } from "../server/routers";
import { classifyAttachment } from "../shared/chat-utils";

describe("chatpht communication contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates and broadcasts a text message only for a room member", async () => {
    dbMocks.getRoomMembership.mockResolvedValue({ roomId: 7, userId: 12, role: "member" });
    dbMocks.getRoomMembers.mockResolvedValue([{ userId: 12 }, { userId: 13 }]);
    dbMocks.createMessage.mockResolvedValue({ id: 99, roomId: 7, senderId: 12, body: "Xin chào", kind: "text" });
    const caller = appRouter.createCaller({ user: { id: 12, name: "Lan", role: "user" }, req: {}, res: {} } as any);

    await expect(caller.chat.sendMessage({ roomId: 7, body: "Xin chào", clientMessageId: "msg-test-0001" })).resolves.toMatchObject({ id: 99, kind: "text" });
    expect(dbMocks.createMessage).toHaveBeenCalledWith({ roomId: 7, senderId: 12, clientMessageId: "msg-test-0001", body: "Xin chào", kind: "text" });
    expect(realtimeMocks.emitRoomEvent).toHaveBeenCalledWith(7, "message:new", expect.objectContaining({ id: 99 }));
    expect(realtimeMocks.emitUserEvent).toHaveBeenCalledWith(13, "message:notify", expect.objectContaining({ id: 99, senderName: "Lan" }));
  });

  it("classifies image, video and generic-file attachments correctly", () => {
    expect(classifyAttachment("image/jpeg")).toBe("image");
    expect(classifyAttachment("video/mp4")).toBe("video");
    expect(classifyAttachment("application/pdf")).toBe("file");
  });

  it("creates and broadcasts a sticker only for a room member", async () => {
    dbMocks.getRoomMembership.mockResolvedValue({ roomId: 7, userId: 12, role: "member" });
    dbMocks.getRoomMembers.mockResolvedValue([{ userId: 12 }, { userId: 13 }]);
    dbMocks.createMessage.mockResolvedValue({ id: 101, roomId: 7, senderId: 12, body: "🎉", kind: "sticker" });
    const caller = appRouter.createCaller({ user: { id: 12, name: "Lan", role: "user" }, req: {}, res: {} } as any);

    await expect(caller.chat.sendSticker({ roomId: 7, sticker: "🎉", clientMessageId: "sticker-test-001" })).resolves.toMatchObject({ id: 101, kind: "sticker" });
    expect(dbMocks.createMessage).toHaveBeenCalledWith({ roomId: 7, senderId: 12, clientMessageId: "sticker-test-001", body: "🎉", kind: "sticker" });
  });

  it("creates a voice call session from a room member", async () => {
    dbMocks.getRoomMembership.mockResolvedValue({ roomId: 7, userId: 12, role: "member" });
    dbMocks.getRoomForMember.mockResolvedValue({ id: 7, kind: "direct" });
    dbMocks.getRoomMembers.mockResolvedValue([{ userId: 12 }, { userId: 13 }]);
    dbMocks.createCallSession.mockResolvedValue({ id: 41, roomId: 7, mode: "voice", status: "ringing" });
    const caller = appRouter.createCaller({ user: { id: 12, name: "Lan", avatarUrl: "https://example.com/lan.jpg", role: "user" }, req: {}, res: {} } as any);

    await expect(caller.calls.create({ roomId: 7, mode: "voice" })).resolves.toMatchObject({ id: 41, mode: "voice" });
    expect(dbMocks.createCallSession).toHaveBeenCalledWith(7, 12, "voice");
    expect(realtimeMocks.emitUserEvent).toHaveBeenCalledWith(13, "call:invite", expect.objectContaining({ id: 41, callerName: "Lan", callerAvatar: "https://example.com/lan.jpg" }));
  });

  it("reports P2P Firestore transport without issuing a media-provider token", async () => {
    expect(await callerFor(12).calls.provider()).toMatchObject({ transport: "p2p-firestore" });
  });

  it("rejects a group-room call in the P2P 1:1 build", async () => {
    dbMocks.getRoomForMember.mockResolvedValue({ id: 8, kind: "group" });
    await expect(callerFor(12).calls.create({ roomId: 8, mode: "video" })).rejects.toThrow("P2P chỉ hỗ trợ cuộc trò chuyện 1:1");
  });
});

function callerFor(userId: number) { return appRouter.createCaller({ user: { id: userId, name: "Lan", role: "user" }, req: {}, res: {} } as any); }
