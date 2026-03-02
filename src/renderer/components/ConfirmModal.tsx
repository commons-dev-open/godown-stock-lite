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
}

export default function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "OK",
  confirmVariant = "primary",
  onConfirm,
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
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-gray-700">{message}</p>
    </FormModal>
  );
}
