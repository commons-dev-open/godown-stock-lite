interface TableLoaderProps {
  columns?: number;
  rows?: number;
}

const widths = [30, 20, 25, 15];

export default function TableLoader({ columns = 4, rows = 5 }: TableLoaderProps) {
  return (
    <div
      className="animate-pulse space-y-3 p-4"
      role="status"
      aria-label="Loading table"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-4 bg-[var(--color-bg-surface-raised)] rounded animate-shimmer"
              style={{ width: `${widths[j % 4]}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
