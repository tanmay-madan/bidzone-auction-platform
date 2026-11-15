/** @type {import('tailwindcss').Config} */

// Every colour reads from a CSS variable (see index.css), so the whole UI
// switches between dark and light themes by flipping one attribute on
// <html>. `<alpha-value>` keeps Tailwind opacity modifiers (bg-gold/20…).
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        night: {
          DEFAULT: v("bg"),
          900: v("bg"),
          800: v("surface"),
          700: v("surface-2"),
          600: v("surface-3"),
        },
        // Hairlines carry their own per-theme alpha so borders stay subtle on glass.
        line: {
          DEFAULT: "rgb(var(--line) / var(--line-a))",
          soft: "rgb(var(--line-soft) / var(--line-soft-a))",
          strong: "rgb(var(--line-strong) / var(--line-strong-a))",
        },
        ivory: v("text"),
        mute: {
          DEFAULT: v("mute"),
          dark: v("mute-2"),
        },
        gold: {
          DEFAULT: v("gold"),
          light: v("gold-light"),
          dark: v("gold-dark"),
        },
        ongold: v("on-gold"),
        live: v("live"),
        win: v("win"),
        info: v("info"),
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--gold) / 0.35), 0 12px 48px -10px rgb(var(--gold) / 0.35)",
        card: "var(--shadow-card)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        rise: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "none" }, // "none" so fixed children (confetti) stay viewport-relative
        },
        flash: {
          "0%": { backgroundColor: "rgb(var(--gold) / 0.28)" },
          "100%": { backgroundColor: "transparent" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "slide-in": {
          "0%": { opacity: 0, transform: "translateX(24px) scale(.98)" },
          "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
        },
        "feed-in": {
          "0%": { opacity: 0, transform: "translateY(-10px)", maxHeight: "0px" },
          "100%": { opacity: 1, transform: "translateY(0)", maxHeight: "80px" },
        },
        // Seconds digit: a slight drop, never invisible.
        tick: {
          "0%": { transform: "translateY(-3px)", opacity: 0.55 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        pop: {
          "0%": { transform: "scale(.6)", opacity: 0 },
          "60%": { transform: "scale(1.08)", opacity: 1 },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        marquee: "marquee 45s linear infinite",
        rise: "rise .55s cubic-bezier(.2,.7,.2,1) both",
        flash: "flash 1.2s ease-out",
        shimmer: "shimmer 1.4s linear infinite",
        "slide-in": "slide-in .35s cubic-bezier(.2,.7,.2,1) both",
        "feed-in": "feed-in .45s cubic-bezier(.2,.7,.2,1) both",
        tick: "tick .3s ease-out",
        pop: "pop .45s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
