import FormModal from "./FormModal";
import Button from "./Button";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  /** "danger" for destructive actions (e.g. Delete). Default: "primary". */
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  /** Stable E2E id for dialog and footer buttons (`-cancel`, `-confirm`). */
  testId?: string;
}

export default function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "OK",
  confirmVariant = "primary",
  onConfirm,
  testId,
}: Readonly<ConfirmModalProps>) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <FormModal
      title={title}
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      testId={testId}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            testId={testId ? `${testId}-cancel` : undefined}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={handleConfirm}
            testId={testId ? `${testId}-confirm` : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[var(--color-text-secondary)]">{message}</p>
    </FormModal>
  );
}
