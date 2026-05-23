import uiPreset from "../../packages/ui/tailwind.preset.cjs";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [uiPreset],
  content: [
    "./src/renderer/index.html",
    "./src/renderer/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
