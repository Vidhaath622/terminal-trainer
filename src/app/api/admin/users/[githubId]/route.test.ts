/**
 * Owner gate tests for PATCH /api/admin/users/[githubId]: 401 without a
 * session, 403 for signed-in non-owners, 400 for bad payloads, 404 for unknown
 * accounts, 200 for the owner. The DB layer is mocked — this file proves the
 * gate, not the SQL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/db", () => ({
  setUserRole: vi.fn(),
  listUsersWithRoles: vi.fn(async () => []),
}));

import { PATCH } from "./route";
import { setUserRole } from "@/server/db";
import { encodeSession, SESSION_COOKIE } from "@/server/session";

const OWNER_ID = 99;

function cookieFor(githubId: number, login: string): string {
  const value = encodeSession({
    githubId,
    login,
    name: null,
    avatarUrl: null,
    accessToken: "test-token",
  });
  return `${SESSION_COOKIE}=${value}`;
}

function patchReq(opts: {
  cookie?: string;
  githubId?: string;
  body?: unknown;
}): NextRequest {
  return new NextRequest(
    `https://app.example/api/admin/users/${opts.githubId ?? "123"}`,
    {
      method: "PATCH",
      headers: {
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
        origin: "https://app.example",
        host: "app.example",
        "content-type": "application/json",
      },
      body: JSON.stringify(opts.body ?? {}),
    }
  );
}

const ctx = (githubId: string) => ({ params: { githubId } });

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-for-role-assignment-tests");
  vi.stubEnv("OWNER_GITHUB_IDS", String(OWNER_ID));
  vi.stubEnv("ADMIN_GITHUB_IDS", "");
  vi.stubEnv("ADMIN_LOGINS", "");
  vi.stubEnv("TEACHER_GITHUB_IDS", "");
  vi.stubEnv("TEACHER_LOGINS", "");
  vi.mocked(setUserRole).mockReset();
  vi.mocked(setUserRole).mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PATCH /api/admin/users/[githubId]", () => {
  it("401s without a session", async () => {
    const res = await PATCH(patchReq({ githubId: "123", body: { role: "teacher" } }), ctx("123"));
    expect(res.status).toBe(401);
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-owner", async () => {
    const res = await PATCH(
      patchReq({
        cookie: cookieFor(7, "someone"),
        githubId: "123",
        body: { role: "teacher" },
      }),
      ctx("123")
    );
    expect(res.status).toBe(403);
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("400s a role outside student/teacher (admin can never be granted here)", async () => {
    const res = await PATCH(
      patchReq({
        cookie: cookieFor(OWNER_ID, "owner"),
        githubId: "123",
        body: { role: "admin" },
      }),
      ctx("123")
    );
    expect(res.status).toBe(400);
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("400s changing the owner's own row", async () => {
    const res = await PATCH(
      patchReq({
        cookie: cookieFor(OWNER_ID, "owner"),
        githubId: String(OWNER_ID),
        body: { role: "student" },
      }),
      ctx(String(OWNER_ID))
    );
    expect(res.status).toBe(400);
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("400s a non-numeric target id", async () => {
    const res = await PATCH(
      patchReq({
        cookie: cookieFor(OWNER_ID, "owner"),
        githubId: "eve",
        body: { role: "teacher" },
      }),
      ctx("eve")
    );
    expect(res.status).toBe(400);
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("404s when the account does not exist", async () => {
    vi.mocked(setUserRole).mockResolvedValue(false);
    const res = await PATCH(
      patchReq({
        cookie: cookieFor(OWNER_ID, "owner"),
        githubId: "123",
        body: { role: "teacher" },
      }),
      ctx("123")
    );
    expect(res.status).toBe(404);
  });

  it("lets the owner assign student and teacher", async () => {
    const res = await PATCH(
      patchReq({
        cookie: cookieFor(OWNER_ID, "owner"),
        githubId: "123",
        body: { role: "teacher" },
      }),
      ctx("123")
    );
    expect(res.status).toBe(200);
    expect(setUserRole).toHaveBeenCalledWith(123, "teacher");

    const res2 = await PATCH(
      patchReq({
        cookie: cookieFor(OWNER_ID, "owner"),
        githubId: "123",
        body: { role: "student" },
      }),
      ctx("123")
    );
    expect(res2.status).toBe(200);
    expect(setUserRole).toHaveBeenLastCalledWith(123, "student");
  });
});
