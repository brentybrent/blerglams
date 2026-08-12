import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        spotify: "#1DB954",
        base: "#0b0b0d",
        panel: "#161618",
        panel2: "#1e1e21",
        edge: "#2a2a2e",
        ink: "#f2f2f0",
        muted: "#9a9a9f",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
