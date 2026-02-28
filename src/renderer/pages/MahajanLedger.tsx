import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getElectron } from "../api/client";
import TableLoader from "../components/TableLoader";
import { formatDateForView } from "../lib/date";
import type { LedgerRow } from "../../shared/types";

export default function MahajanLedger() {
  const { mahajanId } = useParams<{ mahajanId: string }>();
  const api = getElectron();
  const id = Number(mahajanId);

  const { data: mahajans = [] } = useQuery({
    queryKey: ["mahajans"],
    queryFn: () => api.getMahajans(),
  });

  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ["mahajanLedger", id],
    queryFn: () => api.getMahajanLedger(id) as Promise<LedgerRow[]>,
    enabled: !!id,
  });

  const mahajan = (mahajans as { id: number; name: string }[]).find(
    (m) => m.id === id
  );

  if (!id) return <div className="text-gray-500">Invalid Mahajan</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <Link to="/mahajans" className="text-gray-500 hover:text-gray-700">
          Back to Mahajans
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">
          Ledger: {mahajan?.name ?? `ID ${id}`}
        </h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Lends and deposits date wise.
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <TableLoader />
        ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                Date
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                Description
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              ledger.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {formatDateForView(row.transaction_date)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={
                        row.type === "lend"
                          ? "text-amber-700"
                          : "text-green-700"
                      }
                    >
                      {row.type === "lend" ? "Lend" : "Deposit"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {row.description}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-medium">
                    {row.amount.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
