import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        // Grandma-friendly scale: everything one notch up from normal
        base: ["1.25rem", { lineHeight: "1.75rem" }],
        lg: ["1.5rem", { lineHeight: "2rem" }],
        xl: ["1.875rem", { lineHeight: "2.25rem" }],
        "2xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "3xl": ["3rem", { lineHeight: "1.1" }],
      },
      colors: {
        meemaw: {
          bg: "#FFF8F0",       // warm off-white
          primary: "#2563EB",   // trusting blue
          accent: "#F59E0B",    // warm amber
          success: "#10B981",
          danger: "#EF4444",
          ink: "#1F2937",
        },
      },
      animation: {
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "wave": "wave 1.2s ease-in-out infinite",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
