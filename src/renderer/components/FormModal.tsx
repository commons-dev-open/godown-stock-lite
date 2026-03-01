import { ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface FormModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional max-width class for the dialog (e.g. "max-w-2xl", "max-w-3xl"). Default: "max-w-md" */
  maxWidth?: string;
  /** Optional footer (e.g. Cancel + Confirm buttons) */
  footer?: ReactNode;
}

export default function FormModal({
  title,
  open,
  onClose,
  children,
  maxWidth = "max-w-md",
  footer,
}: FormModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 z-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex flex-col bg-white rounded-lg shadow-xl w-full mx-4 max-h-[90vh] ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between p-4 border-b bg-white rounded-t-lg">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
        {footer != null ? (
          <div className="flex shrink-0 justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
