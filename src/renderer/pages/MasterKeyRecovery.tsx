import { useState } from "react";
import { ArrowLeft, KeyRound, Lock, Shield, ShieldCheck } from "lucide-react";

interface MasterKeyRecoveryProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function MasterKeyRecovery({ onBack, onSuccess }: MasterKeyRecoveryProps) {
  const [step, setStep] = useState<"key" | "new_pin">("key");
  const [masterKey, setMasterKey] = useState("");
  const [keyType, setKeyType] = useState<"customer" | "developer" | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleVerifyKey(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!masterKey.trim()) return setError("Enter a recovery key.");
    setPending(true);
    try {
      const res = await window.electron.auth.verifyMasterKey(masterKey.trim());
      if (!res.valid) {
        setError("Invalid recovery key. Try again.");
        setMasterKey("");
        return;
      }
      setKeyType(res.keyType);
      setStep("new_pin");
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleResetPin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(newPin)) return setError("PIN must be exactly 4 digits.");
    if (newPin !== confirmPin) return setError("PINs do not match.");
    setPending(true);
    try {
      await window.electron.auth.resetSuperAdminPin({ newPin });
      onSuccess();
    } catch {
      setError("Failed to reset PIN. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to login
      </button>

      <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-md p-6">
        {step === "key" ? (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-subtle)] text-[var(--color-warning)] flex items-center justify-center">
                <KeyRound size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--color-text-primary)]">Account Recovery</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">Enter your master recovery key</p>
              </div>
            </div>

            <form onSubmit={handleVerifyKey} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Recovery Key
                </label>
                <input
                  type="password"
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  placeholder="Enter master recovery key"
                  autoFocus
                  className="input-base w-full"
                />
              </div>

              {error && (
                <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-subtle)] border border-[var(--color-danger-muted)] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full h-10 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {pending && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Verify Key
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center">
                <ShieldCheck size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--color-text-primary)]">Set New PIN</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield size={12} className="text-[var(--color-text-tertiary)]" />
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {keyType === "developer" ? "Developer key verified" : "Owner key verified"}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleResetPin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  New PIN
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    autoFocus
                    className="input-base w-full pl-9 tracking-[0.5em]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Confirm New PIN
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="input-base w-full pl-9 tracking-[0.5em]"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-subtle)] border border-[var(--color-danger-muted)] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full h-10 rounded-xl bg-[var(--color-success)] hover:opacity-90 text-white font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {pending && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Save New PIN
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
