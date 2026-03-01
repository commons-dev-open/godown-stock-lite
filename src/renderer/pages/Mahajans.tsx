import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import TableLoader from "../components/TableLoader";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import type { Mahajan } from "../../shared/types";

export default function Mahajans() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Mahajan | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loadingBalanceId, setLoadingBalanceId] = useState<number | null>(null);
  const [autoShowBalance, setAutoShowBalance] = useState(false);
  const [loadingBalancesPage, setLoadingBalancesPage] = useState(false);

  const { data: pageResult, isLoading } = useQuery({
    queryKey: ["mahajansPage", search, page],
    queryFn: () =>
      api.getMahajansPage({
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{
        data: Mahajan[];
        total: number;
      }>,
  });
  const mahajansPage = pageResult?.data ?? [];
  const totalMahajans = pageResult?.total ?? 0;

  async function loadBalance(mahajanId: number) {
    setLoadingBalanceId(mahajanId);
    try {
      const result = (await api.getMahajanBalance(mahajanId)) as {
        balance: number;
      };
      setBalances((prev) => ({ ...prev, [mahajanId]: result.balance }));
    } finally {
      setLoadingBalanceId(null);
    }
  }

  useEffect(() => {
    if (!autoShowBalance || mahajansPage.length === 0) return;
    setLoadingBalancesPage(true);
    Promise.all(
      mahajansPage.map((r) =>
        (api.getMahajanBalance(r.id) as Promise<{ balance: number }>).then(
          (res) => ({ id: r.id, balance: res.balance })
        )
      )
    )
      .then((results) => {
        setBalances((prev) => {
          const next = { ...prev };
          for (const { id, balance } of results) next[id] = balance;
          return next;
        });
      })
      .finally(() => setLoadingBalancesPage(false));
  }, [autoShowBalance, mahajansPage]);

  const createMahajan = useMutation({
    mutationFn: (m: {
      name: string;
      address?: string;
      phone?: string;
      gstin?: string;
    }) => api.createMahajan(m),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajans"] });
      queryClient.invalidateQueries({ queryKey: ["mahajansPage"] });
      setAddOpen(false);
    },
  });

  const updateMahajan = useMutation({
    mutationFn: ({
      id,
      m,
    }: {
      id: number;
      m: { name?: string; address?: string; phone?: string; gstin?: string };
    }) => api.updateMahajan(id, m),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajans"] });
      queryClient.invalidateQueries({ queryKey: ["mahajansPage"] });
      setEditing(null);
    },
  });

  const deleteMahajan = useMutation({
    mutationFn: (id: number) => api.deleteMahajan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajans"] });
      queryClient.invalidateQueries({ queryKey: ["mahajansPage"] });
    },
    onError: (err: Error) => alert(err.message),
  });

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Mahajans</h1>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Add Mahajan
          </button>
        </div>
        <div className="flex flex-nowrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
          <input
            type="search"
            placeholder="Search by name, address, or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white shrink-0 min-w-0 w-72 max-w-full"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="shrink-0 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear filters
            </button>
          )}
          <label className="flex items-center gap-2 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={autoShowBalance}
              onChange={(e) => setAutoShowBalance(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Calculate and show balance
            </span>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <TableLoader />
        ) : mahajansPage.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No records match the filters.
          </div>
        ) : (
          <>
            <DataTable<Mahajan>
              columns={[
                { key: "name", label: "Name" },
                { key: "address", label: "Address" },
                { key: "phone", label: "Phone" },
                {
                  key: "balance",
                  label: "Balance (Lend − Deposit)",
                  render: (row) => {
                    const bal = balances[row.id];
                    if (bal !== undefined) {
                      let colorClass = "text-gray-500";
                      if (bal > 0) colorClass = "text-red-600 font-medium";
                      else if (bal < 0)
                        colorClass = "text-green-600 font-medium";
                      let hint = "";
                      if (bal > 0) hint = " (you owe)";
                      else if (bal < 0) hint = " (they owe)";
                      return (
                        <span className={colorClass}>
                          ₹{Math.abs(bal).toFixed(2)}
                          {hint && (
                            <span className="text-gray-500 font-normal">
                              {hint}
                            </span>
                          )}
                        </span>
                      );
                    }
                    if (autoShowBalance && loadingBalancesPage) {
                      return (
                        <span className="text-gray-400 text-sm">Loading…</span>
                      );
                    }
                    const loading = loadingBalanceId === row.id;
                    return (
                      <button
                        type="button"
                        onClick={() => loadBalance(row.id)}
                        disabled={loading}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? "Loading…" : "View balance"}
                      </button>
                    );
                  },
                },
                {
                  key: "id",
                  label: "Details",
                  render: (row) => (
                    <Link
                      to={`/mahajans/ledger/${row.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Ledger
                    </Link>
                  ),
                },
              ]}
              data={mahajansPage}
              onEdit={setEditing}
              onDelete={(row) => {
                if (
                  globalThis.confirm("Delete this Mahajan? Balance must be 0.")
                )
                  deleteMahajan.mutate(row.id);
              }}
              emptyMessage="No Mahajans yet. Click Add Mahajan."
            />
            <Pagination
              page={page}
              total={totalMahajans}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <FormModal
        title="Add Mahajan"
        open={addOpen}
        onClose={() => setAddOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const get = (n: string) =>
              (form.elements.namedItem(n) as HTMLInputElement | null)?.value ??
              "";
            createMahajan.mutate({
              name: get("name"),
              address: get("address") || undefined,
              phone: get("phone") || undefined,
              gstin: get("gstin") || undefined,
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              name="name"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input name="address" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input name="phone" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GSTIN
            </label>
            <input name="gstin" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded"
            >
              Save
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Edit Mahajan"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const get = (n: string) =>
                (form.elements.namedItem(n) as HTMLInputElement | null)
                  ?.value ?? "";
              updateMahajan.mutate({
                id: editing.id,
                m: {
                  name: get("name"),
                  address: get("address") || undefined,
                  phone: get("phone") || undefined,
                  gstin: get("gstin") || undefined,
                },
              });
            }}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                name="name"
                defaultValue={editing.name}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                name="address"
                defaultValue={editing.address ?? ""}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                name="phone"
                defaultValue={editing.phone ?? ""}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSTIN
              </label>
              <input
                name="gstin"
                defaultValue={editing.gstin ?? ""}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 text-white rounded"
              >
                Update
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </div>
  );
}
