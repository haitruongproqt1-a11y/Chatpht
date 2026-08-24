import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("chat resilience contracts", () => {
  it("persists upload metadata and resumes pending work", () => {
    const source = read("lib/persistent-upload-queue.ts");
    expect(source).toContain("AsyncStorage");
    expect(source).toContain("chatpht:persistent-upload-queue:v1");
    expect(source).toContain("AppState.addEventListener");
    expect(source).toContain("status === \"uploading\"");
    expect(source).toContain("FileSystem.copyAsync");
  });

  it("shows incoming calls and persists call history in the conversation", () => {
    const chat = read("app/chat/[roomId].tsx");
    const router = read("server/routers.ts");
    expect(chat).toContain('socket.on("call:created"');
    expect(chat).toContain("Cuộc gọi");
    expect(chat).toContain("parseCallEvent");
    expect(router).toContain("CALL_EVENT:${session.id}:${session.mode}:ringing");
    expect(router).toContain("CALL_EVENT:${session.id}:${session.mode}:ended");
  });

  it("keeps avatar confirmation in app and blocks calls/admin tabs for ordinary users", () => {
    const settings = read("app/(tabs)/settings.tsx");
    const tabs = read("app/(tabs)/_layout.tsx");
    const admin = read("app/(tabs)/admin.tsx");
    expect(settings).toContain("allowsEditing: false");
    expect(settings).toContain("Xác nhận dùng ảnh này");
    expect(tabs).toContain('name="calls" options={{ href: null }}');
    expect(tabs).toContain('user?.role === "admin"');
    expect(admin).toContain('currentUser?.role !== "admin"');
  });
});
