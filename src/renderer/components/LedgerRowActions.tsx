type ActionType = "lend" | "deposit" | "cash_purchase";

const deleteMessages: Record<ActionType, string> = {
  lend: "Delete this lend?",
  deposit: "Delete this deposit?",
  cash_purchase: "Delete this cash purchase?",
};

export default function LedgerRowActions({
  type,
  onEdit,
  onDelete,
}: Readonly<{
  type: ActionType;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  const handleDelete = () => {
    if (globalThis.confirm(deleteMessages[type])) onDelete();
  };

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
        onClick={handleDelete}
        className="text-red-600 hover:underline"
      >
        Delete
      </button>
    </td>
  );
}
