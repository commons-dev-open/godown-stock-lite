import { ReactNode } from "react";

interface FormModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional max-width class for the dialog (e.g. "max-w-2xl", "max-w-3xl"). Default: "max-w-md" */
  maxWidth?: string;
}

export default function FormModal({
  title,
  open,
  onClose,
  children,
  maxWidth = "max-w-md",
}: FormModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative bg-white rounded-lg shadow-xl w-full mx-4 max-h-[90vh] overflow-auto ${maxWidth}`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
