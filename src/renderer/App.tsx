import { HashRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import TrialGuard from "./components/TrialGuard";
import DailySales from "./pages/DailySales";
import Help from "./pages/Help";
import Home from "./pages/Home";
import Invoices from "./pages/Invoices";
import Items from "./pages/Items";
import MahajanLedger from "./pages/MahajanLedger";
import Mahajans from "./pages/Mahajans";
import Settings from "./pages/Settings";
import Transactions from "./pages/Transactions";
import Units from "./pages/Units";

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
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/units" element={<Units />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
