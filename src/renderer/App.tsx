import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Items from "./pages/Items";
import Mahajans from "./pages/Mahajans";
import MahajanLedger from "./pages/MahajanLedger";
import Transactions from "./pages/Transactions";
import DailySales from "./pages/DailySales";
import Reports from "./pages/Reports";
import Home from "./pages/Home";

export default function App() {
  return (
    <BrowserRouter>
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
