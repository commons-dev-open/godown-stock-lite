import { useState } from "react";
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
        <input
          type="search"
          placeholder="Search by name, address, or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-72"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <TableLoader />
        ) : (
          <>
            <DataTable<Mahajan>
              columns={[
                { key: "name", label: "Name" },
                { key: "address", label: "Address" },
                { key: "phone", label: "Phone" },
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
            createMahajan.mutate({
              name: (form.name as HTMLInputElement).value,
              address: (form.address as HTMLInputElement).value || undefined,
              phone: (form.phone as HTMLInputElement).value || undefined,
              gstin: (form.gstin as HTMLInputElement).value || undefined,
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
              updateMahajan.mutate({
                id: editing.id,
                m: {
                  name: (form.name as HTMLInputElement).value,
                  address:
                    (form.address as HTMLInputElement).value || undefined,
                  phone: (form.phone as HTMLInputElement).value || undefined,
                  gstin: (form.gstin as HTMLInputElement).value || undefined,
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
