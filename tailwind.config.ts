import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        accent: "#C4551E",
        mint: "#6FB897",
        base: "#F2E9DA",
        panel: "#FBF6EC",
        panel2: "#EAE0C9",
        edge: "#C9B48C",
        ink: "#2E2013",
        muted: "#8A7A5E",
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
