import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Building2, Search, Shield, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { userSelectSearch, userSelectUserButton } from "shared/test-ids";
import LanguageSwitcher from "../i18n/LanguageSwitcher";
import ThemeSwitcher from "../components/ThemeSwitcher";

/** Above this count, show a searchable single-column list instead of tiles. */
const USER_SELECTOR_TILE_MAX = 6;

interface UserEntry {
  id: number;
  name: string;
  role: string;
  is_active: number;
  pin_is_temporary: number;
  created_at: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation("onboarding");

  if (role === "superadmin") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium">
        <Shield size={10} /> {t("userSelector.roleOwner")}
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-warning-subtle)] text-[var(--color-warning)] font-medium">
        {t("userSelector.roleAdmin")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-surface-raised)] text-[var(--color-text-secondary)] font-medium">
      <User size={10} /> {t("userSelector.roleUser")}
    </span>
  );
}

function userGridClassName(userCount: number): string {
  if (userCount <= 1) {
    return "grid-cols-1";
  }
  if (userCount === 2) {
    return "grid-cols-1 min-[480px]:grid-cols-2";
  }
  return "grid-cols-1 min-[480px]:grid-cols-2 min-[720px]:grid-cols-3";
}

export default function UserSelector() {
  const { authState, selectUser } = useAuth();
  const { t } = useTranslation("onboarding");
  const businessName =
    authState.status === "selecting" ? authState.businessName : "";

  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.electron.auth
      .listUsers()
      .then((list) =>
        setUsers((list as UserEntry[]).filter((user) => user.is_active !== 0))
      )
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const isListMode = !loading && users.length > USER_SELECTOR_TILE_MAX;

  useEffect(() => {
    if (!isListMode) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isListMode]);

  const filteredUsersForList = useMemo(() => {
    const sorted = [...users].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    const q = deferredSearch.trim().toLowerCase();
    if (!q) {
      return sorted;
    }
    return sorted.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, deferredSearch]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain animate-fade-in"
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

      <div
        className={`min-h-full w-full flex flex-col items-center p-6 pb-10 ${
          isListMode ? "pt-8 justify-start" : "justify-center"
        }`}
      >
        {/* Header */}
        <div className={`text-center ${isListMode ? "mb-6" : "mb-8"}`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-accent)] text-white mb-3 shadow-md">
            <Building2 size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {businessName}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {t("userSelector.whoIsLoggingIn")}
          </p>
        </div>

        {/* User grid or list */}
        {loading ? (
          <div className="flex items-center gap-2 text-[var(--color-text-tertiary)] text-sm">
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {t("userSelector.loading")}
          </div>
        ) : users.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)] text-sm">
            {t("userSelector.noUsersFound")}
          </p>
        ) : isListMode ? (
          <div className="w-full max-w-md flex flex-col gap-3">
            <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 backdrop-blur-sm ">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                  aria-hidden
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  placeholder={t("userSelector.searchPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  className="input-base w-full pl-9"
                  data-testid={userSelectSearch}
                />
              </label>
            </div>
            {filteredUsersForList.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-text-tertiary)] px-2">
                {t("userSelector.noSearchMatches")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 w-full">
                {filteredUsersForList.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => selectUser(u.id, u.name)}
                      className="dashboard-action-card flex w-full items-center gap-3 p-3 text-left group"
                      data-testid={userSelectUserButton(u.id)}
                    >
                      <div className="shrink-0 w-11 h-11 rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center text-base font-bold transition-colors group-hover:bg-[var(--color-accent)] group-hover:text-white">
                        {getInitials(u.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {u.name}
                        </p>
                      </div>
                      <div className="shrink-0 self-center">
                        <RoleBadge role={u.role} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            className={`grid gap-4 w-full max-w-lg ${userGridClassName(users.length)}`}
          >
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectUser(u.id, u.name)}
                className="dashboard-action-card flex flex-col items-center gap-3 p-5 text-center group"
                data-testid={userSelectUserButton(u.id)}
              >
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center text-xl font-bold transition-colors group-hover:bg-[var(--color-accent)] group-hover:text-white">
                  {getInitials(u.name)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-center font-semibold text-[var(--color-text-primary)]">
                    {u.name}
                  </p>
                  <RoleBadge role={u.role} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
