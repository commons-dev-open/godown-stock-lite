import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import TrialGuard from "./components/TrialGuard";
import DailySales from "./pages/DailySales";
import ForcePinChange from "./pages/ForcePinChange";
import Help from "./pages/Help";
import Home from "./pages/Home";
import Invoices from "./pages/Invoices";
import Items from "./pages/Items";
import MahajanLedger from "./pages/MahajanLedger";
import Mahajans from "./pages/Mahajans";
import Onboarding from "./pages/Onboarding";
import PinEntry from "./pages/PinEntry";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Transactions from "./pages/Transactions";
import Units from "./pages/Units";
import UserSelector from "./pages/UserSelector";

function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-bg-app)]">
      <span className="inline-block w-8 h-8 border-2 border-[var(--color-border-default)] border-t-[var(--color-accent)] rounded-full animate-spin" />
    </div>
  );
}

function AuthGate() {
  const { authState } = useAuth();

  if (authState.status === "loading") return <LoadingSpinner />;
  if (authState.status === "onboarding") return <Onboarding />;
  if (authState.status === "selecting") return <UserSelector />;
  if (authState.status === "entering_pin") return <PinEntry />;
  if (authState.status === "force_pin_change") return <ForcePinChange />;

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
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
