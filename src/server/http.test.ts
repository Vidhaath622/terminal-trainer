import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertSameOrigin, readJsonBody, MAX_JSON_BODY_BYTES } from "./http";

function req(method: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://app.example/api/test", { method, headers });
}

describe("assertSameOrigin", () => {
  it("passes same-origin browser requests", () => {
    expect(
      assertSameOrigin(req("PUT", { origin: "https://app.example", host: "app.example" }))
    ).toBeNull();
  });

  it("passes GET requests regardless of origin", () => {
    expect(
      assertSameOrigin(req("GET", { origin: "https://evil.example", host: "app.example" }))
    ).toBeNull();
  });

  it("rejects a foreign origin", () => {
    const res = assertSameOrigin(req("DELETE", { origin: "https://evil.example", host: "app.example" }));
    expect(res?.status).toBe(403);
  });

  it("rejects a null origin (sandboxed frame)", () => {
    const res = assertSameOrigin(req("POST", { origin: "null", host: "app.example" }));
    expect(res?.status).toBe(403);
  });

  it("rejects an unparseable origin", () => {
    const res = assertSameOrigin(req("POST", { origin: "not a url", host: "app.example" }));
    expect(res?.status).toBe(403);
  });

  it("uses Sec-Fetch-Site when Origin is absent", () => {
    expect(assertSameOrigin(req("POST", { "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(assertSameOrigin(req("POST", { "sec-fetch-site": "none" }))).toBeNull();
    expect(assertSameOrigin(req("POST", { "sec-fetch-site": "cross-site" }))?.status).toBe(403);
    expect(assertSameOrigin(req("POST", { "sec-fetch-site": "same-site" }))?.status).toBe(403);
  });

  it("passes non-browser clients that send neither header", () => {
    expect(assertSameOrigin(req("PUT"))).toBeNull();
  });
});

describe("readJsonBody", () => {
  function bodyReq(body: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest("https://app.example/api/test", { method: "PUT", body, headers });
  }

  it("parses a small JSON body", async () => {
    const result = await readJsonBody(bodyReq(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects on declared content-length over the cap without reading", async () => {
    const result = await readJsonBody(
      bodyReq("{}", { "content-length": String(MAX_JSON_BODY_BYTES + 1) })
    );
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("rejects an oversized body even when content-length lies or is absent", async () => {
    const big = JSON.stringify({ blob: "x".repeat(MAX_JSON_BODY_BYTES + 10) });
    const result = await readJsonBody(bodyReq(big));
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("reports invalid JSON as invalid, not too-large", async () => {
    const result = await readJsonBody(bodyReq("{not json"));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });
});
