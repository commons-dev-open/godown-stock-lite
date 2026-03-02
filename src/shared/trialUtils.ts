/**
 * Trial end date helpers. TRIAL_END_ISO is an ISO date-time string.
 */

export function getTrialEndDate(iso: string): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isTrialExpired(iso: string): boolean {
  const end = getTrialEndDate(iso);
  return end !== null && Date.now() >= end.getTime();
}

export interface TrialTimeLeft {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getTrialTimeLeft(iso: string): TrialTimeLeft | null {
  const end = getTrialEndDate(iso);
  if (!end) return null;
  const now = Date.now();
  const endMs = end.getTime();
  if (now >= endMs) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  let diff = Math.floor((endMs - now) / 1000);
  const seconds = diff % 60;
  diff = Math.floor(diff / 60);
  const minutes = diff % 60;
  diff = Math.floor(diff / 60);
  const hours = diff % 24;
  const days = Math.floor(diff / 24);
  return { expired: false, days, hours, minutes, seconds };
}

/** Format for display: "5d 3h 2m 45s left" or "Trial ended on 15/04/2025 at 23:59:59" */
export function formatTrialTimer(iso: string): string {
  const end = getTrialEndDate(iso);
  if (!end) return "";
  const left = getTrialTimeLeft(iso);
  if (!left) return "";
  if (left.expired) {
    return `Trial ended on ${formatTrialEndDateTime(iso)}`;
  }
  const parts = [
    ...(left.days > 0 ? [`${left.days}d`] : []),
    `${left.hours}h`,
    `${left.minutes}m`,
    `${left.seconds}s`,
  ];
  return `${parts.join(" ")} left`;
}

/** Human-readable expiry date and time, e.g. "15/04/2025 at 23:59:59" */
export function formatTrialEndDateTime(iso: string): string {
  const end = getTrialEndDate(iso);
  if (!end) return "";
  const d = String(end.getDate()).padStart(2, "0");
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const y = end.getFullYear();
  const h = String(end.getHours()).padStart(2, "0");
  const min = String(end.getMinutes()).padStart(2, "0");
  const s = String(end.getSeconds()).padStart(2, "0");
  return `${d}/${m}/${y} at ${h}:${min}:${s}`;
}
