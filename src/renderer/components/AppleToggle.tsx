import { type ButtonHTMLAttributes } from "react";

interface AppleToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function AppleToggle({
  checked,
  onChange,
  className = "",
  disabled,
  ...rest
}: Readonly<AppleToggleProps>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "border-transparent bg-[var(--color-accent)] shadow-[0_1px_2px_rgba(0,0,0,0.2)]" : "border-[var(--color-border-strong)] bg-[var(--color-border-default)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"} ${className}`.trim()}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full ring-0 transition-all duration-200 ease-out ${checked ? "translate-x-5 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]" : "translate-x-0.5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]"}`.trim()}
      />
    </button>
  );
}
