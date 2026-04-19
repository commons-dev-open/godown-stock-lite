import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  AlertTriangle,
  Pencil,
  Plus,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Lock,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import FormField from "../components/FormField";
import Button from "../components/Button";
import ConfirmDangerModal from "../components/ConfirmDangerModal";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import { useTheme, BRAND_COLOR_OPTIONS } from "../context/ThemeContext";
import {
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
  type NumberAbbreviationStyle,
  WEEK_STARTS_ON_KEY,
  parseWeekStartsOn,
  type WeekStartsOn,
} from "../../shared/numbers";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import { AsyncDataPanel } from "../components/async-data-panel";
import DataTable from "../components/DataTable";
import {
  ActivityLogSection,
  SettingsHero,
  SettingsSectionPanel,
  SettingsSegmentedTabs,
  type SettingsTabId,
} from "../components/settings-page";
import AppleToggle from "../components/AppleToggle";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import LanguageSwitcher from "../i18n/LanguageSwitcher";

type DangerAction =
  | "export"
  | "import"
  | "clearTables"
  | "clearEntireDb"
  | "populateSampleData"
  | null;

const DANGER_I18N: Record<
  Exclude<DangerAction, null>,
  { titleKey: string; messageKey: string }
> = {
  export: { titleKey: "data.exportTitle", messageKey: "data.exportMessage" },
  import: { titleKey: "data.importTitle", messageKey: "data.importMessage" },
  clearTables: {
    titleKey: "data.clearTablesTitle",
    messageKey: "data.clearTablesMessage",
  },
  clearEntireDb: {
    titleKey: "data.clearEntireDbTitle",
    messageKey: "data.clearEntireDbMessage",
  },
  populateSampleData: {
    titleKey: "data.populateSampleTitle",
    messageKey: "data.populateSampleMessage",
  },
};

const BUSINESS_FIELD_KEYS = [
  "company_name",
  "company_address",
  "gstin",
  "owner_name",
  "owner_phone",
] as const;

const DISCOUNT_TOGGLE_KEYS = [
  "discount_percentage_enabled",
  "discount_flat_enabled",
  "discount_bogo_enabled",
  "discount_coupon_enabled",
  "discount_tiered_enabled",
  "round_bill_to_whole",
] as const;

const GST_RATES = ["0", "5", "12", "18", "28"] as const;
const GST_MODE_VALUES = ["exclusive", "inclusive"] as const;

const DISPLAY_NAME_MAX = 25;

const NUMBER_ABBREVIATION_STYLES: NumberAbbreviationStyle[] = [
  "indian",
  "us",
  "si",
];

type CouponRow = {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  valid_from: string | null;
  valid_to: string | null;
  usage_limit: number | null;
  used_count: number;
};

type TieredRow = {
  id: number;
  min_order_amount: number;
  discount_percent: number;
  discount_flat: number;
  max_discount_amount: number | null;
  sort_order: number;
};

/* ── Theme Mode Selector ──────────────────────────────────── */

