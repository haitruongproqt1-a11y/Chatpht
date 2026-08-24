import { describe, expect, it } from "vitest";
import { p2pFailure, toP2PFailure } from "../lib/p2p-error";

describe("P2P failure presentation", () => {
  it("maps ICE failures to a specific user-facing diagnostic", () => {
    const result = toP2PFailure(new Error("ICE connection failed"));
    expect(result.code).toBe("P2P_ICE");
    expect(result.message).toContain("ICE");
    expect(result.advice).toContain("Wi‑Fi");
  });

  it("maps media permissions and signaling failures without exposing raw errors", () => {
    expect(toP2PFailure(new Error("Permission denied for camera")).code).toBe("P2P_MEDIA_PERMISSION");
    expect(toP2PFailure(new Error("Firestore signaling unavailable")).code).toBe("P2P_SIGNALING");
  });

  it("provides a stable actionable fallback diagnostic", () => {
    const result = p2pFailure("P2P_SETUP");
    expect(result.code).toBe("P2P_SETUP");
    expect(result.advice).toContain("Thử lại");
  });
});
