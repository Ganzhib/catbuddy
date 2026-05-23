import uiPreset from "../../packages/ui/tailwind.preset.cjs";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [uiPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
