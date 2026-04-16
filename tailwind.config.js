/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{js,ts,jsx,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      colors: {
        "bg-app": "var(--color-bg-app)",
        "bg-surface": "var(--color-bg-surface)",
        "bg-surface-raised": "var(--color-bg-surface-raised)",
        "bg-surface-sunken": "var(--color-bg-surface-sunken)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-tertiary": "var(--color-text-tertiary)",
        "text-inverse": "var(--color-text-inverse)",
        "border-default": "var(--color-border-default)",
        "border-subtle": "var(--color-border-subtle)",
        "border-strong": "var(--color-border-strong)",
        sidebar: {
          DEFAULT: "var(--color-bg-sidebar)",
          hover: "var(--color-bg-sidebar-hover)",
          active: "var(--color-bg-sidebar-active)",
        },
        "text-sidebar": "var(--color-text-sidebar)",
        "text-sidebar-active": "var(--color-text-sidebar-active)",
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
          muted: "var(--color-accent-muted)",
          text: "var(--color-accent-text)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          subtle: "var(--color-success-subtle)",
          text: "var(--color-success-text)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          subtle: "var(--color-warning-subtle)",
          text: "var(--color-warning-text)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          subtle: "var(--color-danger-subtle)",
          text: "var(--color-danger-text)",
        },
        "amount-payable": "var(--color-amount-payable)",
        "amount-receivable": "var(--color-amount-receivable)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        overlay: "var(--shadow-overlay)",
      },
    },
  },
  plugins: [],
};
