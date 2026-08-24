import { describe, expect, it } from "vitest";

describe("admin seed secret", () => {
  it("accepts an optional admin seed password from the server environment", () => {
    const password = process.env.ADMIN_SEED_PASSWORD;
    if (!password) return;
    expect(password).toMatch(/^\S{8,}$/);
  });
});
