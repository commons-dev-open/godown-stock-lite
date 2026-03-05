import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bars3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { Unit, InvoiceUnit } from "../../shared/types";

type UnitRow = Unit | InvoiceUnit;

interface SortableUnitTableProps {
  items: UnitRow[];
  context: "godown" | "invoice";
  onReorder: (context: "godown" | "invoice", unitIds: number[]) => void;
  onEdit: (row: UnitRow) => void;
  onDelete: (row: UnitRow) => void;
  /** When set, delete button is only shown when this returns true (e.g. to hide delete for system units). */
  canDelete?: (row: UnitRow) => boolean;
  emptyMessage?: string;
  showSortOrder?: boolean;
  showType?: boolean;
}

function SortableRow({
  row,
  index,
  total,
  onEdit,
  onDelete,
  canDelete,
  onMoveUp,
  onMoveDown,
  showSortOrder,
  showType,
}: Readonly<{
  row: UnitRow;
  index: number;
  total: number;
  onEdit: (row: UnitRow) => void;
  onDelete: (row: UnitRow) => void;
  canDelete?: (row: UnitRow) => boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showSortOrder?: boolean;
  showType?: boolean;
}>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sortOrder = "sort_order" in row ? row.sort_order : undefined;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 ${isDragging ? "bg-white shadow-md z-10 opacity-90" : ""}`}
    >
      <td className="px-2 py-2 w-8 text-gray-400 align-middle">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-none"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
          <span className="inline-flex flex-col">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move up"
            >
              <ChevronUpIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move down"
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </span>
        </div>
      </td>
      <td className="px-4 py-2 text-sm text-gray-900">{row.name}</td>
      <td className="px-4 py-2 text-sm text-gray-900">
        {row.symbol?.trim() || "—"}
      </td>
      {showType && (
        <td className="px-4 py-2 text-sm text-gray-500">
          {"unit_type_name" in row ? (row.unit_type_name?.trim() || "—") : "—"}
        </td>
      )}
      {showSortOrder && (
        <td className="px-4 py-2 text-sm text-gray-500">{sortOrder ?? "—"}</td>
      )}
      <td className="px-2 py-2 text-right text-sm w-[1%]">
        <span className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
            aria-label="Edit"
          >
            <PencilSquareIcon className="w-5 h-5" />
          </button>
          {(!canDelete || canDelete(row)) && (
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
              aria-label="Delete"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

export default function SortableUnitTable({
  items,
  context,
  onReorder,
  onEdit,
  onDelete,
  canDelete,
  emptyMessage = "No data",
  showSortOrder = false,
  showType = false,
}: Readonly<SortableUnitTableProps>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(
      context,
      reordered.map((u) => u.id)
    );
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const reordered = arrayMove(items, index, index - 1);
    onReorder(
      context,
      reordered.map((u) => u.id)
    );
  };

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const reordered = arrayMove(items, index, index + 1);
    onReorder(
      context,
      reordered.map((u) => u.id)
    );
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
        {emptyMessage}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="table-scroll-wrap overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 w-8" aria-label="Reorder" />
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                Symbol
              </th>
              {showType && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                  Type
                </th>
              )}
              {showSortOrder && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                  Sort order
                </th>
              )}
              <th className="px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase w-[1%]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((row, index) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  index={index}
                  total={items.length}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  canDelete={canDelete}
                  onMoveUp={() => moveUp(index)}
                  onMoveDown={() => moveDown(index)}
                  showSortOrder={showSortOrder}
                  showType={showType}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}
