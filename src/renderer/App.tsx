import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import TrialGuard from "./components/TrialGuard";
import Items from "./pages/Items";
import Mahajans from "./pages/Mahajans";
import MahajanLedger from "./pages/MahajanLedger";
import Transactions from "./pages/Transactions";
import DailySales from "./pages/DailySales";
import Reports from "./pages/Reports";
import Home from "./pages/Home";
import Units from "./pages/Units";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import Invoices from "./pages/Invoices";

export default function App() {
  return (
    <HashRouter>
      <TrialGuard />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stock" element={<Items />} />
          <Route path="/mahajans" element={<Mahajans />} />
          <Route
            path="/mahajans/ledger/:mahajanId"
            element={<MahajanLedger />}
          />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/sales" element={<DailySales />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/units" element={<Units />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
