import { useState } from "react";
import FormModal from "./FormModal";
import Button from "./Button";

const CONFIRM_PHRASE = "I understand";

interface ConfirmDangerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  /** Optional: disable confirm button while action is in progress */
  isConfirming?: boolean;
}

export default function ConfirmDangerModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Proceed",
  onConfirm,
  isConfirming = false,
}: Readonly<ConfirmDangerModalProps>) {
  const [input, setInput] = useState("");

  const matches = input.trim() === CONFIRM_PHRASE;
  const canProceed = matches && !isConfirming;

  const handleConfirm = () => {
    if (!canProceed) return;
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
            variant="danger"
            onClick={handleConfirm}
            disabled={!canProceed}
          >
            {isConfirming ? "Please wait…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-gray-700 mb-4">{message}</p>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span>{" "}
        to continue
      </label>
      <input
        key={open ? "open" : "closed"}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={CONFIRM_PHRASE}
        className="w-full border border-gray-300 rounded px-3 py-2 font-mono"
        autoComplete="off"
        autoFocus
      />
    </FormModal>
  );
}
