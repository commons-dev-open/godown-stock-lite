import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth, useCurrentUser } from "../context/AuthContext";
import { getElectron } from "../api/client";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import { AsyncDataPanel } from "../components/async-data-panel";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  UsersEmptyState,
  UsersHero,
  UsersSectionPanel,
} from "../components/users-page";
import {
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import { PAGE_SIZE } from "../../shared/constants";

export interface UserRow {
  id: number;
  name: string;
  role: string;
  is_active: number;
  pin_is_temporary: number;
  created_at: string;
}

export default function Users() {
  const queryClient = useQueryClient();
  const { updateCurrentUser } = useAuth();
  const currentUser = useCurrentUser();

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getElectron().getSettings(),
    staleTime: 60_000,
  });
  const abbreviationStyle = useMemo(
    () =>
      parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () =>
      getElectron().users.getAll() as Promise<UserRow[]>,
    staleTime: 15_000,
  });

  const users = usersQuery.data ?? [];
  const canManage =
    currentUser?.role === "superadmin" || currentUser?.role === "admin";

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [users]);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", pin: "", role: "user" });
  const [addError, setAddError] = useState("");
  const [addPending, setAddPending] = useState(false);

  const [renameUser, setRenameUser] = useState<UserRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamePending, setRenamePending] = useState(false);

  const [resetConfirmUser, setResetConfirmUser] = useState<UserRow | null>(
    null
  );
  const [resetPinUser, setResetPinUser] = useState<UserRow | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");
  const [resetPinPending, setResetPinPending] = useState(false);

  const activeCount = useMemo(
    () => users.filter((u) => u.is_active !== 0).length,
    [users]
  );

  const invalidateUsers = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  }, [queryClient]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!currentUser) {
      return;
    }
    if (!addForm.name.trim()) {
      setAddError("Name required.");
      return;
    }
    if (!/^\d{4}$/.test(addForm.pin)) {
      setAddError("PIN must be 4 digits.");
      return;
    }
    setAddPending(true);
    try {
      await getElectron().users.create({
        name: addForm.name.trim(),
        pin: addForm.pin,
        role: addForm.role,
        createdBy: currentUser.id,
      });
      setAddForm({ name: "", pin: "", role: "user" });
      setAddOpen(false);
      invalidateUsers();
      toast.success("User created.");
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setAddPending(false);
    }
  }

  async function saveRename() {
    if (!currentUser || !renameUser) {
      return;
    }
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty.");
      return;
    }
    if (trimmed === renameUser.name) {
      setRenameUser(null);
      return;
    }
    setRenamePending(true);
    try {
      await getElectron().users.update({
        id: renameUser.id,
        name: trimmed,
        updatedBy: currentUser.id,
      });
      if (renameUser.id === currentUser.id) {
        updateCurrentUser({ name: trimmed });
      }
      toast.success("Name updated.");
      setRenameUser(null);
      invalidateUsers();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update name."
      );
    } finally {
      setRenamePending(false);
    }
  }

  async function submitResetPin() {
    if (!currentUser || !resetPinUser) {
      return;
    }
    const pin = resetPinValue.replace(/\D/g, "").slice(0, 4);
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN must be 4 digits.");
      return;
    }
    setResetPinPending(true);
    try {
      await getElectron().users.resetPin({
        id: resetPinUser.id,
        newPin: pin,
        resetBy: currentUser.id,
      });
      toast.success("PIN reset.");
      setResetPinUser(null);
      setResetPinValue("");
      invalidateUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset PIN.");
    } finally {
      setResetPinPending(false);
    }
  }

  async function handleToggleActive(u: UserRow) {
    if (!currentUser || u.id === currentUser.id) {
      return;
    }
    try {
      await getElectron().users.update({
        id: u.id,
        isActive: u.is_active === 0,
        updatedBy: currentUser.id,
      });
      invalidateUsers();
    } catch {
      // ignore
    }
  }

  function roleLabel(role: string): string {
    if (role === "superadmin") {
      return "Owner";
    }
    return role;
  }

  const columns = useMemo(() => {
    return [
      {
        key: "name",
        label: "Name",
        sortable: true,
        render: (row: UserRow) => (
          <span className="font-medium text-[var(--color-text-primary)]">
            {row.name}
            {row.id === currentUser.id ? (
              <span className="ml-1.5 text-xs font-normal text-[var(--color-text-tertiary)]">
                (you)
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "role",
        label: "Role",
        sortable: true,
        render: (row: UserRow) => (
          <span className="capitalize text-[var(--color-text-secondary)]">
            {roleLabel(row.role)}
          </span>
        ),
      },
      {
        key: "is_active",
        label: "Status",
        sortable: true,
        render: (row: UserRow) => (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.is_active === 0 ? (
              <span className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-subtle)] px-1.5 py-0.5 rounded">
                Inactive
              </span>
            ) : (
              <span className="text-xs text-[var(--color-success)] bg-[var(--color-success-subtle)] px-1.5 py-0.5 rounded">
                Active
              </span>
            )}
            {row.pin_is_temporary === 1 ? (
              <span className="text-xs text-[var(--color-warning)] bg-[var(--color-warning-subtle)] px-1.5 py-0.5 rounded">
                Temp PIN
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "created_at",
        label: "Created",
        sortable: true,
        render: (row: UserRow) => (
          <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        ),
      },
    ];
  }, [currentUser]);

  const countBadge = (
    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
      {users.length}
    </span>
  );

  const isListEmpty =
    usersQuery.isSuccess && sortedUsers.length === 0;

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <UsersHero
        abbreviationStyle={abbreviationStyle}
        totalUsers={users.length}
        activeUsers={activeCount}
        showAddButton={canManage}
        onAdd={() => setAddOpen(true)}
      />

      <DashboardSectionBoundary
        sectionTitle="Team members"
        containerClassName="dashboard-panel"
        resetKeys={[
          usersQuery.isPending,
          usersQuery.isError,
          sortedUsers.length,
        ]}
      >
        <UsersSectionPanel
          title="Team members"
          description="Manage who can sign in, their roles, and temporary PINs. Owners cannot be deactivated here."
          badge={countBadge}
        >
          <AsyncDataPanel
            isLoading={usersQuery.isPending}
            isError={usersQuery.isError}
            onRetry={() => {
              void usersQuery.refetch();
            }}
            isEmpty={isListEmpty}
            empty={
              <UsersEmptyState
                title="No team members"
                description="Add users so each person can sign in with their own PIN."
                actionLabel={canManage ? "Add user" : undefined}
                onAction={canManage ? () => setAddOpen(true) : undefined}
              />
            }
            loaderColumns={4}
            loaderRows={6}
          >
            <DataTable<UserRow>
                scrollHeightPreset="compact"
                columns={columns}
                data={sortedUsers}
                extraActions={(row) => {
                  const canEditName =
                    row.id === currentUser.id ||
                    (canManage && row.role !== "superadmin");
                  const showAdminActions =
                    canManage &&
                    row.id !== currentUser.id &&
                    row.role !== "superadmin";
                  if (!canEditName && !showAdminActions) {
                    return null;
                  }
                  return (
                    <span className="inline-flex items-center gap-1">
                      {canEditName ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          className="!py-1 !px-2 text-xs"
                          onClick={() => {
                            setRenameUser(row);
                            setRenameValue(row.name);
                          }}
                        >
                          Edit name
                        </Button>
                      ) : null}
                      {showAdminActions ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            className="!py-1 !px-2 text-xs"
                            onClick={() => setResetConfirmUser(row)}
                          >
                            Reset PIN
                          </Button>
                          <Button
                            size="sm"
                            variant={row.is_active ? "ghost" : "secondary"}
                            type="button"
                            className="!py-1 !px-2 text-xs"
                            onClick={() => {
                              void handleToggleActive(row);
                            }}
                          >
                            {row.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </>
                      ) : null}
                    </span>
                  );
                }}
                emptyMessage="No users on this page."
                pagination={{ type: "client", pageSize: PAGE_SIZE }}
              />
          </AsyncDataPanel>
        </UsersSectionPanel>
      </DashboardSectionBoundary>

      <FormModal
        title="Add user"
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddError("");
        }}
        footer={
          <Button type="submit" form="form-add-user" disabled={addPending}>
            <Check size={16} className="mr-1" aria-hidden="true" />
            Create
          </Button>
        }
      >
        <form id="form-add-user" onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Name">
              <input
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, name: e.target.value }))
                }
                className="input-base w-full"
                placeholder="Full name"
                autoFocus
              />
            </FormField>
            <FormField label="Role">
              <select
                value={addForm.role}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, role: e.target.value }))
                }
                className="input-base w-full"
              >
                <option value="user">User</option>
                {currentUser.role === "superadmin" ? (
                  <option value="admin">Admin</option>
                ) : null}
              </select>
            </FormField>
          </div>
          <FormField label="Temporary PIN (4 digits)">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={addForm.pin}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              placeholder="••••"
              className="input-base w-full tracking-[0.5em]"
            />
          </FormField>
          {addError ? (
            <p className="text-sm text-[var(--color-danger)]">{addError}</p>
          ) : null}
        </form>
      </FormModal>

      <FormModal
        title="Rename"
        open={renameUser !== null}
        onClose={() => setRenameUser(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setRenameUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void saveRename();
              }}
              disabled={renamePending}
            >
              Save
            </Button>
          </div>
        }
      >
        <FormField label="Name">
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="input-base w-full"
            disabled={renamePending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void saveRename();
              }
            }}
          />
        </FormField>
      </FormModal>

      <ConfirmModal
        open={resetConfirmUser !== null}
        onClose={() => setResetConfirmUser(null)}
        title="Reset PIN"
        message={`Reset ${resetConfirmUser?.name ?? ""}'s PIN? They will use a temporary PIN and must choose a new one on next login.`}
        confirmLabel="Continue"
        confirmVariant="danger"
        onConfirm={() => {
          if (resetConfirmUser) {
            setResetPinUser(resetConfirmUser);
            setResetPinValue("");
            setResetConfirmUser(null);
          }
        }}
      />

      <FormModal
        title={
          resetPinUser
            ? `New temporary PIN for ${resetPinUser.name}`
            : "Reset PIN"
        }
        open={resetPinUser !== null}
        onClose={() => {
          setResetPinUser(null);
          setResetPinValue("");
        }}
        footer={
          <Button
            type="button"
            onClick={() => {
              void submitResetPin();
            }}
            disabled={resetPinPending}
          >
            Reset PIN
          </Button>
        }
      >
        <FormField label="Temporary PIN (4 digits)">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={resetPinValue}
            onChange={(e) =>
              setResetPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="••••"
            className="input-base w-full tracking-[0.5em]"
            disabled={resetPinPending}
            autoFocus
          />
        </FormField>
      </FormModal>
    </div>
  );
}
