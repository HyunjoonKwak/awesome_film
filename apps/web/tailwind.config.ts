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
          hover: "#818cf8", // indigo-400
          fg: "#ffffff",
        },
        // Timeline clip categories — keep in sync with timeline-clip.tsx.
        clip: {
          media: "#6366f1", // indigo-500
          adjustment: "#10b981", // emerald-500
          overlay: "#f59e0b", // amber-500
        },
      },
      fontSize: {
        // Editor micro-typography: panel labels and badges sit below
        // Tailwind's default xs (12px).
        "2xs": ["11px", { lineHeight: "14px" }],
        "3xs": ["10px", { lineHeight: "12px" }],
      },
      borderRadius: {
        xl: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
