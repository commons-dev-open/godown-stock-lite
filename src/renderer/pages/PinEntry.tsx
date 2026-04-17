import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth, type UserRole } from "../context/AuthContext";
import PinDots from "../components/PinDots";
import PinPad from "../components/PinPad";
import MasterKeyRecovery from "./MasterKeyRecovery";
import LanguageSwitcher from "../i18n/LanguageSwitcher";
import ThemeSwitcher from "../components/ThemeSwitcher";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PinEntry() {
  const { authState, lock, unlock, requirePinChange } = useAuth();

  const userId = authState.status === "entering_pin" ? authState.userId : 0;
  const userName = authState.status === "entering_pin" ? authState.userName : "";
  const businessName = authState.status === "entering_pin" ? authState.businessName : "";

  const [pin, setPin] = useState("");
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      try {
        const users = await window.electron.auth.listUsers();
        const u = users.find((x) => x.id === userId);
        if (!cancelled) setUserRole((u?.role ?? "user") as UserRole);
      } catch {
        if (!cancelled) setUserRole("user");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const submitPin = useCallback(
    async (p: string) => {
      if (pending) return;
      setPending(true);
      setErrorMsg("");
      try {
        const res = await window.electron.auth.verifyPin({ userId, pin: p });
        if (res.valid) {
          // Need to fetch full user info for role
          const users = await window.electron.auth.listUsers();
          const user = users.find((u) => u.id === userId);
          const role = (user?.role ?? "user") as UserRole;
          if (res.pin_is_temporary) {
            requirePinChange(userId, userName);
          } else {
            unlock({ id: userId, name: userName, role });
          }
        } else {
          setHasError(true);
          setErrorMsg("Incorrect PIN");
          setPin("");
        }
      } catch {
        setHasError(true);
        setErrorMsg("Something went wrong");
        setPin("");
      } finally {
        setPending(false);
      }
    },
    [userId, userName, pending, unlock, requirePinChange]
  );

  const handleDigit = useCallback(
    (d: string) => {
      if (pending) return;
      const next = (pin + d).slice(0, 4);
      setPin(next);
      setHasError(false);
      setErrorMsg("");
      if (next.length === 4) {
        setTimeout(() => submitPin(next), 80);
      }
    },
    [pin, pending, submitPin]
  );

  const handleBackspace = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setHasError(false);
    setErrorMsg("");
  }, []);

  // Keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showRecovery) return;
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDigit, handleBackspace, showRecovery]);

  if (showRecovery) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 animate-fade-in"
        style={{
          background: `
            radial-gradient(ellipse at 30% 40%, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 60%, color-mix(in srgb, var(--color-success) 12%, transparent) 0%, transparent 55%),
            var(--color-bg-app)
          `,
        }}
      >
        <div className="absolute right-6 top-6 flex items-center gap-2">
          <ThemeSwitcher variant="compact" />
          <LanguageSwitcher variant="compact" compactTone="surface" />
        </div>
        <MasterKeyRecovery
          onBack={() => setShowRecovery(false)}
          onSuccess={() => {
            setShowRecovery(false);
            setPin("");
            // After recovery, user must re-login with new PIN
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 p-6 animate-fade-in"
      style={{
        background: `
          radial-gradient(ellipse at 30% 40%, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse at 70% 60%, color-mix(in srgb, var(--color-success) 12%, transparent) 0%, transparent 55%),
          var(--color-bg-app)
        `,
      }}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={lock}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft size={16} /> All users
      </button>

      {/* Business name */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <p className="text-sm text-[var(--color-text-tertiary)]">{businessName}</p>
        <ThemeSwitcher variant="compact" />
        <LanguageSwitcher variant="compact" compactTone="surface" />
      </div>

      {/* User avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center text-3xl font-bold shadow-sm">
          {getInitials(userName)}
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{userName}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Enter your PIN</p>
      </div>

      {/* PIN dots */}
      <div className="flex flex-col items-center gap-2">
        <PinDots
          filled={pin.length}
          error={hasError}
          onAnimationEnd={() => setHasError(false)}
        />
        {errorMsg && (
          <p className="text-xs text-[var(--color-danger)] mt-1">{errorMsg}</p>
        )}
      </div>

      {/* Numpad */}
      <PinPad onDigit={handleDigit} onBackspace={handleBackspace} disabled={pending} />

      {/* Forgot PIN — only superadmin can self-recover; others must contact admin */}
      {userRole === "superadmin" ? (
        <button
          type="button"
          onClick={() => setShowRecovery(true)}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors underline-offset-2 hover:underline"
        >
          Forgot PIN?
        </button>
      ) : userRole ? (
        <p className="text-xs text-[var(--color-text-tertiary)] text-center max-w-xs">
          Forgot PIN? Ask your admin to reset it.
        </p>
      ) : null}
    </div>
  );
}
