/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        bharosa: {
          brand: "#c2410c",
          brandDark: "#9a3412",
          brandSoft: "#ffedd5",
          trust: "#166534",
          trustSoft: "#dcfce7",
          cream: "#fffbeb",
          ink: "#1c1917",
          muted: "#57534e",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans"',
          '"Noto Sans Devanagari"',
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 10px 30px rgba(124, 45, 18, 0.08)",
      },
    },
  },
  plugins: [],
};
