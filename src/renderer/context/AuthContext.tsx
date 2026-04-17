import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type UserRole = "superadmin" | "admin" | "user";

export interface CurrentUser {
  id: number;
  name: string;
  role: UserRole;
}

interface UserEntry {
  id: number;
  name: string;
  is_active: number;
}

type AuthState =
  | { status: "loading" }
  | { status: "onboarding" }
  | { status: "selecting"; businessName: string }
  | { status: "entering_pin"; userId: number; userName: string; businessName: string }
  | { status: "force_pin_change"; userId: number; userName: string; businessName: string }
  | { status: "unlocked"; user: CurrentUser; businessName: string };

interface AuthContextValue {
  authState: AuthState;
  selectUser: (userId: number, userName: string) => void;
  unlock: (user: CurrentUser) => void;
  lock: () => void;
  completeOnboarding: (businessName: string) => void;
  requirePinChange: (userId: number, userName: string) => void;
  updateCurrentUser: (partial: Partial<CurrentUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    async function init() {
      try {
        const settings = await window.electron.getSettings();
        const isOnboarded = settings?.onboarding_complete === "true";
        const businessName =
          settings?.displayName ??
          settings?.company_name ??
          settings?.business_name ??
          "Godown";
        if (!isOnboarded) {
          setAuthState({ status: "onboarding" });
        } else {
          const users = (await window.electron.auth.listUsers()) as UserEntry[];
          const activeUsers = users.filter((user) => user.is_active !== 0);
          if (activeUsers.length === 1) {
            const singleUser = activeUsers[0];
            setAuthState({
              status: "entering_pin",
              userId: singleUser.id,
              userName: singleUser.name,
              businessName,
            });
          } else {
            setAuthState({ status: "selecting", businessName });
          }
        }
      } catch {
        setAuthState({ status: "onboarding" });
      }
    }
    init();
  }, []);

  const selectUser = useCallback((userId: number, userName: string) => {
    setAuthState((prev) => {
      const businessName =
        prev.status === "selecting" ||
        prev.status === "entering_pin" ||
        prev.status === "force_pin_change" ||
        prev.status === "unlocked"
          ? prev.businessName
          : "";
      return { status: "entering_pin", userId, userName, businessName };
    });
  }, []);

  const unlock = useCallback((user: CurrentUser) => {
    setAuthState((prev) => {
      const businessName =
        prev.status === "entering_pin" ||
        prev.status === "force_pin_change" ||
        prev.status === "selecting" ||
        prev.status === "unlocked"
          ? prev.businessName
          : "";
      return { status: "unlocked", user, businessName };
    });
  }, []);

  const lock = useCallback(() => {
    setAuthState((prev) => {
      const businessName =
        prev.status === "unlocked" ||
        prev.status === "entering_pin" ||
        prev.status === "force_pin_change" ||
        prev.status === "selecting"
          ? prev.businessName
          : "";

      void window.electron.auth
        .listUsers()
        .then((users) => {
          const activeUsers = (users as UserEntry[]).filter(
            (user) => user.is_active !== 0
          );
          if (activeUsers.length === 1) {
            const singleUser = activeUsers[0];
            setAuthState({
              status: "entering_pin",
              userId: singleUser.id,
              userName: singleUser.name,
              businessName,
            });
            return;
          }
          setAuthState({ status: "selecting", businessName });
        })
        .catch(() => {
          setAuthState({ status: "selecting", businessName });
        });

      return { status: "loading" };
    });
  }, []);

  const completeOnboarding = useCallback((businessName: string) => {
    setAuthState({ status: "selecting", businessName });
  }, []);

  const updateCurrentUser = useCallback((partial: Partial<CurrentUser>) => {
    setAuthState((prev) => {
      if (prev.status !== "unlocked") return prev;
      return { ...prev, user: { ...prev.user, ...partial } };
    });
  }, []);

  const requirePinChange = useCallback((userId: number, userName: string) => {
    setAuthState((prev) => {
      const businessName =
        prev.status === "entering_pin" ||
        prev.status === "selecting" ||
        prev.status === "unlocked"
          ? prev.businessName
          : "";
      return { status: "force_pin_change", userId, userName, businessName };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ authState, selectUser, unlock, lock, completeOnboarding, requirePinChange, updateCurrentUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useCurrentUser(): CurrentUser {
  const { authState } = useAuth();
  if (authState.status !== "unlocked") {
    throw new Error("useCurrentUser called while not unlocked");
  }
  return authState.user;
}
