import { Pencil, Trash2 } from "lucide-react";

type ActionType = "credit_purchase" | "settlement" | "cash_purchase";

export default function LedgerRowActions({
  type: _type,
  onEdit,
  onDelete,
}: Readonly<{
  type: ActionType;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  return (
    <td className="px-2 py-2 text-right text-sm w-[1%]">
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors"
          title="Edit"
          aria-label="Edit"
        >
          <Pencil size={20} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors"
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 size={20} />
        </button>
      </span>
    </td>
  );
}
