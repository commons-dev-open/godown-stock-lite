import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CurrentUser } from "../../context/AuthContext";
import DataTable from "../DataTable";
import { AsyncDataPanel } from "../async-data-panel";
import { PAGE_SIZE } from "../../../shared/constants";

export interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_label: string | null;
  details: string | null;
  created_at: string;
}

interface ActivityLogSectionProps {
  currentUser: CurrentUser;
}

function actionColorClass(action: string): string {
  if (action === "create") {
    return "text-[var(--color-success)]";
  }
  if (action === "update") {
    return "text-[var(--color-accent)]";
  }
  if (action === "delete") {
    return "text-[var(--color-danger)]";
  }
  return "text-[var(--color-text-tertiary)]";
}

function ActivityLogEmpty({
  hasFilters,
}: Readonly<{ hasFilters: boolean }>): ReactNode {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-surface-raised)] px-4 py-6 text-center">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
        No activity yet
      </p>
      <p className="mt-1 max-w-md text-xs text-[var(--color-text-secondary)]">
        {hasFilters
          ? "Try clearing action or entity filters to see more entries."
          : "Changes you make across the app will show up here."}
      </p>
    </div>
  );
}

export function ActivityLogSection({
  currentUser,
}: Readonly<ActivityLogSectionProps>) {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");

  const isPrivileged =
    currentUser.role === "admin" || currentUser.role === "superadmin";

  const logQuery = useQuery({
    queryKey: [
      "activityLog",
      page,
      filterAction,
      filterEntity,
      currentUser.id,
      currentUser.role,
    ],
    queryFn: () =>
      window.electron.activityLog.getPage({
        page,
        limit: PAGE_SIZE,
        action: filterAction || null,
        entityType: filterEntity || null,
        currentUserId: currentUser.id,
        currentUserRole: currentUser.role,
      }),
  });

  const rows = logQuery.data?.data ?? [];
  const total = logQuery.data?.total ?? 0;

  const columns = useMemo(
    () => [
      {
        key: "action",
        label: "Action",
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span
            className={`text-xs font-semibold uppercase ${actionColorClass(row.action)}`}
          >
            {row.action}
          </span>
        ),
      },
      {
        key: "entity_label",
        label: "Entity",
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {row.entity_label ?? `#${row.entity_id ?? "—"}`}
          </span>
        ),
      },
      {
        key: "entity_type",
        label: "Type",
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-xs capitalize text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface-raised)] px-1.5 py-0.5 rounded">
            {row.entity_type}
          </span>
        ),
      },
      {
        key: "user_name",
        label: "User",
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-sm text-[var(--color-text-primary)]">
            {row.user_name ?? "System"}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "When",
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
            {new Date(row.created_at).toLocaleString()}
          </span>
        ),
      },
    ],
    []
  );

  const hasFilters = Boolean(filterAction || filterEntity);
  const isEmpty = logQuery.isSuccess && total === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {isPrivileged ? "Activity log" : "Your activity"} —{" "}
          <span className="tabular-nums text-[var(--color-text-tertiary)]">
            {logQuery.isSuccess ? total : "—"} entries
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
            className="input-base text-sm min-w-[8rem]"
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
          <select
            value={filterEntity}
            onChange={(e) => {
              setFilterEntity(e.target.value);
              setPage(1);
            }}
            className="input-base text-sm min-w-[8rem]"
            aria-label="Filter by entity"
          >
            <option value="">All entities</option>
            <option value="item">Item</option>
            <option value="invoice">Invoice</option>
            <option value="lender">Lender</option>
            <option value="daily_sale">Daily Sale</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      <AsyncDataPanel
        isLoading={logQuery.isPending}
        isError={logQuery.isError}
        onRetry={() => {
          void logQuery.refetch();
        }}
        isEmpty={isEmpty}
        empty={<ActivityLogEmpty hasFilters={hasFilters} />}
        loaderColumns={5}
        loaderRows={8}
      >
        <DataTable<ActivityLogEntry>
          scrollHeightPreset="compact"
          columns={columns}
          data={rows}
          emptyMessage="No rows on this page."
          pagination={{
            type: "controlled",
            page,
            total,
            onPageChange: (p) => {
              setPage(p);
            },
            pageSize: PAGE_SIZE,
          }}
        />
      </AsyncDataPanel>
    </div>
  );
}
