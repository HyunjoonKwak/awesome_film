import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Editor surface — true dark, neutral cool grays.
        panel: {
          0: "#0b0d10",
          1: "#101317",
          2: "#161a20",
          3: "#1e242c",
          4: "#262d37",
        },
        ink: {
          1: "#e7ecf3",
          2: "#9aa5b4",
          3: "#5d6776",
        },
        accent: {
          DEFAULT: "#6366f1", // indigo-500
          fg: "#ffffff",
        },
      },
      borderRadius: {
        xl: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
