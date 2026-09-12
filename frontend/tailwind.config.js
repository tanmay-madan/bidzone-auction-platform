/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF9",
        ink: "#1A1D24",
        slate: {
          DEFAULT: "#5B6270",
          light: "#8A90A0",
        },
        navy: {
          DEFAULT: "#1B2A4A",
          light: "#28406E",
          dark: "#101B33",
        },
        brass: {
          DEFAULT: "#B08D57",
          light: "#C9A876",
          dark: "#8F7040",
        },
        success: "#2F6F4E",
        border: "#E4E2DD",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        lg: "14px",
      },
    },
  },
  plugins: [],
};
