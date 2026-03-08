import { useState, useEffect } from "react";
import { TRIAL_MODE, TRIAL_END_ISO } from "shared/buildConfig";
import {
  formatTrialTimer,
  formatTrialEndDateTime,
  getTrialTimeLeft,
  isTrialExpired,
} from "shared/trialUtils";

/** Live countdown or "Trial ended on ..." when in trial mode. */
export default function TrialTimer() {
  const [label, setLabel] = useState(() =>
    TRIAL_MODE && TRIAL_END_ISO ? formatTrialTimer(TRIAL_END_ISO) : ""
  );

  useEffect(() => {
    if (!TRIAL_MODE || !TRIAL_END_ISO || isTrialExpired(TRIAL_END_ISO)) {
      return;
    }
    const tick = () => setLabel(formatTrialTimer(TRIAL_END_ISO));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!label) return null;

  const expired = TRIAL_MODE && TRIAL_END_ISO && isTrialExpired(TRIAL_END_ISO);
  const left = TRIAL_END_ISO ? getTrialTimeLeft(TRIAL_END_ISO) : null;

  return (
    <div
      className="mt-2 text-xs text-gray-500"
      title={
        left
          ? left.expired && TRIAL_END_ISO
            ? formatTrialEndDateTime(TRIAL_END_ISO)
            : `${left.days}d ${left.hours}h ${left.minutes}m ${left.seconds}s left`
          : undefined
      }
    >
      {expired ? (
        <span className="text-amber-700 font-medium">{label}</span>
      ) : (
        <span className="text-gray-600">{label}</span>
      )}
    </div>
  );
}
