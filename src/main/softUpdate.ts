import { app } from "electron";
import {
  SOFT_UPDATE_MANIFEST_URL,
  type SoftUpdateCheckResult,
} from "../shared/softUpdate";
import {
  compareReleaseVersions,
  isDottedNumericVersion,
} from "../shared/versionCompare";

const FETCH_TIMEOUT_MS = 15_000;

let checkInFlight: Promise<SoftUpdateCheckResult> | null = null;

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    const u = new URL(value);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseManifest(body: unknown): {
  latestVersion: string;
  downloadPageUrl: string;
  releaseNotesUrl: string | null;
} | null {
  if (body === null || typeof body !== "object") {
    return null;
  }
  const o = body as Record<string, unknown>;
  const latestVersion =
    typeof o.latestVersion === "string" ? o.latestVersion.trim() : "";
  const downloadPageUrl =
    typeof o.downloadPageUrl === "string" ? o.downloadPageUrl.trim() : "";
  const releaseNotesRaw = o.releaseNotesUrl;
  const releaseNotesUrl =
    typeof releaseNotesRaw === "string" && releaseNotesRaw.trim().length > 0
      ? releaseNotesRaw.trim()
      : null;

  if (
    !isDottedNumericVersion(latestVersion) ||
    !isHttpsUrl(downloadPageUrl) ||
    (releaseNotesUrl !== null && !isHttpsUrl(releaseNotesUrl))
  ) {
    return null;
  }

  return {
    latestVersion,
    downloadPageUrl,
    releaseNotesUrl,
  };
}

export function checkSoftUpdate(): Promise<SoftUpdateCheckResult> {
  const currentVersion = app.getVersion();
  if (checkInFlight) {
    return checkInFlight;
  }
  checkInFlight = runCheck(currentVersion).finally(() => {
    checkInFlight = null;
  });
  return checkInFlight;
}

async function runCheck(
  currentVersion: string
): Promise<SoftUpdateCheckResult> {
  if (!isDottedNumericVersion(currentVersion)) {
    return {
      supported: false,
      currentVersion,
      error: "invalid_response",
      message: "bad_current_version",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(SOFT_UPDATE_MANIFEST_URL, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return {
        supported: false,
        currentVersion,
        error: "fetch_failed",
        message: `HTTP ${response.status}`,
      };
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return {
        supported: false,
        currentVersion,
        error: "invalid_response",
        message: "invalid_json",
      };
    }

    const manifest = parseManifest(parsed);
    if (!manifest) {
      return {
        supported: false,
        currentVersion,
        error: "invalid_response",
        message: "invalid_manifest",
      };
    }

    const cmp = compareReleaseVersions(
      currentVersion,
      manifest.latestVersion
    );
    const isUpdateAvailable = cmp < 0;

    return {
      supported: true,
      currentVersion,
      latestVersion: manifest.latestVersion,
      isUpdateAvailable,
      downloadPageUrl: manifest.downloadPageUrl,
      releaseNotesUrl: manifest.releaseNotesUrl,
    };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.name === "AbortError"
          ? "timeout"
          : e.message
        : "unknown";
    return {
      supported: false,
      currentVersion,
      error: "fetch_failed",
      message,
    };
  }
}
