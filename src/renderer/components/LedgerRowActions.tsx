type ActionType = "lend" | "deposit" | "cash_purchase";

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
    <td className="px-4 py-2 text-right text-sm space-x-2">
      <button
        type="button"
        onClick={onEdit}
        className="text-blue-600 hover:underline"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="text-red-600 hover:underline"
      >
        Delete
      </button>
    </td>
  );
}
