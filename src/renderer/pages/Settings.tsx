import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import FormField from "../components/FormField";
import Button from "../components/Button";
import ConfirmDangerModal from "../components/ConfirmDangerModal";
import { useMutationWithToast } from "../hooks/useMutationWithToast";

type DangerAction =
  | "export"
  | "import"
  | "clearTables"
  | "clearEntireDb"
  | null;

const DANGER_CONFIG: Record<
  Exclude<DangerAction, null>,
  { title: string; message: string }
> = {
  export: {
    title: "Export database",
    message:
      "You’ll save a full copy of your database to a file. Keep this backup somewhere safe—for example on an external drive or in the cloud—so you can restore your business data if anything goes wrong. Your current data stays untouched; this only creates a snapshot you can use for backup, migration, or peace of mind.",
  },
  import: {
    title: "Import database",
    message:
      "You’re about to replace everything in this app with the data from the file you select. Use this to restore from a backup or to move data from another machine. Your current database will be overwritten and cannot be recovered. Make sure you’ve exported a backup first if you might need it.",
  },
  clearTables: {
    title: "Clear all data",
    message:
      "Every table will be emptied: items, mahajans, transactions, invoices, daily sales, and settings. The database structure stays in place so you can start fresh without losing units or schema. Use this when you want to wipe all business data but keep the app ready for new entries. This cannot be undone.",
  },
  clearEntireDb: {
    title: "Reset database",
    message:
      "The database file will be deleted and a brand‑new empty database will be created. Use this for a complete fresh start. All your data—items, mahajans, invoices, everything—will be gone forever. Export a backup first if you might need to refer to this data later. This cannot be undone.",
  },
};

const SETTING_KEYS = {
  company_name: "Company name",
  company_address: "Address",
  gstin: "GSTIN",
  owner_name: "Owner name",
  owner_phone: "Phone",
} as const;

const DISPLAY_NAME_MAX = 25;

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
    initial.displayName = settings.displayName ?? "";
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
    const payload = { ...form };
    if (typeof payload.displayName === "string") {
      payload.displayName = payload.displayName.trim().slice(0, DISPLAY_NAME_MAX);
    }
    setSettingsMutation.mutate(payload);
  };

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
    }
  };

  const isConfirming =
    (dangerAction === "clearTables" && clearTablesMutation.isPending) ||
    (dangerAction === "clearEntireDb" && clearEntireDbMutation.isPending);

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
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
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder={label}
                />
              </FormField>
            ))}
          </div>
          <div className="mt-4">
            <Button type="submit" disabled={setSettingsMutation.isPending}>
              <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Save
            </Button>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Appearance</h2>
          <div className="space-y-4">
            <FormField
              label="App display name"
              extra={
                <p className="text-xs text-gray-500">
                  Shown in header, PDFs and print (max {DISPLAY_NAME_MAX}{" "}
                  characters). Leave blank for default.
                </p>
              }
            >
              <input
                value={form.displayName ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                maxLength={DISPLAY_NAME_MAX}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Godown Stock Lite"
              />
            </FormField>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-gray-700">Theme (Dark / Light)</span>
            <span className="text-sm text-gray-500 italic">Coming soon</span>
          </div>
        </section>
      </form>

      <section className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-lg font-medium text-red-800 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5" aria-hidden />
          Danger zone
        </h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          These actions affect your database. Use with care.
        </p>

        {dbPath && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-0.5">Database file location</p>
            <p className="text-sm text-gray-700 font-mono break-all">{dbPath}</p>
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
            {clearTablesMutation.isPending ? "Clearing…" : "Clear all data"}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setDangerAction("clearEntireDb")}
            disabled={clearEntireDbMutation.isPending}
            title="Delete the database file and create a new empty one"
          >
            {clearEntireDbMutation.isPending ? "Resetting…" : "Reset database"}
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

        <p className="text-xs text-gray-500 mt-4">
          Clear all data: empties every table but keeps the structure. Reset
          database: removes the database file and creates a new empty database.
        </p>
      </section>
    </div>
  );
}
