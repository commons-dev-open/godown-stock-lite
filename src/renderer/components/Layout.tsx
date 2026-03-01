import { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/stock", label: "Products & Stock" },
  { to: "/mahajans", label: "Mahajans" },
  { to: "/transactions", label: "Transactions" },
  { to: "/sales", label: "Daily Sales" },
  { to: "/reports", label: "Reports" },
  { to: "/invoices", label: "Invoices" },
  { to: "/units", label: "Units" },
  { to: "/settings", label: "Settings" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navClass = ({ isActive }: Readonly<{ isActive: boolean }>) =>
    `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-gray-100 text-gray-900"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }`;

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-52 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          {/* <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-2 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button> */}
          <h1 className="text-base font-semibold text-gray-900">
            Godown Stock Lite
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {navItems.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} className={navClass} end={to === "/"}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
