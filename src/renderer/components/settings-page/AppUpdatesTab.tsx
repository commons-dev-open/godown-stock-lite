import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getElectron } from "../../api/client";
import Button from "../Button";
import type { SoftUpdateCheckResult } from "../../../shared/softUpdate";

export function AppUpdatesTab() {
  const { t: settingsT } = useTranslation("settings");
  const api = getElectron();

  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [checkResult, setCheckResult] = useState<SoftUpdateCheckResult | null>(
    null
  );
  const [isChecking, setIsChecking] = useState(false);
  const [legacyBridge, setLegacyBridge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof api.getSoftUpdateCurrentVersion !== "function") {
      setLegacyBridge(true);
      return;
    }
    setLegacyBridge(false);
    void api.getSoftUpdateCurrentVersion().then((v) => {
      if (!cancelled) {
        setCurrentVersion(v);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const runCheck = useCallback(async () => {
    if (typeof api.checkSoftUpdate !== "function") {
      setLegacyBridge(true);
      return;
    }
    setIsChecking(true);
    setCheckResult(null);
    try {
      const result = await api.checkSoftUpdate();
      setCheckResult(result);
      if (result.supported) {
        setCurrentVersion(result.currentVersion);
      } else {
        setCurrentVersion(result.currentVersion);
      }
    } finally {
      setIsChecking(false);
    }
  }, [api]);

  const openUrl = useCallback(async (url: string) => {
    await api.openExternal(url);
  }, [api]);

  const failureMessageKey = (message: string | undefined): string => {
    if (message === "invalid_json") {
      return "appUpdates.errors.invalidJson";
    }
    if (message === "invalid_manifest") {
      return "appUpdates.errors.invalidManifest";
    }
    if (message === "timeout") {
      return "appUpdates.errors.timeout";
    }
    if (message === "bad_current_version") {
      return "appUpdates.errors.badCurrentVersion";
    }
    if (message?.startsWith("HTTP ")) {
      return "appUpdates.errors.badStatus";
    }
    return "appUpdates.errors.generic";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-raised)]/40 p-5">
        <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
          {settingsT("appUpdates.currentVersionLabel")}
        </p>
        <p className="text-sm font-medium text-[var(--color-text-primary)] font-mono">
          {currentVersion.length > 0 ? currentVersion : "—"}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-3">
          {settingsT("appUpdates.intro")}
        </p>
        {legacyBridge && (
          <div
            className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-[var(--color-text-secondary)]"
            role="status"
          >
            {settingsT("appUpdates.errors.staleBridge")}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isChecking || legacyBridge}
            onClick={() => {
              void runCheck();
            }}
          >
            <Download size={16} className="mr-1 shrink-0" aria-hidden="true" />
            {isChecking
              ? settingsT("appUpdates.checking")
              : settingsT("appUpdates.checkButton")}
          </Button>
        </div>
      </div>

      {checkResult !== null && !checkResult.supported && (
        <div
          className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-secondary)]"
          role="status"
        >
          <p className="font-medium text-[var(--color-text-primary)] mb-1">
            {settingsT("appUpdates.checkFailedTitle")}
          </p>
          <p>{settingsT(failureMessageKey(checkResult.message))}</p>
        </div>
      )}

      {checkResult !== null && checkResult.supported && (
        <div
          className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 space-y-3"
          role="status"
        >
          {checkResult.isUpdateAvailable ? (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {settingsT("appUpdates.updateAvailable", {
                  latest: checkResult.latestVersion,
                })}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {settingsT("appUpdates.updateAvailableHint")}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  type="button"
                  onClick={() => {
                    void openUrl(checkResult.downloadPageUrl);
                  }}
                >
                  <ExternalLink
                    size={16}
                    className="mr-1 shrink-0"
                    aria-hidden="true"
                  />
                  {settingsT("appUpdates.openDownload")}
                </Button>
                {checkResult.releaseNotesUrl !== null && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void openUrl(checkResult.releaseNotesUrl as string);
                    }}
                  >
                    <ExternalLink
                      size={16}
                      className="mr-1 shrink-0"
                      aria-hidden="true"
                    />
                    {settingsT("appUpdates.openReleaseNotes")}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {settingsT("appUpdates.upToDate", {
                latest: checkResult.latestVersion,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
