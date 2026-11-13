import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E0A0A",
        burgundy: "#3A0B12",
        crimson: { DEFAULT: "#B3202A", deep: "#8F1620" },
        gold: { DEFAULT: "#D4A94F", soft: "#E8CB85" },
        cream: "#F3E9D2",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
