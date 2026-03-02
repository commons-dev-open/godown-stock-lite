import { useState, useCallback, useEffect } from "react";
import { TRIAL_MODE, TRIAL_END_ISO } from "shared/buildConfig";
import { isTrialExpired, formatTrialEndDateTime } from "shared/trialUtils";
import FormModal from "./FormModal";
import Button from "./Button";

const initialExpired = Boolean(
  TRIAL_MODE && TRIAL_END_ISO && isTrialExpired(TRIAL_END_ISO)
);

/**
 * When trial has ended, covers the app with a transparent overlay.
 * Dialog opens immediately on load or as soon as the trial end time is reached
 * (even if the app is already open). Every click on the overlay re-opens it.
 */
export default function TrialGuard() {
  const [expired, setExpired] = useState(initialExpired);
  const [dialogOpen, setDialogOpen] = useState(initialExpired);

  useEffect(() => {
    if (!TRIAL_MODE || !TRIAL_END_ISO || expired) return;
    const id = setInterval(() => {
      if (isTrialExpired(TRIAL_END_ISO)) {
        setExpired(true);
        setDialogOpen(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expired]);

  const handleOverlayClick = useCallback(() => {
    setDialogOpen(true);
  }, []);

  if (!expired) return null;

  const expiryTime = TRIAL_END_ISO && formatTrialEndDateTime(TRIAL_END_ISO);

  return (
    <>
      <div
        className="fixed inset-0 z-40 cursor-not-allowed"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <FormModal
        title="Unlock the full version"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="max-w-sm"
        footer={
          <Button
            type="button"
            variant="primary"
            onClick={() => setDialogOpen(false)}
          >
            OK
          </Button>
        }
      >
        <div className="space-y-3 text-gray-700">
          <p className="font-medium text-gray-900">
            Your trial has ended — buy the full version to continue using the
            app.
          </p>
          <p>
            With the full version you get{" "}
            <strong>12 months free support and bug fixes</strong>, plus access
            to all features:
          </p>
          <ul className="text-sm list-disc list-inside space-y-1 text-gray-600">
            <li>Products & stock management</li>
            <li>Mahajans & ledger</li>
            <li>Transactions & daily sales</li>
            <li>Easy data export and import</li>
            <li>Invoices & reports (Beta)</li>
            <li>Bengali language support (Coming soon)</li>
            <li>Light/Dark mode (Coming soon)</li>
            <li>Basic GST support (Coming soon)</li>
          </ul>
          <p className="text-sm">
            Contact Arindam Hazra to get the full version.
          </p>
          {expiryTime && (
            <p className="text-sm text-gray-500">
              Trial expired on <strong>{expiryTime}</strong>.
            </p>
          )}
        </div>
      </FormModal>
    </>
  );
}
