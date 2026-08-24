import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";
import { createPasswordHash } from "../server/local-auth";

const databaseMocks = vi.hoisted(() => ({ getLocalLogin: vi.fn() }));

vi.mock("../server/db", () => databaseMocks);

import { appRouter } from "../server/routers";

const adminUser = {
  id: 1,
  openId: "local:admin",
  name: "Administrator",
  email: null,
  loginMethod: "local",
  role: "admin" as const,
  avatarUrl: null,
  deletedAt: null,
  suspendedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
let adminPasswordHash = "";

describe("local admin login", () => {
  beforeAll(async () => { adminPasswordHash = await createPasswordHash(process.env.ADMIN_SEED_PASSWORD!); });
  beforeEach(() => {
    databaseMocks.getLocalLogin.mockImplementation(async (username: string) => username === "admin" ? { user: adminUser, passwordHash: adminPasswordHash } : undefined);
  });
  it("authenticates the seeded admin and issues a local session", async () => {
    const cookies: Array<{ name: string; value: string }> = [];
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: { host: "localhost:3000" } },
      res: { cookie: (name: string, value: string) => cookies.push({ name, value }), clearCookie: () => undefined },
    } as any);
    const result = await caller.auth.loginLocal({ username: "admin", password: process.env.ADMIN_SEED_PASSWORD! });
    expect(result.user.role).toBe("admin");
    expect(decodeJwt(result.token).openId).toBe("local:admin");
    expect(cookies).toHaveLength(1);
  });

  it("rejects an invalid password", async () => {
    const caller = appRouter.createCaller({ user: null, req: { protocol: "https", hostname: "localhost", headers: { host: "localhost:3000" } }, res: { cookie: () => undefined, clearCookie: () => undefined } } as any);
    await expect(caller.auth.loginLocal({ username: "admin", password: "invalid-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
}, 12_000);
