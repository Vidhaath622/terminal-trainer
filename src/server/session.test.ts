import { describe, expect, it, beforeEach } from "vitest";
import { createCipheriv, createHash, randomBytes } from "crypto";
import {
  encodeSession,
  decodeSession,
  readCookie,
  timingSafeStringEqual,
  SESSION_MAX_AGE,
  type SessionPayload,
} from "./session";

const base: Omit<SessionPayload, "iat"> = {
  githubId: 12345,
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231",
  accessToken: "gho_testtoken",
};

/** Craft a valid v2 cookie from an arbitrary payload (bypasses encodeSession). */
function forge(plain: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update("test-secret").digest(),
    iv
  );
  const ct = Buffer.concat([cipher.update(JSON.stringify(plain), "utf8"), cipher.final()]);
  return [
    "v2",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/** Replace one part of a v2 cookie with a corrupted value. */
function withPart(cookie: string, index: number, value: string): string {
  const parts = cookie.split(".");
  parts[index] = value;
  return parts.join(".");
}

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

  it("emits the v2 format with no plaintext claims in the value", () => {
    const cookie = encodeSession(base);
    expect(cookie.startsWith("v2.")).toBe(true);
    expect(cookie.split(".")).toHaveLength(4);
    expect(cookie).not.toContain("gho_testtoken");
    expect(cookie).not.toContain("octocat");
  });

  it("rejects a tampered ciphertext", () => {
    const cookie = encodeSession(base);
    const parts = cookie.split(".");
    const ct = parts[3];
    const flipped = (ct[0] === "A" ? "B" : "A") + ct.slice(1);
    expect(decodeSession(withPart(cookie, 3, flipped))).toBeNull();
  });

  it("rejects a tampered auth tag", () => {
    const cookie = encodeSession(base);
    const parts = cookie.split(".");
    const tag = parts[2];
    const flipped = (tag[0] === "A" ? "B" : "A") + tag.slice(1);
    expect(decodeSession(withPart(cookie, 2, flipped))).toBeNull();
  });

  it("rejects a tampered iv", () => {
    const cookie = encodeSession(base);
    const parts = cookie.split(".");
    const iv = parts[1];
    const flipped = (iv[0] === "A" ? "B" : "A") + iv.slice(1);
    expect(decodeSession(withPart(cookie, 1, flipped))).toBeNull();
  });

  it("rejects the retired v1 HMAC format, however well-formed", () => {
    const body = Buffer.from(JSON.stringify({ ...base, iat: Date.now() / 1000 })).toString(
      "base64url"
    );
    const { createHmac } = require("crypto") as typeof import("crypto");
    const mac = createHmac("sha256", "test-secret").update(body).digest("base64url");
    expect(decodeSession(`${body}.${mac}`)).toBeNull();
  });

  it("rejects garbage and empty values", () => {
    expect(decodeSession(null)).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession("not-a-cookie")).toBeNull();
    expect(decodeSession("v2.a.b.c")).toBeNull();
    expect(decodeSession("v3.a.b.c")).toBeNull();
    expect(decodeSession("v2.a.b")).toBeNull();
  });

  it("rejects payloads missing required fields", () => {
    expect(decodeSession(forge({ login: "x" }))).toBeNull();
    expect(decodeSession(forge({ ...base, accessToken: undefined }))).toBeNull();
    expect(decodeSession(forge({ ...base, iat: "soon" }))).toBeNull();
  });

  it("rejects sessions older than SESSION_MAX_AGE and accepts fresh ones", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(decodeSession(forge({ ...base, iat: now - SESSION_MAX_AGE + 60 }))).not.toBeNull();
    expect(decodeSession(forge({ ...base, iat: now - SESSION_MAX_AGE - 1 }))).toBeNull();
    expect(decodeSession(forge({ ...base, iat: 0 }))).toBeNull();
  });

  it("timingSafeStringEqual compares without leaking length", () => {
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
    expect(timingSafeStringEqual("abc", "abd")).toBe(false);
    expect(timingSafeStringEqual("abc", "abcd")).toBe(false);
    expect(timingSafeStringEqual("", "")).toBe(true);
  });

  it("readCookie parses Cookie headers", () => {
    const header = "a=1; tt_session=xyz; b=2=3";
    expect(readCookie(header, "tt_session")).toBe("xyz");
    expect(readCookie(header, "b")).toBe("2=3");
    expect(readCookie(header, "missing")).toBeNull();
    expect(readCookie(null, "a")).toBeNull();
  });
});
