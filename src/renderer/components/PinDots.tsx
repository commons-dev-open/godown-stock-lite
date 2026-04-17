interface PinDotsProps {
  filled: number;
  error?: boolean;
  onAnimationEnd?: () => void;
}

export default function PinDots({ filled, error, onAnimationEnd }: PinDotsProps) {
  return (
    <div
      className={`flex items-center gap-4 ${error ? "animate-shake" : ""}`}
      onAnimationEnd={onAnimationEnd}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < filled
              ? "bg-[var(--color-accent)] border-[var(--color-accent)] scale-110"
              : "bg-transparent border-[var(--color-border-strong)]"
          }`}
        />
      ))}
    </div>
  );
}
