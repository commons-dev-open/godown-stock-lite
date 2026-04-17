import { useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { useAuth, type UserRole } from "../context/AuthContext";

export default function ForcePinChange() {
  const { authState, unlock } = useAuth();

  const userId = authState.status === "force_pin_change" ? authState.userId : 0;
  const userName = authState.status === "force_pin_change" ? authState.userName : "";

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(newPin)) return setError("PIN must be exactly 4 digits.");
    if (newPin !== confirmPin) return setError("PINs do not match.");

    setPending(true);
    try {
      await window.electron.auth.forcePinChange({ userId, newPin });
      const users = await window.electron.auth.listUsers();
      const user = users.find((u) => u.id === userId);
      const role = (user?.role ?? "user") as UserRole;
      unlock({ id: userId, name: userName, role });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update PIN.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
      style={{
        background: `
          radial-gradient(ellipse at 30% 40%, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse at 70% 60%, color-mix(in srgb, var(--color-warning) 12%, transparent) 0%, transparent 55%),
          var(--color-bg-app)
        `,
      }}
    >
      <div className="w-full max-w-sm animate-modal-enter">
        <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-subtle)] text-[var(--color-warning)] flex items-center justify-center">
              <ShieldAlert size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--color-text-primary)]">Set Your Personal PIN</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Hi {userName} — your PIN was set by an admin. Please create a new one.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                New PIN <span className="text-[var(--color-danger)]">*</span>
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
                  required
                  className="input-base w-full pl-9 tracking-[0.5em]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Confirm PIN <span className="text-[var(--color-danger)]">*</span>
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
                  required
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
              className="w-full h-10 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pending && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save PIN & Enter App
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
