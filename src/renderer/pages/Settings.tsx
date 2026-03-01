import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "@heroicons/react/24/outline";
import { getElectron } from "../api/client";
import FormField from "../components/FormField";
import Button from "../components/Button";
import { useMutationWithToast } from "../hooks/useMutationWithToast";

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

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
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
    </div>
  );
}
