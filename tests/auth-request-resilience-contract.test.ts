import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("authentication request resilience", () => {
  it("uses a bounded MySQL pool instead of a one-off URL connection", () => {
    const database = read("server/db.ts");
    expect(database).toContain("createPool");
    expect(database).toContain("createPool(process.env.DATABASE_URL)");
    expect(database).toContain("withDatabaseTimeout");
  });

  it("returns control to the native form when an auth request does not answer", () => {
    const login = read("app/login.tsx");
    expect(login).toContain("Promise.race");
    expect(login).toContain("15_000");
    expect(login).toContain("setSubmitting(false)");
  });
});
