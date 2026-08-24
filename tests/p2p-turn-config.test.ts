import { describe, expect, it } from "vitest";

describe("P2P TURN environment configuration", () => {
  it("loads both TURN endpoints and credentials from environment", () => {
    const endpoints = [
      [process.env.TURN_URL, process.env.TURN_USERNAME, process.env.TURN_CREDENTIAL],
      [process.env.TURN_FALLBACK_URL, process.env.TURN_FALLBACK_USERNAME, process.env.TURN_FALLBACK_CREDENTIAL],
    ];
    for (const [url, username, credential] of endpoints) {
      expect(url).toMatch(/^turn:/);
      expect(username).toBeTruthy();
      expect(credential).toBeTruthy();
    }
  });
});
