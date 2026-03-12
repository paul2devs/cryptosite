module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FFD700",
          dark: "#E6C200"
        },
        emerald: {
          DEFAULT: "#00C48C"
        },
        background: {
          charcoal: "#222222",
          slate: "#2B2B2B"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["Roboto Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"]
      },
      boxShadow: {
        "elevated-card": "0 24px 80px rgba(0, 0, 0, 0.85)"
      }
    }
  },
  plugins: []
};

