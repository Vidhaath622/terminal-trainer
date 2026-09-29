/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-capable build: /api/* routes run as Vercel functions (GitHub OAuth
  // + progress sync), while pages remain statically generated where possible.
  // Re-add `output: "export"` only if you ever return to pure static hosting.
  images: { unoptimized: true },
  trailingSlash: true,
};

module.exports = nextConfig;
