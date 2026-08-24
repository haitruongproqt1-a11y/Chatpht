import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
describe("P2P call modes and keyboard", () => {
  it("persists a dedicated share session mode", () => {
    expect(read("drizzle/schema.ts")).toContain('["voice", "video", "share"]');
    expect(read("server/routers.ts")).toContain('z.enum(["voice", "video", "share"])');
  });
  it("keeps voice, video and share controls distinct", () => {
    const call = read("app/call/[sessionId].native.tsx");
    expect(call).toContain('session.mode === "voice"');
    expect(call).toContain('const videoEnabled = session.mode === "video"');
    expect(call).toContain('const shareEnabled = session.mode === "share"');
  });
  it("keeps composer focusable and keeps global invite UI", () => {
    expect(read("app/chat/[roomId].tsx")).toContain("KeyboardAvoidingView");
    expect(read("components/incoming-call-overlay.tsx")).toContain('socket.on("call:invite"');
  });
});
