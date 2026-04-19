import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";

interface FormModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional max-width class for the dialog (e.g. "max-w-2xl", "max-w-3xl"). Default: "max-w-md" */
  maxWidth?: string;
  /** Optional footer: action buttons only (no Cancel; header has close icon). Rendered as sticky footer. */
  footer?: ReactNode;
  /** When true, uses higher z-index so this modal appears above another open modal (e.g. nested dialogs). */
  stackAbove?: boolean;
  /** When true, closing the modal will show a discard confirmation prompt. */
  isDirty?: boolean;
  /** Stable root id for E2E; close/discard controls use `-close`, `-discard-cancel`, `-discard-confirm`. */
  testId?: string;
}

export default function FormModal({
  title,
  open,
  onClose,
  children,
  maxWidth = "max-w-md",
  footer,
  stackAbove = false,
  isDirty = false,
  testId,
}: FormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Reset confirmation state when modal opens/closes
  useEffect(() => {
    if (!open) setShowDiscardConfirm(false);
  }, [open]);

  const handleCloseAttempt = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleCloseAttempt();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, showDiscardConfirm, handleCloseAttempt]);

  // Focus trap: keep Tab cycling within the modal
  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = modal.querySelectorAll(focusableSelector);
      if (focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener("keydown", handleTab);
    setTimeout(() => {
      const first = modal.querySelector(focusableSelector) as HTMLElement;
      first?.focus();
    }, 50);
    return () => modal.removeEventListener("keydown", handleTab);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center ${stackAbove ? "z-[60]" : "z-50"}`}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 z-0 bg-black/40 backdrop-blur-sm"
        onClick={handleCloseAttempt}
        aria-hidden
      />
      {/* Modal container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        className={`relative z-10 flex flex-col bg-[var(--color-bg-surface)] rounded-xl shadow-overlay w-full mx-4 max-h-[90vh] animate-modal-enter ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-5 pb-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={handleCloseAttempt}
            data-testid={testId ? `${testId}-close` : undefined}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-raised)] rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {/* Discard confirmation bar */}
        {showDiscardConfirm && (
          <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-[var(--color-warning-subtle)] border-y border-[var(--color-border-default)] text-sm text-[var(--color-warning-text)]">
            <span>You have unsaved changes. Discard?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                data-testid={testId ? `${testId}-discard-cancel` : undefined}
                className="px-2.5 py-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-raised)] text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClose}
                data-testid={testId ? `${testId}-discard-confirm` : undefined}
                className="px-2.5 py-1 rounded-lg bg-[var(--color-danger)] text-white hover:opacity-90 text-xs font-medium transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {/* Footer */}
        {footer != null ? (
          <div className="sticky bottom-0 flex shrink-0 justify-end gap-2 px-5 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-raised)] rounded-b-xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
