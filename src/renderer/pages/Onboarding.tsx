import { useEffect, useState } from "react";
import { Building2, Lock, Tag, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import AppleToggle from "../components/AppleToggle";
import LanguageSwitcher from "../i18n/LanguageSwitcher";
import ThemeSwitcher from "../components/ThemeSwitcher";

const DISPLAY_NAME_MAX = 25;

export default function Onboarding() {
  const { completeOnboarding } = useAuth();
  const { t } = useTranslation("onboarding");

  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displaySameAsCompany, setDisplaySameAsCompany] = useState(true);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [customerKey, setCustomerKey] = useState("");
  const [confirmCustomerKey, setConfirmCustomerKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Keep displayName synced with companyName when toggle is on
  useEffect(() => {
    if (displaySameAsCompany) {
      setDisplayName(companyName.slice(0, DISPLAY_NAME_MAX));
    }
  }, [companyName, displaySameAsCompany]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedCompany = companyName.trim();
    const trimmedOwner = ownerName.trim();
    const trimmedDisplay = displayName.trim().slice(0, DISPLAY_NAME_MAX);

    if (!trimmedCompany)
      return setError(t("onboarding.errors.companyNameRequired"));
    if (!trimmedOwner)
      return setError(t("onboarding.errors.ownerNameRequired"));
    if (!trimmedDisplay)
      return setError(t("onboarding.errors.businessDisplayNameRequired"));
    if (!/^\d{4}$/.test(pin)) return setError(t("onboarding.errors.pinLength"));
    if (pin !== confirmPin)
      return setError(t("onboarding.errors.pinConfirmMismatch"));
    const trimmedCustomerKey = customerKey.trim();
    if (!trimmedCustomerKey)
      return setError(t("onboarding.errors.recoveryKeyRequired"));
    if (trimmedCustomerKey !== confirmCustomerKey.trim()) {
      return setError(t("onboarding.errors.recoveryKeyMismatch"));
    }

    setPending(true);
    try {
      const saveRes = await window.electron.auth.saveRecoveryKeyToDevice({
        ownerName: trimmedOwner,
        companyName: trimmedCompany,
        key: trimmedCustomerKey,
      });
      await window.electron.auth.setupSuperAdmin({
        companyName: trimmedCompany,
        ownerName: trimmedOwner,
        displayName: trimmedDisplay,
        pin,
        customerMasterKey: trimmedCustomerKey,
      });
      window.alert(t("onboarding.recoverySavedAlert", { path: saveRes.path }));
      completeOnboarding(trimmedDisplay);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("onboarding.errors.setupFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden px-4 pb-6 pt-16"
      style={{
        background: `
        radial-gradient(ellipse at 30% 40%, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, transparent 60%),
        radial-gradient(ellipse at 70% 60%, color-mix(in srgb, var(--color-success) 12%, transparent) 0%, transparent 55%),
        var(--color-bg-app)
      `,
      }}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeSwitcher variant="compact" />
        <LanguageSwitcher variant="compact" compactTone="surface" />
      </div>
      <div className="animate-modal-enter mx-auto my-2 w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-accent)] text-white mb-4 shadow-md">
            <Building2 size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t("onboarding.title")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {t("onboarding.subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-md p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("onboarding.companyNameLabel")}{" "}
                <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="relative">
                <Building2
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t("onboarding.companyNamePlaceholder")}
                  maxLength={60}
                  required
                  className="input-base w-full pl-9"
                  autoFocus
                />
              </div>
            </div>

            {/* Owner Name */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("onboarding.ownerNameLabel")}{" "}
                <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                />
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder={t("onboarding.ownerNamePlaceholder")}
                  maxLength={60}
                  required
                  className="input-base w-full pl-9"
                />
              </div>
            </div>

            {/* Business Display Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {t("onboarding.businessDisplayNameLabel")}{" "}
                  <span className="text-[var(--color-danger)]">*</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer select-none">
                  <AppleToggle
                    checked={displaySameAsCompany}
                    onChange={setDisplaySameAsCompany}
                    aria-label={t("onboarding.sameAsCompany")}
                  />
                  {t("onboarding.sameAsCompany")}
                </label>
              </div>
              <div className="relative">
                <Tag
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) =>
                    setDisplayName(e.target.value.slice(0, DISPLAY_NAME_MAX))
                  }
                  placeholder={t("onboarding.businessDisplayNamePlaceholder")}
                  maxLength={DISPLAY_NAME_MAX}
                  required
                  disabled={displaySameAsCompany}
                  className="input-base w-full pl-9 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                {t("onboarding.businessDisplayNameCountHint", {
                  count: displayName.length,
                  max: DISPLAY_NAME_MAX,
                })}
              </p>
            </div>

            <hr className="border-[var(--color-border-subtle)]" />

            {/* PIN */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("onboarding.pinLabel")}{" "}
                <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder={t("onboarding.pinPlaceholder")}
                  required
                  className="input-base w-full pl-9 tracking-[0.5em]"
                />
              </div>
            </div>

            {/* Confirm PIN */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("onboarding.pinConfirmLabel")}{" "}
                <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder={t("onboarding.pinPlaceholder")}
                  required
                  className="input-base w-full pl-9 tracking-[0.5em]"
                />
              </div>
            </div>

            {/* Owner Recovery Key */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("onboarding.recoveryKeyLabel")}{" "}
                <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="password"
                value={customerKey}
                onChange={(e) => setCustomerKey(e.target.value)}
                placeholder={t("onboarding.recoveryKeyPlaceholder")}
                required
                className="input-base w-full text-sm"
              />
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1 mt-3">
                {t("onboarding.recoveryKeyConfirmLabel")}{" "}
                <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="password"
                value={confirmCustomerKey}
                onChange={(e) => setConfirmCustomerKey(e.target.value)}
                placeholder={t("onboarding.recoveryKeyConfirmPlaceholder")}
                required
                className="input-base w-full text-sm"
              />
              <p className="text-xs text-[var(--color-warning)] mt-1">
                {t("onboarding.recoveryKeyHint")}
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-subtle)] border border-[var(--color-danger-muted)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={pending}
              className="w-full h-11 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pending ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {pending ? t("onboarding.settingUp") : t("onboarding.getStarted")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
