import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "amber"
  | "green";

type ButtonSize = "sm" | "default" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  /** When true, shows a spinner and disables the button. */
  loading?: boolean;
  /** Stable selector for E2E (sets `data-testid`). */
  testId?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)] shadow-xs hover:shadow-sm focus-visible:ring-[var(--color-accent)]",
  secondary:
    "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] hover:border-[var(--color-border-strong)] focus-visible:ring-[var(--color-border-strong)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:opacity-90 focus-visible:ring-[var(--color-danger)]",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-text-primary)] focus-visible:ring-[var(--color-border-strong)]",
  amber:
    "bg-[var(--color-warning)] text-white hover:opacity-90 focus-visible:ring-[var(--color-warning)]",
  green:
    "bg-[var(--color-success)] text-white hover:opacity-90 focus-visible:ring-[var(--color-success)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  default: "px-3.5 py-2 text-sm",
  lg: "px-4 py-2.5 text-sm",
};

export default function Button({
  variant = "primary",
  size = "default",
  className = "",
  type = "button",
  loading = false,
  disabled,
  children,
  testId,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
      disabled={loading || disabled}
      data-testid={testId}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin -ml-0.5 mr-1.5 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
