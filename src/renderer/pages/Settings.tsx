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
import {
  useTheme,
  BRAND_COLOR_OPTIONS,
  type ThemeMode,
} from "../context/ThemeContext";
import {
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
  type NumberAbbreviationStyle,
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

type DangerAction =
  | "export"
  | "import"
  | "clearTables"
  | "clearEntireDb"
  | "populateSampleData"
  | null;

const DANGER_CONFIG: Record<
  Exclude<DangerAction, null>,
  { title: string; message: string }
> = {
  export: {
    title: "Export database",
    message:
      "You'll save a full copy of your database to a file. Keep this backup somewhere safe—for example on an external drive or in the cloud—so you can restore your business data if anything goes wrong. Your current data stays untouched; this only creates a snapshot you can use for backup, migration, or peace of mind.",
  },
  import: {
    title: "Import database",
    message:
      "You're about to replace everything in this app with the data from the file you select. Use this to restore from a backup or to move data from another machine. Your current database will be overwritten and cannot be recovered. Make sure you've exported a backup first if you might need it.",
  },
  clearTables: {
    title: "Clear all data",
    message:
      "Every table will be emptied: items, lenders, transactions, invoices, daily sales, and settings. The database structure stays in place so you can start fresh without losing units or schema. Use this when you want to wipe all business data but keep the app ready for new entries. This cannot be undone.",
  },
  clearEntireDb: {
    title: "Reset database",
    message:
      "The database file will be deleted and a brand‑new empty database will be created. Use this for a complete fresh start. All your data—items, lenders, invoices, everything—will be gone forever. Export a backup first if you might need to refer to this data later. This cannot be undone.",
  },
  populateSampleData: {
    title: "Fill with sample data",
    message:
      "This will insert a small set of realistic sample items, lenders, invoices, transactions, and daily sales into an empty database so you can explore the app. It only runs when there is no existing business data; if you've already started using the app, nothing will be changed.",
  },
};

const SETTING_KEYS = {
  company_name: "Company name",
  company_address: "Address",
  gstin: "GSTIN",
  owner_name: "Owner name",
  owner_phone: "Phone",
} as const;

const GST_SETTING_KEYS = {
  gst_enabled: "Enable GST",
  gst_default_rate: "Default GST Rate",
  gst_default_mode: "Default Price Mode",
  place_of_supply: "Place of Supply",
  customer_gstin_enabled: "Show Customer GSTIN field",
  hsn_enabled: "Enable HSN",
} as const;

const DISCOUNT_SETTING_KEYS = {
  discount_percentage_enabled: "Enable percentage discount",
  discount_flat_enabled: "Enable flat amount discount",
  discount_bogo_enabled: "Enable BOGO discount",
  discount_coupon_enabled: "Enable coupons",
  discount_tiered_enabled: "Enable tiered/volume discount",
  round_bill_to_whole: "Round final bill to nearest whole number",
} as const;

const GST_RATES = ["0", "5", "12", "18", "28"] as const;
const GST_MODES = [
  { value: "exclusive", label: "Exclusive" },
  { value: "inclusive", label: "Inclusive" },
] as const;

const DISPLAY_NAME_MAX = 25;

const NUMBER_ABBREVIATION_OPTIONS: {
  value: NumberAbbreviationStyle;
  label: string;
  hint: string;
}[] = [
  {
    value: "indian",
    label: "Indian",
    hint: "Full amount under 1 Lac; then Lac and Cr (e.g. 12.5 Lac).",
  },
  {
    value: "us",
    label: "US",
    hint: "Full amount under 1 million; then M and B.",
  },
  {
    value: "si",
    label: "International (SI)",
    hint: "Thousands as K, then M and B (powers of 1000).",
  },
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
const THEME_MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function AppearanceTab() {
  const { mode, brandColor, setMode, setBrandColor } = useTheme();
  const queryClient = useQueryClient();
  const api = getElectron();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const [displayName, setDisplayName] = useState("");
  const [numberAbbreviation, setNumberAbbreviation] =
    useState<NumberAbbreviationStyle>("indian");

  useEffect(() => {
    setDisplayName(settings.displayName ?? "");
  }, [settings]);

  useEffect(() => {
    setNumberAbbreviation(
      parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY])
    );
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

  const saveNumberAbbreviation = () => {
    setSettingsMutation.mutate({
      [NUMBER_ABBREVIATION_STYLE_KEY]: numberAbbreviation,
    });
  };

  return (
    <div className="space-y-8">
      {/* App Display Name */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          App Display Name
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          Shown in sidebar header, PDFs and print. Max {DISPLAY_NAME_MAX}{" "}
          characters. Leave blank for default.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={DISPLAY_NAME_MAX}
              className="input-base w-full"
              placeholder="Godown Stock Lite"
            />
          </div>
          <Button
            onClick={saveDisplayName}
            disabled={setSettingsMutation.isPending}
          >
            <Check size={16} className="mr-1" aria-hidden="true" />
            Save
          </Button>
        </div>
      </section>
      {/* Theme Mode */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          Theme
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          Choose light, dark, or follow your system preference.
        </p>
        <div className="flex gap-3">
          {THEME_MODES.map(({ value, label, icon: Icon }) => {
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
          Brand Color
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          Pick an accent color used throughout the app.
        </p>
        <div className="flex flex-wrap gap-3">
          {BRAND_COLOR_OPTIONS.map(({ value, label, hex }) => {
            const active = brandColor === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setBrandColor(value)}
                className="flex flex-col items-center gap-1.5 group"
                title={label}
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
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Number abbreviations (dashboard heroes) */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          Number abbreviations
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          How large counts and rupee amounts are shortened on dashboard heroes
          (Home, Products, Units, Lenders). Amounts below the threshold stay
          fully written with grouping.
        </p>
        <FormField label="Style">
          <select
            value={numberAbbreviation}
            onChange={(e) =>
              setNumberAbbreviation(
                parseNumberAbbreviationStyle(e.target.value)
              )
            }
            className="input-base w-full"
          >
            {NUMBER_ABBREVIATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
          {
            NUMBER_ABBREVIATION_OPTIONS.find(
              (o) => o.value === numberAbbreviation
            )?.hint
          }
        </p>
        <div className="mt-4">
          <Button
            type="button"
            onClick={saveNumberAbbreviation}
            disabled={setSettingsMutation.isPending}
          >
            <Check size={16} className="mr-1" aria-hidden="true" />
            Save
          </Button>
        </div>
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
        label: "Code",
        render: (c: CouponRow) => <span className="font-mono">{c.code}</span>,
      },
      { key: "discount_type", label: "Type" },
      {
        key: "discount_value",
        label: "Value",
        render: (c: CouponRow) => (
          <span className="block text-right">
            {c.discount_type === "percent"
              ? `${c.discount_value}%`
              : `₹${c.discount_value}`}
          </span>
        ),
      },
      {
        key: "min_order_amount",
        label: "Min order",
        render: (c: CouponRow) => (
          <span className="block text-right text-[var(--color-text-secondary)]">
            {c.min_order_amount != null ? `₹${c.min_order_amount}` : "—"}
          </span>
        ),
      },
      {
        key: "used_count",
        label: "Used",
        render: (c: CouponRow) => (
          <span className="block text-right text-[var(--color-text-secondary)]">
            {c.usage_limit != null
              ? `${c.used_count}/${c.usage_limit}`
              : c.used_count}
          </span>
        ),
      },
    ],
    []
  );

  const tieredColumns = useMemo(
    () => [
      {
        key: "min_order_amount",
        label: "Min order (₹)",
        render: (t: TieredRow) => (
          <span className="block text-right">₹{t.min_order_amount}</span>
        ),
      },
      {
        key: "discount_display",
        label: "Discount",
        render: (t: TieredRow) => {
          const hasFlat = (t.discount_flat ?? 0) > 0;
          const discountDisplay = hasFlat
            ? `₹${t.discount_flat}`
            : (t.discount_percent ?? 0) > 0
              ? `${t.discount_percent}%`
              : "—";
          return <span className="block text-right">{discountDisplay}</span>;
        },
      },
      {
        key: "max_discount_amount",
        label: "Max (₹)",
        render: (t: TieredRow) => (
          <span className="block text-right text-[var(--color-text-secondary)]">
            {t.max_discount_amount != null ? `₹${t.max_discount_amount}` : "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Coupons
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
            Add coupon
          </Button>
        </div>
        <DataTable<CouponRow>
          columns={couponColumns}
          data={coupons}
          emptyMessage="No coupons yet."
          pagination={{ type: "client" }}
          alwaysShowRowActions
          extraActions={(c) => (
            <>
              <button
                type="button"
                onClick={() => openCouponEdit(c)}
                className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label="Edit"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteCouponId(c.id)}
                className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label="Delete"
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
            Tiered rules
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
            Add rule
          </Button>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-2">
          Either % or flat amount per rule. Use max amount to cap the discount.
          Highest qualifying tier applies.
        </p>
        <DataTable<TieredRow>
          columns={tieredColumns}
          data={tieredRules}
          emptyMessage="No tiered rules yet."
          pagination={{ type: "client" }}
          alwaysShowRowActions
          extraActions={(t) => (
            <>
              <button
                type="button"
                onClick={() => openTieredEdit(t)}
                className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label="Edit"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTieredId(t.id)}
                className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                aria-label="Delete"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        />
      </div>

      {couponModal && (
        <FormModal
          title={couponModal.mode === "add" ? "Add coupon" : "Edit coupon"}
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
              {couponModal.mode === "add" ? "Create" : "Save"}
            </Button>
          }
        >
          <div className="space-y-3">
            <FormField label="Code">
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
            <FormField label="Type">
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
                <option value="percent">Percentage</option>
                <option value="flat">Flat amount (₹)</option>
              </select>
            </FormField>
            <FormField
              label={
                couponForm.discount_type === "percent"
                  ? "Discount %"
                  : "Discount amount (₹)"
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
            <FormField label="Min order (₹)">
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
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Valid from (YYYY-MM-DD)">
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
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Valid to (YYYY-MM-DD)">
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
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Usage limit">
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
                placeholder="Optional"
              />
            </FormField>
          </div>
        </FormModal>
      )}

      {tieredModal && (
        <FormModal
          title={
            tieredModal.mode === "add" ? "Add tiered rule" : "Edit tiered rule"
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
              {tieredModal.mode === "add" ? "Create" : "Save"}
            </Button>
          }
        >
          <div className="space-y-3">
            <FormField label="Min order amount (₹)">
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
            <FormField label="Discount type">
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
                <option value="percent">Percentage</option>
                <option value="flat">Flat amount</option>
              </select>
            </FormField>
            {tieredForm.discount_type === "percent" ? (
              <FormField label="Discount %">
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
              <FormField label="Flat amount (₹)">
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
              label="Max discount amount (₹)"
              extra={
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Optional cap on total discount from this rule
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
                placeholder="No cap"
              />
            </FormField>
          </div>
        </FormModal>
      )}

      {deleteCouponId !== null && (
        <ConfirmModal
          open
          onClose={() => setDeleteCouponId(null)}
          title="Delete coupon"
          message="Delete this coupon? It cannot be used after deletion."
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={() => deleteCouponMut.mutate(deleteCouponId)}
        />
      )}

      {deleteTieredId !== null && (
        <ConfirmModal
          open
          onClose={() => setDeleteTieredId(null)}
          title="Delete tiered rule"
          message="Delete this rule?"
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={() => deleteTieredMut.mutate(deleteTieredId)}
        />
      )}
    </div>
  );
}

const SETTINGS_SECTION_META: Record<
  SettingsTabId,
  { title: string; description: string }
> = {
  business: {
    title: "Company & business",
    description:
      "Legal and contact details used on invoices and inside the app.",
  },
  tax: {
    title: "GST & tax",
    description:
      "Default GST rate, price mode, place of supply, and invoice field options.",
  },
  discounts: {
    title: "Discounts",
    description:
      "Toggle discount types on invoices and manage coupons and tiered rules.",
  },
  appearance: {
    title: "Appearance",
    description: "Theme, accent color, display name, and number formatting.",
  },
  security: {
    title: "Security",
    description: "PIN, master key, and locking the app on this device.",
  },
  activity: {
    title: "Activity log",
    description:
      "Recent changes across the app. Filters apply to the list below.",
  },
  data: {
    title: "Data & backups",
    description:
      "Export, import, or reset your database. Irreversible actions require confirmation.",
  },
};

/* ── Main Settings Page ───────────────────────────────────── */
export default function Settings() {
  const queryClient = useQueryClient();
  const api = getElectron();
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
    for (const key of Object.keys(SETTING_KEYS)) {
      initial[key] = settings[key] ?? "";
    }
    for (const key of Object.keys(GST_SETTING_KEYS)) {
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

  const saveGstSettings = () => {
    const payload: Record<string, string> = {
      gst_enabled: form.gst_enabled ?? "false",
      gst_default_rate: form.gst_default_rate ?? "0",
      gst_default_mode: form.gst_default_mode ?? "exclusive",
      place_of_supply: (form.place_of_supply ?? "").trim(),
      customer_gstin_enabled: form.customer_gstin_enabled ?? "false",
      hsn_enabled: form.hsn_enabled ?? "true",
    };
    setSettingsMutation.mutate(payload);
  };

  const saveDiscountSettings = () => {
    const payload: Record<string, string> = {
      discount_percentage_enabled: form.discount_percentage_enabled ?? "false",
      discount_flat_enabled: form.discount_flat_enabled ?? "false",
      discount_bogo_enabled: form.discount_bogo_enabled ?? "false",
      discount_coupon_enabled: form.discount_coupon_enabled ?? "false",
      discount_tiered_enabled: form.discount_tiered_enabled ?? "false",
      round_bill_to_whole: form.round_bill_to_whole ?? "false",
    };
    setSettingsMutation.mutate(payload);
  };

  const gstEnabled = form.gst_enabled === "true";

  const clearTablesMutation = useMutationWithToast({
    mutationFn: () => api.clearDbTables(),
    onSuccess: () => {
      setDangerAction(null);
      queryClient.invalidateQueries();
      toast.success("All data cleared. Tables are empty.");
    },
  });

  const clearEntireDbMutation = useMutationWithToast({
    mutationFn: () => api.clearEntireDb(),
    onSuccess: () => {
      setDangerAction(null);
      queryClient.invalidateQueries();
      toast.success("Database reset. A fresh database has been created.");
    },
  });

  const populateSampleDataMutation = useMutationWithToast({
    mutationFn: () => api.populateSampleData(),
    onSuccess: () => {
      setDangerAction(null);
      queryClient.invalidateQueries();
      toast.success("Sample data populated into empty tables.");
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
          toast.success(`Database exported to ${result.path}`);
        });
        break;
      case "import":
        api.importDb().then((result) => {
          if (result.canceled) return;
          queryClient.invalidateQueries();
          toast.success("Database imported. Data has been replaced.");
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
  const sectionMeta = SETTINGS_SECTION_META[activeTab];
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
                    {Object.entries(SETTING_KEYS).map(([key, label]) => (
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
                    ))}
                  </div>
                  <div className="mt-4">
                    <Button
                      type="submit"
                      disabled={setSettingsMutation.isPending}
                    >
                      <Check size={16} className="mr-1" aria-hidden="true" />
                      Save
                    </Button>
                  </div>
                </form>
              ) : activeTab === "tax" ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          gst_enabled: e.target.checked ? "true" : "false",
                        }))
                      }
                      className="rounded border-[var(--color-border-strong)] accent-[var(--color-accent)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                      Enable GST
                    </span>
                  </label>
                  <div
                    className={`space-y-4 ${!gstEnabled ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <FormField label="Default GST Rate">
                      <select
                        value={form.gst_default_rate ?? "0"}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            gst_default_rate: e.target.value,
                          }))
                        }
                        className="input-base w-full"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Default Price Mode">
                      <select
                        value={form.gst_default_mode ?? "exclusive"}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            gst_default_mode: e.target.value,
                          }))
                        }
                        className="input-base w-full"
                      >
                        {GST_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField
                      label="Place of Supply"
                      extra={
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          Seller&apos;s state; shown on Tax Invoice PDF
                        </p>
                      }
                    >
                      <input
                        value={form.place_of_supply ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            place_of_supply: e.target.value,
                          }))
                        }
                        className="input-base w-full"
                        placeholder="e.g. Maharashtra"
                      />
                    </FormField>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.customer_gstin_enabled === "true"}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            customer_gstin_enabled: e.target.checked
                              ? "true"
                              : "false",
                          }))
                        }
                        className="rounded border-[var(--color-border-strong)] accent-[var(--color-accent)]"
                      />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        Show Customer GSTIN field (B2B mode)
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.hsn_enabled !== "false"}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            hsn_enabled: e.target.checked ? "true" : "false",
                          }))
                        }
                        className="rounded border-[var(--color-border-strong)] accent-[var(--color-accent)]"
                      />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        Enable HSN (Harmonized System of Nomenclature) code
                      </span>
                    </label>
                  </div>
                  <div className="mt-4">
                    <Button
                      type="button"
                      onClick={saveGstSettings}
                      disabled={setSettingsMutation.isPending}
                    >
                      <Check size={16} className="mr-1" aria-hidden="true" />
                      Save GST settings
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-raised)]/40 p-5">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                      Discount toggles
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      Enable or disable each discount type. Disabled types will
                      not appear in the invoice form.
                    </p>
                    <div className="space-y-3">
                      {(
                        Object.keys(
                          DISCOUNT_SETTING_KEYS
                        ) as (keyof typeof DISCOUNT_SETTING_KEYS)[]
                      ).map((key) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form[key] === "true"}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                [key]: e.target.checked ? "true" : "false",
                              }))
                            }
                            className="rounded border-[var(--color-border-strong)] accent-[var(--color-accent)]"
                          />
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {DISCOUNT_SETTING_KEYS[key]}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4">
                      <Button
                        type="button"
                        onClick={saveDiscountSettings}
                        disabled={setSettingsMutation.isPending}
                      >
                        <Check size={16} className="mr-1" aria-hidden="true" />
                        Save discount settings
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-raised)]/40 p-5">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                      Coupons & tiered rules
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      Manage coupon codes and tiered (volume) discount rules.
                      Enable coupons and tiered discounts in Discount Settings
                      above.
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
                  Danger zone
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-4">
                  These actions affect your database. Use with care.
                </p>

                {dbPath && (
                  <div className="mb-4">
                    <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">
                      Database file location
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
                    title="Save a copy of the database to a file"
                  >
                    Export database
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDangerAction("import")}
                    title="Replace current database with a backup file"
                  >
                    Import database
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setDangerAction("clearTables")}
                    disabled={clearTablesMutation.isPending}
                    title="Delete all rows in all tables; schema is kept"
                  >
                    {clearTablesMutation.isPending
                      ? "Clearing..."
                      : "Clear all data"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setDangerAction("clearEntireDb")}
                    disabled={clearEntireDbMutation.isPending}
                    title="Delete the database file and create a new empty one"
                  >
                    {clearEntireDbMutation.isPending
                      ? "Resetting..."
                      : "Reset database"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDangerAction("populateSampleData")}
                    disabled={populateSampleDataMutation.isPending}
                    title="Fill all main tables with realistic sample data (only when empty)"
                  >
                    {populateSampleDataMutation.isPending
                      ? "Filling sample data..."
                      : "Fill with sample data"}
                  </Button>
                </div>

                {dangerAction !== null && (
                  <ConfirmDangerModal
                    open
                    onClose={() => setDangerAction(null)}
                    title={DANGER_CONFIG[dangerAction].title}
                    message={DANGER_CONFIG[dangerAction].message}
                    onConfirm={runDangerAction}
                    isConfirming={isConfirming}
                  />
                )}

                <p className="text-xs text-[var(--color-text-tertiary)] mt-4">
                  Clear all data: empties every table but keeps the structure.
                  Reset database: removes the database file and creates a new
                  empty database.
                </p>
              </div>
            </AsyncDataPanel>
          ) : activeTab === "security" && currentUser ? (
            <SecurityTab
              currentUserId={currentUser.id}
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
  onLock,
  isSuperAdmin,
}: {
  currentUserId: number;
  onLock: () => void;
  isSuperAdmin: boolean;
}) {
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
      return setPinError("PIN must be exactly 4 digits.");
    if (newPin !== confirmPin) return setPinError("PINs do not match.");
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
      setPinError(err instanceof Error ? err.message : "Failed to change PIN.");
    } finally {
      setPinPending(false);
    }
  }

  async function handleSetCustomerKey(e: React.FormEvent) {
    e.preventDefault();
    setKeyError("");
    setKeySuccess(false);
    if (!customerKey.trim()) return setKeyError("Key cannot be empty.");
    if (customerKey !== confirmCustomerKey)
      return setKeyError("Keys do not match.");
    setKeyPending(true);
    try {
      await window.electron.auth.setCustomerMasterKey({
        key: customerKey.trim(),
        userId: currentUserId,
      });
      setKeySuccess(true);
      setCustomerKey("");
      setConfirmCustomerKey("");
    } catch (err: unknown) {
      setKeyError(err instanceof Error ? err.message : "Failed to set key.");
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
            Change PIN
          </h2>
        </div>
        <form onSubmit={handleChangePin} className="space-y-4 max-w-sm">
          <FormField label="Current PIN">
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
          <FormField label="New PIN">
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
          <FormField label="Confirm New PIN">
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
              <ShieldCheck size={14} /> PIN updated.
            </p>
          )}
          <Button type="submit" disabled={pinPending}>
            <Check size={16} className="mr-1" /> Update PIN
          </Button>
        </form>
      </section>

      {/* Owner master key — superadmin only */}
      {isSuperAdmin && (
        <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-[var(--color-warning)]" />
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Owner Recovery Key
            </h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Set a recovery key for yourself as the owner. Use it to reset your
            PIN if you forget it. Changing this invalidates any previous
            recovery key.
          </p>
          <form onSubmit={handleSetCustomerKey} className="space-y-4 max-w-sm">
            <FormField label="New Recovery Key">
              <input
                type="password"
                value={customerKey}
                onChange={(e) => setCustomerKey(e.target.value)}
                placeholder="Enter recovery key"
                className="input-base w-full"
              />
            </FormField>
            <FormField label="Confirm Recovery Key">
              <input
                type="password"
                value={confirmCustomerKey}
                onChange={(e) => setConfirmCustomerKey(e.target.value)}
                placeholder="Re-enter recovery key"
                className="input-base w-full"
              />
            </FormField>
            {keyError && (
              <p className="text-sm text-[var(--color-danger)]">{keyError}</p>
            )}
            {keySuccess && (
              <p className="text-sm text-[var(--color-success)] flex items-center gap-1">
                <ShieldCheck size={14} /> Key saved.
              </p>
            )}
            <Button type="submit" disabled={keyPending} variant="secondary">
              <KeyRound size={16} className="mr-1" /> Save Key
            </Button>
          </form>
        </section>
      )}

      {/* Lock session */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          Session
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Lock the app immediately. PIN required to re-enter.
        </p>
        <Button variant="secondary" onClick={onLock}>
          <Lock size={16} className="mr-1" /> Lock App Now
        </Button>
      </section>
    </div>
  );
}
