import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("settings");
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-surface-raised)] px-4 py-6 text-center">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
        {t("activityLog.emptyTitle")}
      </p>
      <p className="mt-1 max-w-md text-xs text-[var(--color-text-secondary)]">
        {hasFilters
          ? t("activityLog.emptyFiltered")
          : t("activityLog.emptyDefault")}
      </p>
    </div>
  );
}

export function ActivityLogSection({
  currentUser,
}: Readonly<ActivityLogSectionProps>) {
  const { t } = useTranslation("settings");
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
        label: t("activityLog.columns.action"),
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
        label: t("activityLog.columns.entity"),
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {row.entity_label ?? `#${row.entity_id ?? "—"}`}
          </span>
        ),
      },
      {
        key: "entity_type",
        label: t("activityLog.columns.type"),
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-xs capitalize text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface-raised)] px-1.5 py-0.5 rounded">
            {row.entity_type}
          </span>
        ),
      },
      {
        key: "user_name",
        label: t("activityLog.columns.user"),
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-sm text-[var(--color-text-primary)]">
            {row.user_name ?? t("activityLog.systemUser")}
          </span>
        ),
      },
      {
        key: "created_at",
        label: t("activityLog.columns.when"),
        sortable: true,
        render: (row: ActivityLogEntry) => (
          <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
            {new Date(row.created_at).toLocaleString()}
          </span>
        ),
      },
    ],
    [t]
  );

  const hasFilters = Boolean(filterAction || filterEntity);
  const isEmpty = logQuery.isSuccess && total === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {isPrivileged
            ? t("activityLog.headingPrivileged")
            : t("activityLog.headingSelf")}{" "}
          —{" "}
          <span className="tabular-nums text-[var(--color-text-tertiary)]">
            {logQuery.isSuccess ? total : "—"} {t("activityLog.entries")}
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
            aria-label={t("activityLog.filterAction")}
          >
            <option value="">{t("activityLog.allActions")}</option>
            <option value="create">{t("activityLog.actionCreate")}</option>
            <option value="update">{t("activityLog.actionUpdate")}</option>
            <option value="delete">{t("activityLog.actionDelete")}</option>
          </select>
          <select
            value={filterEntity}
            onChange={(e) => {
              setFilterEntity(e.target.value);
              setPage(1);
            }}
            className="input-base text-sm min-w-[8rem]"
            aria-label={t("activityLog.filterEntity")}
          >
            <option value="">{t("activityLog.allEntities")}</option>
            <option value="item">{t("activityLog.entityItem")}</option>
            <option value="invoice">{t("activityLog.entityInvoice")}</option>
            <option value="lender">{t("activityLog.entityLender")}</option>
            <option value="daily_sale">
              {t("activityLog.entityDailySale")}
            </option>
            <option value="user">{t("activityLog.entityUser")}</option>
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
          emptyMessage={t("activityLog.noRowsPage")}
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
