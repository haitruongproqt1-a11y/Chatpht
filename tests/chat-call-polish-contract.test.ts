import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
describe("chat and P2P call polish", () => {
  it("keeps direct room names and durable upload priority", () => {
    expect(read("server/db.ts")).toContain('room.kind !== "direct"');
    expect(read("lib/persistent-upload-queue.ts")).toContain("this.active.size < 3");
  });
  it("keeps five-minute capture and draggable P2P preview", () => {
    expect(read("components/attachment-sheet.tsx")).toContain("videoMaxDuration: 300");
    const call = read("app/call/[sessionId].native.tsx");
    expect(call).toContain("RTCView");
    expect(call).toContain("PanResponder");
    expect(call).toContain("switchCamera");
  });
});
