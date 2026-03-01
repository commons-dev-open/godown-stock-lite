import { PlusIcon } from "@heroicons/react/24/outline";

interface EmptyStateProps {
  message?: string;
  /** When true, uses border and bg (for inside a card). Default true. */
  bordered?: boolean;
  /** Optional button label (e.g. "Create Invoice"). When set, onAction is required. */
  actionLabel?: string;
  /** Called when the action button is clicked. */
  onAction?: () => void;
}

const defaultMessage = "No records match the filters.";

export default function EmptyState({
  message = defaultMessage,
  bordered = true,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const className = bordered
    ? "text-center py-8 text-gray-500 bg-white rounded-lg border"
    : "text-center py-8 text-gray-500";

  return (
    <div className={className}>
      <p>{message}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <PlusIcon className="w-5 h-5" aria-hidden />
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
