/**
 * Soft-update manifest: GET this URL returns JSON with latestVersion and download links.
 * Bump latestVersion on the server when you ship a new release.
 */
export const SOFT_UPDATE_MANIFEST_URL =
  "https://gsl-api.arindamhazra.in/updates";

export interface SoftUpdateCheckSuccess {
  supported: true;
  currentVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  downloadPageUrl: string;
  releaseNotesUrl: string | null;
}

export interface SoftUpdateCheckFailure {
  supported: false;
  currentVersion: string;
  error: "fetch_failed" | "invalid_response";
  message?: string;
}

export type SoftUpdateCheckResult =
  | SoftUpdateCheckSuccess
  | SoftUpdateCheckFailure;
