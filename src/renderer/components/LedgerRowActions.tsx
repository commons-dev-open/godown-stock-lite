import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";

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
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="Edit"
          aria-label="Edit"
        >
          <PencilSquareIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete"
          aria-label="Delete"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </span>
    </td>
  );
}
