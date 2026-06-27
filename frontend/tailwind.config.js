/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark premium aesthetics
        dark: {
          900: "#09090b", // Zinc 950
          800: "#18181b", // Zinc 900
          700: "#27272a", // Zinc 800
          600: "#3f3f46", // Zinc 700
        },
        primary: {
          glow: "#3b82f6", // Blue
          accent: "#a855f7", // Purple
          neonGreen: "#10b981", // Emerald (running status)
          neonRed: "#ef4444", // Red (stopped status)
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      }
    },
  },
  plugins: [],
}
