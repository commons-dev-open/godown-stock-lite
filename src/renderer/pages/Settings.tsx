import { useState, useEffect } from "react";
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
} from "lucide-react";
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
  type BrandColor,
} from "../context/ThemeContext";

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

  useEffect(() => {
    setDisplayName(settings.displayName ?? "");
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

  return (
    <div className="space-y-8">
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
        {coupons.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No coupons yet.
          </p>
        ) : (
          <div className="border border-[var(--color-border-default)] rounded-xl overflow-hidden text-sm">
            <table className="min-w-full">
              <thead className="bg-[var(--color-bg-surface-raised)]">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Code
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Value
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Min order
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Used
                  </th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-[var(--color-border-subtle)]"
                  >
                    <td className="px-3 py-2 font-mono text-[var(--color-text-primary)]">
                      {c.code}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {c.discount_type}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {c.discount_type === "percent"
                        ? `${c.discount_value}%`
                        : `₹${c.discount_value}`}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">
                      {c.min_order_amount != null
                        ? `₹${c.min_order_amount}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">
                      {c.usage_limit != null
                        ? `${c.used_count}/${c.usage_limit}`
                        : c.used_count}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openCouponEdit(c)}
                          className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCouponId(c.id)}
                          className="text-[var(--color-danger)] hover:opacity-80"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        {tieredRules.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No tiered rules yet.
          </p>
        ) : (
          <div className="border border-[var(--color-border-default)] rounded-xl overflow-hidden text-sm">
            <table className="min-w-full">
              <thead className="bg-[var(--color-bg-surface-raised)]">
                <tr>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Min order (₹)
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Discount
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    Max (₹)
                  </th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {tieredRules.map((t) => {
                  const hasFlat = (t.discount_flat ?? 0) > 0;
                  const discountDisplay = hasFlat
                    ? `₹${t.discount_flat}`
                    : (t.discount_percent ?? 0) > 0
                      ? `${t.discount_percent}%`
                      : "—";
                  return (
                    <tr
                      key={t.id}
                      className="border-t border-[var(--color-border-subtle)]"
                    >
                      <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                        ₹{t.min_order_amount}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                        {discountDisplay}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">
                        {t.max_discount_amount != null
                          ? `₹${t.max_discount_amount}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => openTieredEdit(t)}
                            className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                            aria-label="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTieredId(t.id)}
                            className="text-[var(--color-danger)] hover:opacity-80"
                            aria-label="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

/* ── Main Settings Page ───────────────────────────────────── */
export default function Settings() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [form, setForm] = useState<Record<string, string>>({});
  const [dangerAction, setDangerAction] = useState<DangerAction>(null);

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });

  const { data: dbPath } = useQuery({
    queryKey: ["dbPath"],
    queryFn: () => api.getDbPath(),
  });

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

  const tabs = [
    "Business",
    "Tax & GST",
    "Discounts",
    "Appearance",
    "Data",
  ] as const;
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Business");

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="sticky top-0 z-20 bg-[var(--color-bg-app)] pt-6 pb-3 -mb-5">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight">
          Settings
        </h1>
      </div>

      <div className="flex gap-1 border-b border-[var(--color-border-default)] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Business" && (
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
              Company / Business
            </h2>
            <div className="space-y-4">
              {Object.entries(SETTING_KEYS).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <input
                    value={form[key] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="input-base w-full"
                    placeholder={label}
                  />
                </FormField>
              ))}
            </div>
            <div className="mt-4">
              <Button type="submit" disabled={setSettingsMutation.isPending}>
                <Check size={16} className="mr-1" aria-hidden="true" />
                Save
              </Button>
            </div>
          </section>
        </form>
      )}

      {activeTab === "Tax & GST" && (
        <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
            GST / Tax Settings
          </h2>
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
        </section>
      )}

      {activeTab === "Discounts" && (
        <div className="space-y-8">
          <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
              Discount Settings
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Enable or disable each discount type. Disabled types will not
              appear in the invoice form.
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
          </section>

          <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-6">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
              Coupons & Tiered Discount Rules
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Manage coupon codes and tiered (volume) discount rules. Enable
              coupons and tiered discounts in Discount Settings above.
            </p>
            <CouponsAndTieredSection api={getElectron()} />
          </section>
        </div>
      )}

      {activeTab === "Appearance" && <AppearanceTab />}

      {activeTab === "Data" && (
        <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-danger)] border-opacity-30 shadow-xs p-6">
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
              {clearTablesMutation.isPending ? "Clearing..." : "Clear all data"}
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
            Clear all data: empties every table but keeps the structure. Reset
            database: removes the database file and creates a new empty
            database.
          </p>
        </section>
      )}
    </div>
  );
}
