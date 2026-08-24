import { describe, expect, it } from "vitest";
import { createPasswordHash, normalizeUsername, verifyPassword } from "../server/local-auth";

describe("local administrator password hashing", () => {
  it("hashes a password without retaining plaintext and verifies only the correct password", async () => {
    const testPassword = "test-passphrase-42";
    const hash = await createPasswordHash(testPassword);
    expect(hash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(hash).not.toContain(testPassword);
    await expect(verifyPassword(testPassword, hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", hash)).resolves.toBe(false);
  });

  it("normalizes account names for consistent registration, login and friend search", () => {
    expect(normalizeUsername("  Minh.Nguyen  ")).toBe("minh.nguyen");
  });
});
