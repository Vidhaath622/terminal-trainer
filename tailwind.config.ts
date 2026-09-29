import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        term: {
          bg: "#0a0e14",
          panel: "#10161f",
          raise: "#151d29",
          border: "#1e2733",
          text: "#dbe4ee",
          muted: "#8b98a9",
          green: "#3fb950",
          blue: "#58a6ff",
          red: "#f85149",
          yellow: "#d29922",
          violet: "#a371f7",
        },
      },
      boxShadow: {
        glow: "0 0 32px -8px rgba(63,185,80,0.35)",
        "glow-blue": "0 0 32px -8px rgba(88,166,255,0.35)",
        "glow-strong": "0 0 50px -10px rgba(63,185,80,0.5), 0 0 24px -8px rgba(88,166,255,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        "card-hover": "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 20px 44px -16px rgba(0,0,0,0.75), 0 0 40px -12px rgba(88,166,255,0.28)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.25s ease-out both",
        slideUp: "slideUp 0.35s ease-out both",
        float: "float 7s ease-in-out infinite",
        "float-slow": "float 11s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2.4s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