function AppearanceTab() {
  const { mode, brandColor, setMode, setBrandColor } = useTheme();
  const { t: settingsT } = useTranslation("settings");
  const { t: commonT } = useTranslation("common");

  const themeModes = useMemo(
    () =>
      (
        [
          { value: "light" as const, icon: Sun },
          { value: "dark" as const, icon: Moon },
          { value: "system" as const, icon: Monitor },
        ] as const
      ).map((row) => ({
        ...row,
        label: settingsT(`preferences.themeModes.${row.value}`),
      })),
    [settingsT]
  );

  const numberAbbreviationOptions = useMemo(
    () =>
      NUMBER_ABBREVIATION_STYLES.map((value) => ({
        value,
        label: settingsT(`preferences.abbreviation.${value}`),
        hint: settingsT(`preferences.abbreviationHints.${value}`),
      })),
    [settingsT]
  );
  const queryClient = useQueryClient();
  const api = getElectron();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const [displayName, setDisplayName] = useState("");
  const [numberAbbreviation, setNumberAbbreviation] =
    useState<NumberAbbreviationStyle>("indian");
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartsOn>("monday");

  useEffect(() => {
    setDisplayName(settings.displayName ?? "");
  }, [settings]);

  useEffect(() => {
    setNumberAbbreviation(
      parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY])
    );
  }, [settings]);

  useEffect(() => {
    setWeekStartsOn(parseWeekStartsOn(settings[WEEK_STARTS_ON_KEY]));
  }, [settings]);

  const setSettingsMutation = useMutationWithToast({
    mutationFn: (obj: Record<string, string>) => api.setSettings(obj),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const saveDisplayName = () => {
    setSettingsMutation.mutate({
      displayName: displayName.trim().slice(0, DISPLAY_NAME_MAX),
    });
  };

  const handleNumberAbbreviationChange = (value: string) => {
    const nextStyle = parseNumberAbbreviationStyle(value);
    setNumberAbbreviation(nextStyle);
    if (nextStyle === numberAbbreviation) {
      return;
    }
    setSettingsMutation.mutate({
      [NUMBER_ABBREVIATION_STYLE_KEY]: nextStyle,
    });
  };

  const handleWeekStartsOnChange = (value: WeekStartsOn) => {
    if (value === weekStartsOn) {
      return;
    }
    setWeekStartsOn(value);
    setSettingsMutation.mutate({
      [WEEK_STARTS_ON_KEY]: value,
    });
  };

  const weekStartOptions = useMemo(
    () =>
      (
        [
          { value: "monday" as const },
          { value: "sunday" as const },
        ] as const
      ).map((row) => ({
        ...row,
        label: settingsT(`preferences.weekStartsOnOptions.${row.value}`),
      })),
    [settingsT]
  );

  return (
    <div className="space-y-8">
      {/* App Display Name */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {settingsT("preferences.appDisplayName")}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          {settingsT("preferences.appDisplayNameHint", {
            max: DISPLAY_NAME_MAX,
          })}
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={DISPLAY_NAME_MAX}
              className="input-base w-full"
              placeholder={commonT("app.name")}
            />
          </div>
          <Button
            onClick={saveDisplayName}
            disabled={setSettingsMutation.isPending}
          >
            <Check size={16} className="mr-1" aria-hidden="true" />
            {commonT("actions.save")}
          </Button>
        </div>
      </section>
      {/* Language */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {settingsT("preferences.language")}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          {settingsT("preferences.languageHint")}
        </p>
        <LanguageSwitcher variant="full" />
      </section>

      {/* Week starts on */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {settingsT("preferences.weekStartsOn")}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          {settingsT("preferences.weekStartsOnHint")}
        </p>
        <div className="flex gap-3">
          {weekStartOptions.map(({ value, label }) => {
            const active = weekStartsOn === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleWeekStartsOnChange(value)}
                disabled={setSettingsMutation.isPending}
                className={`flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 transition-colors ${
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Theme Mode */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {settingsT("preferences.theme")}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          {settingsT("preferences.themeHint")}
        </p>
        <div className="flex gap-3">
          {themeModes.map(({ value, label, icon: Icon }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 transition-all ${
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <Icon
                  size={24}
                  className={
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-tertiary)]"
                  }
                />
                <span
                  className={`text-sm font-medium ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Brand Color */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {settingsT("preferences.brandColor")}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          {settingsT("preferences.brandColorHint")}
        </p>
        <div className="flex flex-wrap gap-3">
          {BRAND_COLOR_OPTIONS.map(({ value, hex }) => {
            const active = brandColor === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setBrandColor(value)}
                className="flex flex-col items-center gap-1.5 group"
                title={settingsT(`preferences.brandColors.${value}`)}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    active
                      ? "ring-2 ring-offset-2 ring-[var(--color-accent)]"
                      : "hover:scale-110"
                  }`}
                  style={
                    {
                      backgroundColor: hex,
                      ringOffsetColor: "var(--color-bg-surface)",
                    } as React.CSSProperties
                  }
                >
                  {active && <Check size={18} className="text-white" />}
                </div>
                <span
                  className={`text-xs ${
                    active
                      ? "text-[var(--color-text-primary)] font-medium"
                      : "text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {settingsT(`preferences.brandColors.${value}`)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Number abbreviations (dashboard heroes) */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {settingsT("preferences.numberAbbreviation")}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          {settingsT("preferences.numberAbbreviationHint")}
        </p>
        <FormField label={settingsT("preferences.numberAbbreviationStyle")}>
          <select
            value={numberAbbreviation}
            onChange={(e) => handleNumberAbbreviationChange(e.target.value)}
            className="input-base w-full"
            disabled={setSettingsMutation.isPending}
          >
            {numberAbbreviationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
          {
            numberAbbreviationOptions.find(
              (o) => o.value === numberAbbreviation
            )?.hint
          }
        </p>
      </section>
    </div>
  );
}

/* ── Coupons & Tiered Section ─────────────────────────────── */
function CouponsAndTieredSection({
  api,
}: {
  api: ReturnType<typeof getElectron>;
}) {
  const { t: settingsT } = useTranslation("settings");
  const { t: commonT } = useTranslation("common");
  const queryClient = useQueryClient();
  const { data: coupons = [] } = useQuery({
    queryKey: ["coupons"],
    queryFn: () => api.getCoupons() as Promise<CouponRow[]>,
  });
  const { data: tieredRules = [] } = useQuery({
    queryKey: ["tieredDiscountRules"],
    queryFn: () => api.getTieredDiscountRules() as Promise<TieredRow[]>,
  });
  const [couponModal, setCouponModal] = useState<
    { mode: "add" } | { mode: "edit"; id: number } | null
  >(null);
  const [tieredModal, setTieredModal] = useState<
    { mode: "add" } | { mode: "edit"; id: number } | null
  >(null);
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_type: "percent" as "percent" | "flat",
    discount_value: 0,
    min_order_amount: "" as number | "",
    valid_from: "",
    valid_to: "",
    usage_limit: "" as number | "",
  });
  const [tieredForm, setTieredForm] = useState({
    min_order_amount: 0,
    discount_type: "percent" as "percent" | "flat",
    discount_percent: 0,
    discount_flat: 0,
    max_discount_amount: "" as number | "",
  });
  const [deleteCouponId, setDeleteCouponId] = useState<number | null>(null);
  const [deleteTieredId, setDeleteTieredId] = useState<number | null>(null);

  const createCouponMut = useMutationWithToast({
    mutationFn: (p: typeof couponForm) =>
      api.createCoupon({
        code: p.code.trim().toUpperCase(),
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        min_order_amount:
          p.min_order_amount === "" ? null : Number(p.min_order_amount),
        valid_from: p.valid_from.trim() || null,
        valid_to: p.valid_to.trim() || null,
        usage_limit: p.usage_limit === "" ? null : Number(p.usage_limit),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setCouponModal(null);
    },
  });
  const updateCouponMut = useMutationWithToast({
    mutationFn: ({ id, p }: { id: number; p: Partial<typeof couponForm> }) =>
      api.updateCoupon(id, {
        code: p.code?.trim().toUpperCase(),
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        min_order_amount:
          p.min_order_amount === "" ? null : Number(p.min_order_amount),
        valid_from: p.valid_from?.trim() || null,
        valid_to: p.valid_to?.trim() || null,
        usage_limit: p.usage_limit === "" ? null : Number(p.usage_limit),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setCouponModal(null);
    },
  });
  const deleteCouponMut = useMutationWithToast({
    mutationFn: (id: number) => api.deleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setDeleteCouponId(null);
    },
  });
  const upsertTieredMut = useMutationWithToast({
    mutationFn: (p: {
      id?: number;
      min_order_amount: number;
      discount_type: "percent" | "flat";
      discount_percent: number;
      discount_flat: number;
      max_discount_amount: number | "";
    }) =>
      api.upsertTieredDiscountRule({
        id: p.id,
        min_order_amount: p.min_order_amount,
        discount_percent:
          p.discount_type === "percent" ? p.discount_percent : 0,
        discount_flat: p.discount_type === "flat" ? p.discount_flat : 0,
        max_discount_amount:
          p.max_discount_amount === "" ? null : p.max_discount_amount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tieredDiscountRules"] });
      setTieredModal(null);
    },
  });
  const deleteTieredMut = useMutationWithToast({
    mutationFn: (id: number) => api.deleteTieredDiscountRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tieredDiscountRules"] });
      setDeleteTieredId(null);
    },
  });

  const openCouponEdit = (c: CouponRow) => {
    setCouponForm({
      code: c.code,
      discount_type: c.discount_type as "percent" | "flat",
      discount_value: c.discount_value,
      min_order_amount: c.min_order_amount ?? "",
      valid_from: c.valid_from ?? "",
      valid_to: c.valid_to ?? "",
      usage_limit: c.usage_limit ?? "",
    });
    setCouponModal({ mode: "edit", id: c.id });
  };
  const openTieredEdit = (t: TieredRow) => {
    const hasFlat = (t.discount_flat ?? 0) > 0;
    setTieredForm({
      min_order_amount: t.min_order_amount,
      discount_type: hasFlat ? "flat" : "percent",
      discount_percent: t.discount_percent ?? 0,
      discount_flat: t.discount_flat ?? 0,
      max_discount_amount: t.max_discount_amount ?? "",
    });
    setTieredModal({ mode: "edit", id: t.id });
  };

  const couponColumns = useMemo(
    () => [
      {
        key: "code",
        label: settingsT("discounts.coupons.columns.code"),
        render: (c: CouponRow) => <span className="font-mono">{c.code}</span>,
      },
      {
        key: "discount_type",
        label: settingsT("discounts.coupons.columns.type"),
      },
      {
        key: "discount_value",
        label: settingsT("discounts.coupons.columns.value"),
        align: "right" as const,
        render: (c: CouponRow) =>
          c.discount_type === "percent"
            ? `${c.discount_value}%`
            : `₹${c.discount_value}`,
      },
      {
        key: "min_order_amount",
        label: settingsT("discounts.coupons.columns.minOrder"),
        align: "right" as const,
        render: (c: CouponRow) => (
          <span className="text-[var(--color-text-secondary)]">
            {c.min_order_amount != null ? `₹${c.min_order_amount}` : "—"}
          </span>
        ),
      },
      {
        key: "used_count",
        label: settingsT("discounts.coupons.columns.used"),
        align: "right" as const,
        render: (c: CouponRow) => (
          <span className="text-[var(--color-text-secondary)]">
            {c.usage_limit != null
              ? `${c.used_count}/${c.usage_limit}`
              : c.used_count}
          </span>
        ),
      },
    ],
    [settingsT]
  );

  const tieredColumns = useMemo(
    () => [
      {
        key: "min_order_amount",
        label: settingsT("discounts.tiered.columns.minOrder"),
        align: "right" as const,
        render: (row: TieredRow) => `₹${row.min_order_amount}`,
      },
      {
        key: "discount_display",
        label: settingsT("discounts.tiered.columns.discount"),
        align: "right" as const,
        render: (row: TieredRow) => {
          const hasFlat = (row.discount_flat ?? 0) > 0;
          return hasFlat
            ? `₹${row.discount_flat}`
            : (row.discount_percent ?? 0) > 0
              ? `${row.discount_percent}%`
              : "—";
        },
      },
      {
        key: "max_discount_amount",
        label: settingsT("discounts.tiered.columns.max"),
        align: "right" as const,
        render: (row: TieredRow) => (
          <span className="text-[var(--color-text-secondary)]">
            {row.max_discount_amount != null
              ? `₹${row.max_discount_amount}`
              : "—"}
          </span>
        ),
      },
    ],
    [settingsT]
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            {settingsT("discounts.coupons.title")}
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setCouponForm({
                code: "",
                discount_type: "percent",
                discount_value: 0,
                min_order_amount: "",
                valid_from: "",
                valid_to: "",
                usage_limit: "",
              });
              setCouponModal({ mode: "add" });
            }}
          >
            <Plus size={14} className="mr-1" aria-hidden="true" />
            {settingsT("discounts.coupons.add")}
          </Button>
        </div>
        <DataTable<CouponRow>
          columns={couponColumns}
          data={coupons}
          emptyMessage={settingsT("discounts.coupons.empty")}
          pagination={{ type: "client" }}
          alwaysShowRowActions
          scrollMaxHeight={`500px`}
          extraActions={(c) => (
            <>
              <button
                type="button"
                onClick={() => openCouponEdit(c)}
                className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label={commonT("actions.edit")}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteCouponId(c.id)}
                className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label={commonT("actions.delete")}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            {settingsT("discounts.tiered.title")}
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setTieredForm({
                min_order_amount: 0,
                discount_type: "percent",
                discount_percent: 0,
                discount_flat: 0,
                max_discount_amount: "",
              });
              setTieredModal({ mode: "add" });
            }}
          >
            <Plus size={14} className="mr-1" aria-hidden="true" />
            {settingsT("discounts.tiered.add")}
          </Button>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-2">
          {settingsT("discounts.coupons.tieredHint")}
        </p>
        <DataTable<TieredRow>
          columns={tieredColumns}
          data={tieredRules}
          emptyMessage={settingsT("discounts.tiered.empty")}
          pagination={{ type: "client" }}
          alwaysShowRowActions
          scrollMaxHeight={`500px`}
          extraActions={(t) => (
            <>
              <button
                type="button"
                onClick={() => openTieredEdit(t)}
                className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label={commonT("actions.edit")}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTieredId(t.id)}
                className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label={commonT("actions.delete")}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        />
      </div>

      {couponModal && (
        <FormModal
          title={
            couponModal.mode === "add"
              ? settingsT("discounts.coupons.modalAdd")
              : settingsT("discounts.coupons.modalEdit")
          }
          open
          onClose={() => setCouponModal(null)}
          footer={
            <Button
              onClick={() => {
                if (couponModal.mode === "add") {
                  createCouponMut.mutate(couponForm);
                } else {
                  updateCouponMut.mutate({
                    id: couponModal.id,
                    p: couponForm,
                  });
                }
              }}
              disabled={
                !couponForm.code.trim() ||
                couponForm.discount_value < 0 ||
                createCouponMut.isPending ||
                updateCouponMut.isPending
              }
            >
              <Check size={16} className="mr-1" aria-hidden="true" />
              {couponModal.mode === "add"
                ? commonT("actions.create")
                : commonT("actions.save")}
            </Button>
          }
        >
          <div className="space-y-3">
            <FormField label={commonT("labels.code")}>
              <input
                value={couponForm.code}
                onChange={(e) =>
                  setCouponForm((prev) => ({
                    ...prev,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                className="input-base w-full"
                placeholder="SAVE10"
                disabled={couponModal.mode === "edit"}
              />
            </FormField>
            <FormField label={commonT("labels.type")}>
              <select
                value={couponForm.discount_type}
                onChange={(e) =>
                  setCouponForm((prev) => ({
                    ...prev,
                    discount_type: e.target.value as "percent" | "flat",
                  }))
                }
                className="input-base w-full"
              >
                <option value="percent">
                  {settingsT("discounts.coupons.typePercent")}
                </option>
                <option value="flat">
                  {settingsT("discounts.coupons.typeFlat")}
                </option>
              </select>
            </FormField>
            <FormField
              label={
                couponForm.discount_type === "percent"
                  ? settingsT("discounts.coupons.discountPercent")
                  : settingsT("discounts.coupons.discountAmount")
              }
            >
              <input
                type="number"
                min={0}
                step={couponForm.discount_type === "percent" ? 0.5 : 0.01}
                value={couponForm.discount_value || ""}
                onChange={(e) =>
                  setCouponForm((prev) => ({
                    ...prev,
                    discount_value: Number(e.target.value) || 0,
                  }))
                }
                className="input-base w-full"
              />
            </FormField>
            <FormField label={settingsT("discounts.coupons.minOrder")}>
              <input
                type="number"
                min={0}
                step={0.01}
                value={couponForm.min_order_amount}
                onChange={(e) =>
                  setCouponForm((prev) => ({
                    ...prev,
                    min_order_amount:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
                className="input-base w-full"
                placeholder={settingsT("placeholders.optional")}
              />
            </FormField>
            <FormField label={settingsT("discounts.coupons.validFrom")}>
              <input
                type="date"
                value={couponForm.valid_from}
                onChange={(e) =>
                  setCouponForm((prev) => ({
                    ...prev,
                    valid_from: e.target.value,
                  }))
                }
                className="input-base w-full"
                placeholder={settingsT("placeholders.optional")}
              />
            </FormField>
            <FormField label={settingsT("discounts.coupons.validTo")}>
              <input
                type="date"
                value={couponForm.valid_to}
                onChange={(e) =>
                  setCouponForm((prev) => ({
                    ...prev,
                    valid_to: e.target.value,
                  }))
                }
                className="input-base w-full"
                placeholder={settingsT("placeholders.optional")}
              />
            </FormField>
            <FormField label={settingsT("discounts.coupons.usageLimit")}>
              <input
                type="number"
                min={0}
                value={couponForm.usage_limit}
                onChange={(e) =>
                  setCouponForm((prev) => ({
                    ...prev,
                    usage_limit:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
                className="input-base w-full"
                placeholder={settingsT("placeholders.optional")}
              />
            </FormField>
          </div>
        </FormModal>
      )}

      {tieredModal && (
        <FormModal
          title={
            tieredModal.mode === "add"
              ? settingsT("discounts.tiered.modalAdd")
              : settingsT("discounts.tiered.modalEdit")
          }
          open
          onClose={() => setTieredModal(null)}
          footer={
            <Button
              onClick={() => {
                upsertTieredMut.mutate({
                  id: tieredModal.mode === "edit" ? tieredModal.id : undefined,
                  min_order_amount: tieredForm.min_order_amount,
                  discount_type: tieredForm.discount_type,
                  discount_percent: tieredForm.discount_percent,
                  discount_flat: tieredForm.discount_flat,
                  max_discount_amount: tieredForm.max_discount_amount,
                });
              }}
              disabled={
                tieredForm.min_order_amount < 0 ||
                (tieredForm.discount_type === "percent"
                  ? tieredForm.discount_percent <= 0
                  : tieredForm.discount_flat <= 0) ||
                upsertTieredMut.isPending
              }
            >
              <Check size={16} className="mr-1" aria-hidden="true" />
              {tieredModal.mode === "add"
                ? commonT("actions.create")
                : commonT("actions.save")}
            </Button>
          }
        >
          <div className="space-y-3">
            <FormField label={settingsT("discounts.tiered.minOrderAmount")}>
              <input
                type="number"
                min={0}
                step={0.01}
                value={tieredForm.min_order_amount || ""}
                onChange={(e) =>
                  setTieredForm((prev) => ({
                    ...prev,
                    min_order_amount: Number(e.target.value) || 0,
                  }))
                }
                className="input-base w-full"
              />
            </FormField>
            <FormField label={settingsT("discounts.tiered.discountType")}>
              <select
                value={tieredForm.discount_type}
                onChange={(e) =>
                  setTieredForm((prev) => ({
                    ...prev,
                    discount_type: e.target.value as "percent" | "flat",
                  }))
                }
                className="input-base w-full"
              >
                <option value="percent">
                  {settingsT("discounts.tiered.typePercent")}
                </option>
                <option value="flat">
                  {settingsT("discounts.tiered.typeFlat")}
                </option>
              </select>
            </FormField>
            {tieredForm.discount_type === "percent" ? (
              <FormField label={settingsT("discounts.tiered.discountPercent")}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={tieredForm.discount_percent || ""}
                  onChange={(e) =>
                    setTieredForm((prev) => ({
                      ...prev,
                      discount_percent: Number(e.target.value) || 0,
                    }))
                  }
                  className="input-base w-full"
                  placeholder="0"
                />
              </FormField>
            ) : (
              <FormField label={settingsT("discounts.tiered.flatAmount")}>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={tieredForm.discount_flat || ""}
                  onChange={(e) =>
                    setTieredForm((prev) => ({
                      ...prev,
                      discount_flat: Number(e.target.value) || 0,
                    }))
                  }
                  className="input-base w-full"
                  placeholder="0"
                />
              </FormField>
            )}
            <FormField
              label={settingsT("discounts.tiered.maxDiscount")}
              extra={
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {settingsT("discounts.tiered.maxDiscountExtra")}
                </span>
              }
            >
              <input
                type="number"
                min={0}
                step={0.01}
                value={tieredForm.max_discount_amount}
                onChange={(e) =>
                  setTieredForm((prev) => ({
                    ...prev,
                    max_discount_amount:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
                className="input-base w-full"
                placeholder={settingsT("discounts.tiered.maxDiscountPlaceholder")}
              />
            </FormField>
          </div>
        </FormModal>
      )}

      {deleteCouponId !== null && (
        <ConfirmModal
          open
          onClose={() => setDeleteCouponId(null)}
          title={settingsT("discounts.coupons.deleteTitle")}
          message={settingsT("discounts.coupons.deleteMessage")}
          confirmLabel={commonT("actions.delete")}
          confirmVariant="danger"
          onConfirm={() => deleteCouponMut.mutate(deleteCouponId)}
        />
      )}

      {deleteTieredId !== null && (
        <ConfirmModal
          open
          onClose={() => setDeleteTieredId(null)}
          title={settingsT("discounts.tiered.deleteTitle")}
          message={settingsT("discounts.tiered.deleteMessage")}
          confirmLabel={commonT("actions.delete")}
          confirmVariant="danger"
          onConfirm={() => deleteTieredMut.mutate(deleteTieredId)}
        />
      )}
    </div>
  );
}

/* ── Main Settings Page ───────────────────────────────────── */
export default function Settings() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const { t: settingsT } = useTranslation("settings");
  const { t: commonT } = useTranslation("common");
  const [form, setForm] = useState<Record<string, string>>({});
  const [dangerAction, setDangerAction] = useState<DangerAction>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const { data: settings = {}, isPending, isError, refetch } = settingsQuery;

  const dbPathQuery = useQuery({
    queryKey: ["dbPath"],
    queryFn: () => api.getDbPath(),
  });
  const dbPath = dbPathQuery.data;

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const key of BUSINESS_FIELD_KEYS) {
      initial[key] = settings[key] ?? "";
    }
    initial.gst_enabled = settings.gst_enabled ?? "false";
    initial.gst_default_rate = settings.gst_default_rate ?? "0";
    initial.gst_default_mode = settings.gst_default_mode ?? "exclusive";
    initial.place_of_supply = settings.place_of_supply ?? "";
    initial.customer_gstin_enabled = settings.customer_gstin_enabled ?? "false";
    initial.hsn_enabled = settings.hsn_enabled ?? "true";
    initial.discount_percentage_enabled =
      settings.discount_percentage_enabled ?? "false";
    initial.discount_flat_enabled = settings.discount_flat_enabled ?? "false";
    initial.discount_bogo_enabled = settings.discount_bogo_enabled ?? "false";
    initial.discount_coupon_enabled =
      settings.discount_coupon_enabled ?? "false";
    initial.discount_tiered_enabled =
      settings.discount_tiered_enabled ?? "false";
    initial.round_bill_to_whole = settings.round_bill_to_whole ?? "false";
    setForm(initial); // eslint-disable-line react-hooks/set-state-in-effect -- sync server settings to form when loaded
  }, [settings]);

  const setSettingsMutation = useMutationWithToast({
    mutationFn: (obj: Record<string, string>) => api.setSettings(obj),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMutation.mutate({ ...form });
  };

  const updateAndSaveGstField = (key: string, value: string) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [key]: value,
      };
      const payload: Record<string, string> = {
        gst_enabled: next.gst_enabled ?? "false",
        gst_default_rate: next.gst_default_rate ?? "0",
        gst_default_mode: next.gst_default_mode ?? "exclusive",
        place_of_supply: (next.place_of_supply ?? "").trim(),
        customer_gstin_enabled: next.customer_gstin_enabled ?? "false",
        hsn_enabled: next.hsn_enabled ?? "true",
      };
      setSettingsMutation.mutate(payload);
      return next;
    });
  };

  const updateAndSaveDiscountField = (key: string, value: string) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [key]: value,
      };
      const payload: Record<string, string> = {
        discount_percentage_enabled:
          next.discount_percentage_enabled ?? "false",
        discount_flat_enabled: next.discount_flat_enabled ?? "false",
        discount_bogo_enabled: next.discount_bogo_enabled ?? "false",
        discount_coupon_enabled: next.discount_coupon_enabled ?? "false",
        discount_tiered_enabled: next.discount_tiered_enabled ?? "false",
        round_bill_to_whole: next.round_bill_to_whole ?? "false",
      };
      setSettingsMutation.mutate(payload);
      return next;
    });
  };

  const gstEnabled = form.gst_enabled === "true";

  const clearTablesMutation = useMutationWithToast({
    mutationFn: () => api.clearDbTables(),
    onSuccess: () => {
      setDangerAction(null);
      queryClient.invalidateQueries();
      toast.success(i18n.t("settings:toast.clearTablesSuccess"));
    },
  });

  const clearEntireDbMutation = useMutationWithToast({
    mutationFn: () => api.clearEntireDb(),
    onSuccess: () => {
      setDangerAction(null);
      queryClient.invalidateQueries();
      toast.success(i18n.t("settings:toast.resetDbSuccess"));
    },
  });

  const populateSampleDataMutation = useMutationWithToast({
    mutationFn: () => api.populateSampleData(),
    onSuccess: () => {
      setDangerAction(null);
      queryClient.invalidateQueries();
      toast.success(i18n.t("settings:toast.sampleDataSuccess"));
    },
  });

  const runDangerAction = () => {
    if (dangerAction === null) return;
    const action = dangerAction;
    setDangerAction(null);
    switch (action) {
      case "export":
        api.exportDb().then((result) => {
          if (result.canceled) return;
          toast.success(
            i18n.t("settings:toast.exportedTo", { path: result.path })
          );
        });
        break;
      case "import":
        api.importDb().then((result) => {
          if (result.canceled) return;
          queryClient.invalidateQueries();
          toast.success(i18n.t("settings:toast.importReplaced"));
        });
        break;
      case "clearTables":
        clearTablesMutation.mutate();
        break;
      case "clearEntireDb":
        clearEntireDbMutation.mutate();
        break;
      case "populateSampleData":
        populateSampleDataMutation.mutate();
        break;
    }
  };

  const isConfirming =
    (dangerAction === "clearTables" && clearTablesMutation.isPending) ||
    (dangerAction === "clearEntireDb" && clearEntireDbMutation.isPending) ||
    (dangerAction === "populateSampleData" &&
      populateSampleDataMutation.isPending);

  const { authState, lock } = useAuth();
  const currentUser = authState.status === "unlocked" ? authState.user : null;

  const [activeTab, setActiveTab] = useState<SettingsTabId>("business");
  const sectionMeta = useMemo(
    () => ({
      title: settingsT(`sections.${activeTab}.title`),
      description: settingsT(`sections.${activeTab}.description`),
    }),
    [activeTab, settingsT]
  );
  const companyHeroName = (
    form.company_name ??
    settings.company_name ??
    ""
  ).trim();

  return (
    <div className="space-y-4 home-dashboard pb-3 max-w-5xl mx-auto w-full">
      <SettingsHero
        companyName={companyHeroName.length > 0 ? companyHeroName : "—"}
        gstEnabled={gstEnabled}
      />
      <SettingsSegmentedTabs active={activeTab} onChange={setActiveTab} />

      <DashboardSectionBoundary
        sectionTitle={sectionMeta.title}
        containerClassName="dashboard-panel"
        resetKeys={[
          activeTab,
          isPending,
          isError,
          dbPathQuery.isPending,
          dbPathQuery.isError,
        ]}
      >
        <SettingsSectionPanel
          title={sectionMeta.title}
          description={sectionMeta.description}
        >
          {["business", "tax", "discounts"].includes(activeTab) ? (
            <AsyncDataPanel
              isLoading={isPending}
              isError={isError}
              onRetry={() => {
                void refetch();
              }}
              isEmpty={false}
              empty={<span className="sr-only">empty</span>}
              loaderColumns={1}
              loaderRows={6}
            >
              {activeTab === "business" ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    {BUSINESS_FIELD_KEYS.map((key) => {
                      const label = settingsT(`business.fields.${key}`);
                      return (
                        <FormField key={key} label={label}>
                          <input
                            value={form[key] ?? ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="input-base w-full"
                            placeholder={label}
                          />
                        </FormField>
                      );
                    })}
                  </div>
                  <div className="mt-4">
                    <Button
                      type="submit"
                      disabled={setSettingsMutation.isPending}
                    >
                      <Check size={16} className="mr-1" aria-hidden="true" />
                      {commonT("actions.save")}
                    </Button>
                  </div>
                </form>
              ) : activeTab === "tax" ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <AppleToggle
                      checked={gstEnabled}
                      onChange={(isChecked) => {
                        updateAndSaveGstField(
                          "gst_enabled",
                          isChecked ? "true" : "false"
                        );
                      }}
                      aria-label={settingsT("tax.enableGstAria")}
                    />
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                      {settingsT("tax.enableGst")}
                    </span>
                  </label>
                  <div
                    className={`space-y-4 ${!gstEnabled ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <FormField label={settingsT("tax.defaultGstRate")}>
                      <select
                        value={form.gst_default_rate ?? "0"}
                        onChange={(e) => {
                          updateAndSaveGstField(
                            "gst_default_rate",
                            e.target.value
                          );
                        }}
                        className="input-base w-full"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={settingsT("tax.defaultPriceMode")}>
                      <select
                        value={form.gst_default_mode ?? "exclusive"}
                        onChange={(e) => {
                          updateAndSaveGstField(
                            "gst_default_mode",
                            e.target.value
                          );
                        }}
                        className="input-base w-full"
                      >
                        {GST_MODE_VALUES.map((m) => (
                          <option key={m} value={m}>
                            {settingsT(`tax.gstMode.${m}`)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField
                      label={settingsT("tax.placeOfSupply")}
                      extra={
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {settingsT("tax.placeOfSupplyExtra")}
                        </p>
                      }
                    >
                      <input
                        value={form.place_of_supply ?? ""}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            place_of_supply: e.target.value,
                          }));
                        }}
                        onBlur={(e) => {
                          updateAndSaveGstField(
                            "place_of_supply",
                            e.target.value
                          );
                        }}
                        className="input-base w-full"
                        placeholder={settingsT("tax.placeOfSupplyPlaceholder")}
                      />
                    </FormField>
                    <label className="flex items-center gap-2">
                      <AppleToggle
                        checked={form.customer_gstin_enabled === "true"}
                        onChange={(isChecked) => {
                          updateAndSaveGstField(
                            "customer_gstin_enabled",
                            isChecked ? "true" : "false"
                          );
                        }}
                        aria-label={settingsT("tax.customerGstinAria")}
                      />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {settingsT("tax.customerGstin")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <AppleToggle
                        checked={form.hsn_enabled !== "false"}
                        onChange={(isChecked) => {
                          updateAndSaveGstField(
                            "hsn_enabled",
                            isChecked ? "true" : "false"
                          );
                        }}
                        aria-label={settingsT("tax.hsnAria")}
                      />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {settingsT("tax.hsn")}
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-raised)]/40 p-5">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                      {settingsT("discounts.togglesTitle")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      {settingsT("discounts.togglesHint")}
                    </p>
                    <div className="space-y-3">
                      {DISCOUNT_TOGGLE_KEYS.map((key) => {
                        const toggleLabel = settingsT(
                          `discounts.fields.${key}`
                        );
                        return (
                          <label key={key} className="flex items-center gap-2">
                            <AppleToggle
                              checked={form[key] === "true"}
                              onChange={(isChecked) => {
                                updateAndSaveDiscountField(
                                  key,
                                  isChecked ? "true" : "false"
                                );
                              }}
                              aria-label={toggleLabel}
                            />
                            <span className="text-sm text-[var(--color-text-secondary)]">
                              {toggleLabel}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-raised)]/40 p-5">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                      {settingsT("discounts.couponsSectionTitle")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      {settingsT("discounts.couponsSectionHint")}
                    </p>
                    <CouponsAndTieredSection api={getElectron()} />
                  </div>
                </div>
              )}
            </AsyncDataPanel>
          ) : activeTab === "appearance" ? (
            <AppearanceTab />
          ) : activeTab === "data" ? (
            <AsyncDataPanel
              isLoading={dbPathQuery.isPending}
              isError={dbPathQuery.isError}
              onRetry={() => {
                void dbPathQuery.refetch();
              }}
              isEmpty={false}
              empty={<span className="sr-only">empty</span>}
              loaderColumns={1}
              loaderRows={4}
            >
              <div className="rounded-xl border border-[var(--color-danger)] border-opacity-30 bg-[var(--color-bg-surface)] p-6 shadow-xs">
                <h2 className="text-base font-semibold text-[var(--color-danger-text)] flex items-center gap-2">
                  <AlertTriangle size={20} aria-hidden="true" />
                  {settingsT("data.dangerZone")}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-4">
                  {settingsT("data.dangerIntro")}
                </p>

                {dbPath && (
                  <div className="mb-4">
                    <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">
                      {settingsT("data.dbFileLocation")}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] font-mono break-all">
                      {dbPath}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDangerAction("export")}
                    title={settingsT("data.exportButtonTitle")}
                  >
                    {settingsT("data.exportDb")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDangerAction("import")}
                    title={settingsT("data.importButtonTitle")}
                  >
                    {settingsT("data.importDb")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setDangerAction("clearTables")}
                    disabled={clearTablesMutation.isPending}
                    title={settingsT("data.clearButtonTitle")}
                  >
                    {clearTablesMutation.isPending
                      ? settingsT("data.clearing")
                      : settingsT("data.clearAll")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setDangerAction("clearEntireDb")}
                    disabled={clearEntireDbMutation.isPending}
                    title={settingsT("data.resetButtonTitle")}
                  >
                    {clearEntireDbMutation.isPending
                      ? settingsT("data.resetting")
                      : settingsT("data.resetDb")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDangerAction("populateSampleData")}
                    disabled={populateSampleDataMutation.isPending}
                    title={settingsT("data.sampleButtonTitle")}
                  >
                    {populateSampleDataMutation.isPending
                      ? settingsT("data.fillingSample")
                      : settingsT("data.fillSample")}
                  </Button>
                </div>

                {dangerAction !== null && (
                  <ConfirmDangerModal
                    open
                    onClose={() => setDangerAction(null)}
                    title={(settingsT as (key: string) => string)(
                      DANGER_I18N[dangerAction].titleKey
                    )}
                    message={(settingsT as (key: string) => string)(
                      DANGER_I18N[dangerAction].messageKey
                    )}
                    onConfirm={runDangerAction}
                    isConfirming={isConfirming}
                  />
                )}

                <p className="text-xs text-[var(--color-text-tertiary)] mt-4">
                  {settingsT("data.footerNote")}
                </p>
              </div>
            </AsyncDataPanel>
          ) : activeTab === "security" && currentUser ? (
            <SecurityTab
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              companyName={
                companyHeroName.length > 0 ? companyHeroName : "business"
              }
              onLock={lock}
              isSuperAdmin={currentUser.role === "superadmin"}
            />
          ) : activeTab === "activity" && currentUser ? (
            <ActivityLogSection currentUser={currentUser} />
          ) : null}
        </SettingsSectionPanel>
      </DashboardSectionBoundary>
    </div>
  );
}

// ---- Security Tab ----
function SecurityTab({
  currentUserId,
  currentUserName,
  companyName,
  onLock,
  isSuperAdmin,
}: {
  currentUserId: number;
  currentUserName: string;
  companyName: string;
  onLock: () => void;
  isSuperAdmin: boolean;
}) {
  const { t: settingsT } = useTranslation("settings");
  const { t: commonT } = useTranslation("common");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinPending, setPinPending] = useState(false);

  const [customerKey, setCustomerKey] = useState("");
  const [confirmCustomerKey, setConfirmCustomerKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [keySuccess, setKeySuccess] = useState(false);
  const [keyPending, setKeyPending] = useState(false);

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    setPinSuccess(false);
    if (!/^\d{4}$/.test(newPin))
      return setPinError(commonT("validation.invalidPin"));
    if (newPin !== confirmPin)
      return setPinError(commonT("validation.pinMismatch"));
    setPinPending(true);
    try {
      await window.electron.auth.changePin({
        userId: currentUserId,
        currentPin,
        newPin,
      });
      setPinSuccess(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: unknown) {
      setPinError(
        err instanceof Error ? err.message : settingsT("security.pinChangeFailed")
      );
    } finally {
      setPinPending(false);
    }
  }

  async function handleSetCustomerKey(e: React.FormEvent) {
    e.preventDefault();
    setKeyError("");
    setKeySuccess(false);
    if (!customerKey.trim())
      return setKeyError(settingsT("security.keyEmpty"));
    if (customerKey !== confirmCustomerKey)
      return setKeyError(settingsT("security.keysMismatch"));
    setKeyPending(true);
    try {
      await window.electron.auth.setCustomerMasterKey({
        key: customerKey.trim(),
        userId: currentUserId,
      });
      const saveRes = await window.electron.auth.saveRecoveryKeyToDevice({
        key: customerKey.trim(),
        ownerName: currentUserName,
        companyName,
        replaceExisting: true,
      });
      window.alert(
        settingsT("security.recoverySavedAlert", { path: saveRes.path })
      );
      setKeySuccess(true);
      setCustomerKey("");
      setConfirmCustomerKey("");
    } catch (err: unknown) {
      setKeyError(
        err instanceof Error ? err.message : settingsT("security.keySetFailed")
      );
    } finally {
      setKeyPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Change PIN */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {settingsT("security.changePin")}
          </h2>
        </div>
        <form onSubmit={handleChangePin} className="space-y-4 max-w-sm">
          <FormField label={settingsT("security.currentPin")}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) =>
                setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
              className="input-base w-full tracking-[0.5em]"
            />
          </FormField>
          <FormField label={settingsT("security.newPin")}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) =>
                setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
              className="input-base w-full tracking-[0.5em]"
            />
          </FormField>
          <FormField label={settingsT("security.confirmNewPin")}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
              className="input-base w-full tracking-[0.5em]"
            />
          </FormField>
          {pinError && (
            <p className="text-sm text-[var(--color-danger)]">{pinError}</p>
          )}
          {pinSuccess && (
            <p className="text-sm text-[var(--color-success)] flex items-center gap-1">
              <ShieldCheck size={14} /> {settingsT("security.pinUpdated")}
            </p>
          )}
          <Button type="submit" disabled={pinPending}>
            <Check size={16} className="mr-1" /> {settingsT("security.updatePin")}
          </Button>
        </form>
      </section>

      {/* Owner master key — superadmin only */}
      {isSuperAdmin && (
        <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-[var(--color-warning)]" />
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {settingsT("security.ownerRecoveryKey")}
            </h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {settingsT("security.ownerRecoveryHint")}
          </p>
          <form onSubmit={handleSetCustomerKey} className="space-y-4 max-w-sm">
            <FormField label={settingsT("security.newRecoveryKey")}>
              <input
                type="password"
                value={customerKey}
                onChange={(e) => setCustomerKey(e.target.value)}
                placeholder={settingsT("security.recoveryKeyPlaceholder")}
                className="input-base w-full"
              />
            </FormField>
            <FormField label={settingsT("security.confirmRecoveryKey")}>
              <input
                type="password"
                value={confirmCustomerKey}
                onChange={(e) => setConfirmCustomerKey(e.target.value)}
                placeholder={settingsT("security.recoveryKeyConfirmPlaceholder")}
                className="input-base w-full"
              />
            </FormField>
            {keyError && (
              <p className="text-sm text-[var(--color-danger)]">{keyError}</p>
            )}
            {keySuccess && (
              <p className="text-sm text-[var(--color-success)] flex items-center gap-1">
                <ShieldCheck size={14} /> {settingsT("security.keySaved")}
              </p>
            )}
            <Button type="submit" disabled={keyPending} variant="secondary">
              <KeyRound size={16} className="mr-1" />{" "}
              {settingsT("security.saveKey")}
            </Button>
          </form>
        </section>
      )}

      {/* Lock session */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {settingsT("security.session")}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {settingsT("security.sessionHint")}
        </p>
        <Button variant="secondary" onClick={onLock}>
          <Lock size={16} className="mr-1" /> {settingsT("security.lockAppNow")}
        </Button>
      </section>
    </div>
  );
}
