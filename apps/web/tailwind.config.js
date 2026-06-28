import uiPreset from "../../packages/ui/tailwind.preset.cjs";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [uiPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        alibaba: ['"Alibaba PuHuiTi"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
