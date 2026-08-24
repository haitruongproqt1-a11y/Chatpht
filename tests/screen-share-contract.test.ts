import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(resolve(process.cwd(), "components/call-overlay.native.tsx"), "utf8");
const webCall = readFileSync(resolve(process.cwd(), "app/call/[sessionId].tsx"), "utf8");

describe("P2P screen share contract", () => {
  it("captures display media and replaces the P2P video sender", () => {
    expect(overlay).toContain("getDisplayMedia");
    expect(overlay).toContain("replaceTrack(next)");
  });

  it("uses browser display media for web P2P share", () => {
    expect(webCall).toContain("navigator.mediaDevices.getDisplayMedia");
    expect(webCall).toContain("p2p_calls");
  });
});
