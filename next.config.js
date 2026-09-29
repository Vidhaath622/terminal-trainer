/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: `npm run build` emits a self-contained out/ folder that
  // runs on any static host (college webspace, Netlify, S3, GitHub Pages).
  // Remove "output" if you ever need server routes or dynamic SSR.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

module.exports = nextConfig;
