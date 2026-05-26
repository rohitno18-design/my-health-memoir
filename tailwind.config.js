/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          blue: "#00C6FF",
          indigo: "#3A7BFF",
          purple: "#7B2FFF",
          accent: "#A855F7",
          dark: "#1E2A78",
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #00C6FF, #3A7BFF, #7B2FFF)',
        'brand-gradient-light': 'linear-gradient(135deg, #F8FBFF, #F3F0FF)',
        'glow-blue': 'radial-gradient(circle at 50% 0%, rgba(0,198,255,0.12), transparent 60%)',
        'glow-purple': 'radial-gradient(circle at 80% 100%, rgba(123,47,255,0.10), transparent 60%)',
      },
      boxShadow: {
        'glow-sm': '0 0 20px rgba(58, 123, 255, 0.15)',
        'glow-md': '0 0 32px rgba(58, 123, 255, 0.20)',
        'glow-lg': '0 0 48px rgba(123, 47, 255, 0.15)',
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(58, 123, 255, 0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(123, 47, 255, 0.25)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
