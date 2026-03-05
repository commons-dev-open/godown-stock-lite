import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/stock"
          className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow transition"
        >
          <h2 className="font-medium text-gray-900">Total Stock</h2>
          <p className="text-sm text-gray-500 mt-1">View and manage products</p>
        </Link>
        <Link
          to="/sales"
          className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow transition"
        >
          <h2 className="font-medium text-gray-900">Daily Sales</h2>
          <p className="text-sm text-gray-500 mt-1">Log daily summary</p>
        </Link>
        <Link
          to="/reports"
          className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow transition"
        >
          <h2 className="font-medium text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-1">Weekly, total sale, P&L</p>
        </Link>
      </div>
    </div>
  );
}
