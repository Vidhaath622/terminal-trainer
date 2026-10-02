/** @type {import('next').NextConfig} */

/**
 * Security headers are applied via `headers()`:
 *  - nosniff / Referrer-Policy / Permissions-Policy / HSTS on every route
 *  - a CSP everywhere; `frame-ancestors 'self'` globally (clickjacking
 *    protection, e.g. the destructive /account page) with a later, more
 *    specific rule opening `/embed` to `*` — the embed feature must stay
 *    frameable by any college site, so no X-Frame-Options anywhere.
 * The `/embed` override is verified with `curl -I`; if a Next upgrade ever
 * stopped the later rule winning, move this logic into middleware.ts.
 */
const nextConfig = {
  reactStrictMode: true,
  // Server-capable build: /api/* routes run as Vercel functions (GitHub OAuth
  // + progress sync), while pages remain statically generated where possible.
  // Re-add `output: "export"` only if you ever return to pure static hosting.
  images: { unoptimized: true },
  trailingSlash: true,
  async headers() {
    const production = process.env.NODE_ENV === "production";

    const csp = [
      "default-src 'self'",
      // 'unsafe-eval' only in development: `next dev` ships webpack
      // eval-source-map chunks, and without it the browser refuses every
      // module, React never hydrates, and client UI (e.g. the GitHub
      // sign-in button) never renders. Production bundles never use eval,
      // so the shipped policy stays exactly as strict as before.
      `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://avatars.githubusercontent.com",
      "font-src 'self' data:",
      // ws:/wss: only for dev-server Fast Refresh; never in production.
      `connect-src 'self'${production ? "" : " ws: wss:"}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];

    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (production) {
      common.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }

    return [
      {
        source: "/:path*",
        headers: [
          ...common,
          { key: "Content-Security-Policy", value: [...csp, "frame-ancestors 'self'"].join("; ") },
        ],
      },
      // Later rule wins for the same key: the embeddable widget stays embeddable.
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: [...csp, "frame-ancestors *"].join("; ") },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
