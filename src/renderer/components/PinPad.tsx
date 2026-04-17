import { Delete } from "lucide-react";

interface PinPadProps {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", ""];

export default function PinPad({ onDigit, onBackspace, disabled }: PinPadProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map((key, idx) => {
        if (key === "") return <div key={idx} />;

        const isBackspace = key === "⌫";

        return (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => (isBackspace ? onBackspace() : onDigit(key))}
            className={`
              w-16 h-16 rounded-2xl text-xl font-semibold
              flex items-center justify-center
              bg-[var(--color-bg-surface)]
              border border-[var(--color-border-default)]
              text-[var(--color-text-primary)]
              hover:bg-[var(--color-accent-muted)] hover:border-[var(--color-accent)]
              active:scale-95
              transition-all duration-100
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-xs
            `}
            aria-label={isBackspace ? "Backspace" : key}
          >
            {isBackspace ? <Delete size={20} strokeWidth={1.75} /> : key}
          </button>
        );
      })}
    </div>
  );
}
