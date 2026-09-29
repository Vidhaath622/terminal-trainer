import { describe, expect, it, beforeEach } from "vitest";
import {
  encodeSession,
  decodeSession,
  readCookie,
  type SessionPayload,
} from "./session";

const base: Omit<SessionPayload, "iat"> = {
  githubId: 12345,
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231",
  accessToken: "gho_testtoken",
};

describe("session cookies", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("round-trips a payload", () => {
    const cookie = encodeSession(base);
    const decoded = decodeSession(cookie);
    expect(decoded).not.toBeNull();
    expect(decoded!.githubId).toBe(12345);
    expect(decoded!.login).toBe("octocat");
    expect(decoded!.accessToken).toBe("gho_testtoken");
    expect(typeof decoded!.iat).toBe("number");
  });

  it("rejects a tampered body", () => {
    const cookie = encodeSession(base);
    const [body, mac] = cookie.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...base, login: "attacker" })
    ).toString("base64url");
    expect(decodeSession(`${forged}.${mac}`)).toBeNull();
    void body;
  });

  it("rejects a tampered signature", () => {
    const cookie = encodeSession(base);
    const body = cookie.slice(0, cookie.lastIndexOf("."));
    expect(decodeSession(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects garbage and empty values", () => {
    expect(decodeSession(null)).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession("not-a-cookie")).toBeNull();
    expect(decodeSession("a.b")).toBeNull();
  });

  it("rejects payloads missing required fields", () => {
    process.env.SESSION_SECRET = "test-secret";
    const { createHmac } = require("crypto") as typeof import("crypto");
    const body = Buffer.from(JSON.stringify({ login: "x" })).toString("base64url");
    const mac = createHmac("sha256", "test-secret").update(body).digest("base64url");
    expect(decodeSession(`${body}.${mac}`)).toBeNull();
  });

  it("readCookie parses Cookie headers", () => {
    const header = "a=1; tt_session=xyz; b=2=3";
    expect(readCookie(header, "tt_session")).toBe("xyz");
    expect(readCookie(header, "b")).toBe("2=3");
    expect(readCookie(header, "missing")).toBeNull();
    expect(readCookie(null, "a")).toBeNull();
  });
});
