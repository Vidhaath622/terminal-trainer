import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["var(--font-display)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
        },
      },
    },
  },
  plugins: [],
};
export default config;
