import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
describe("native P2P call device repairs", () => {
  it("delivers global call invite and retains decline lifecycle", () => {
    expect(read("components/incoming-call-overlay.tsx")).toContain('socket.on("call:invite"');
    expect(read("server/routers.ts")).toContain('emitUserEvent(member.userId, "call:invite", invite)');
    expect(read("components/incoming-call-overlay.tsx")).toContain("callerName");
  });
  it("uses speaker routing and local RTC preview", () => {
    const overlay = read("components/call-overlay.native.tsx");
    const call = read("app/call/[sessionId].native.tsx");
    expect(overlay).toContain("InCallManager.setForceSpeakerphoneOn");
    expect(overlay).toContain("_switchCamera");
    expect(call).toContain("streamURL={localUrl}");
    expect(call).toContain("key={`local-preview-${localUrl}`}");
    expect(call).toContain("zOrder={1}");
    expect(call).toContain("zOrder={0}");
  });
  it("guards self-share preview and keeps composer keyboard handling", () => {
    expect(read("app/call/[sessionId].native.tsx")).toContain("localUrl && !isLocalSharing");
    expect(read("app/chat/[roomId].tsx")).toContain('enabled={Platform.OS === "ios"}');
  });
});
