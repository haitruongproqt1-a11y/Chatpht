import { describe, expect, it } from "vitest";
import { supportsNativeNotifications } from "../lib/notification-platform";

describe("native notification platform guard", () => {
  it("uses local notification APIs only on supported native platforms", () => {
    expect(supportsNativeNotifications("android")).toBe(true);
    expect(supportsNativeNotifications("ios")).toBe(true);
    expect(supportsNativeNotifications("web")).toBe(false);
  });
});
