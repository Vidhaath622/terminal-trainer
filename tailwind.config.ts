import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        term: {
          bg: "#0d1117",
          panel: "#161b22",
          border: "#30363d",
          text: "#e6edf3",
          green: "#3fb950",
          red: "#f85149",
          yellow: "#d29922",
          blue: "#58a6ff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
