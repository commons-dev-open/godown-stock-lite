interface EmptyStateProps {
  message?: string;
  /** When true, uses border and bg (for inside a card). Default true. */
  bordered?: boolean;
}

const defaultMessage = "No records match the filters.";

export default function EmptyState({
  message = defaultMessage,
  bordered = true,
}: EmptyStateProps) {
  const className = bordered
    ? "text-center py-8 text-gray-500 bg-white rounded-lg border"
    : "text-center py-8 text-gray-500";

  return <div className={className}>{message}</div>;
}
