import { useEffect, useState } from "react";
import { Building2, Shield, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

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
  if (role === "superadmin") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium">
        <Shield size={10} /> Owner
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-warning-subtle)] text-[var(--color-warning)] font-medium">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-surface-raised)] text-[var(--color-text-secondary)] font-medium">
      <User size={10} /> User
    </span>
  );
}

export default function UserSelector() {
  const { authState, selectUser } = useAuth();
  const businessName =
    authState.status === "selecting" ? authState.businessName : "";

  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electron.auth
      .listUsers()
      .then((list) => setUsers(list as UserEntry[]))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

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
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-accent)] text-white mb-3 shadow-md">
          <Building2 size={28} strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{businessName}</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Who is logging in?</p>
      </div>

      {/* User grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-[var(--color-text-tertiary)] text-sm">
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : users.length === 0 ? (
        <p className="text-[var(--color-text-tertiary)] text-sm">No users found.</p>
      ) : (
        <div className={`grid gap-4 w-full max-w-lg ${users.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectUser(u.id, u.name)}
              className="dashboard-action-card flex flex-col items-center gap-3 p-5 text-center group"
            >
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center text-xl font-bold transition-colors group-hover:bg-[var(--color-accent)] group-hover:text-white">
                {getInitials(u.name)}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate max-w-[100px]">{u.name}</p>
                <RoleBadge role={u.role} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
