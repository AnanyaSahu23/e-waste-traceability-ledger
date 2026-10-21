import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Devices from "./pages/Devices";
import RegisterDevice from "./pages/RegisterDevice";
import TrackDevice from "./pages/TrackDevice";
import RecyclingRequests from "./pages/RecyclingRequests";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RequireAuth from "./RequireAuth";
import OrganizationLayout from "./layouts/OrganizationLayout";
import OrganizationDashboard from "./pages/OrganizationDashboard";
import OrganizationRequests from "./pages/OrganizationRequests";
import OrganizationInventory from "./pages/OrganizationInventory";
import OrganizationTransfers from "./pages/OrganizationTransfers";
import OrganizationProcessing from "./pages/OrganizationProcessing";
import OrganizationLedger from "./pages/OrganizationLedger";
import OrganizationProfile from "./pages/OrganizationProfile";
import PortalHome, { IndividualPortalGuard } from "./pages/PortalHome";

import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<PortalHome />} />
          <Route element={<IndividualPortalGuard />}>
            <Route element={<MainLayout />}>
              <Route path="/devices" element={<Devices />} />
              <Route path="/register-device" element={<RegisterDevice />} />
              <Route path="/track-device" element={<TrackDevice />} />
              <Route
                path="/recycling-requests"
                element={<RecyclingRequests />}
              />
            </Route>
          </Route>

          <Route path="/org" element={<OrganizationLayout />}>
            <Route index element={<OrganizationDashboard />} />
            <Route path="dashboard" element={<OrganizationDashboard />} />
            <Route path="requests" element={<OrganizationRequests />} />
            <Route path="inventory" element={<OrganizationInventory />} />
            <Route path="transfers" element={<OrganizationTransfers />} />
            <Route path="processing" element={<OrganizationProcessing />} />
            <Route path="ledger" element={<OrganizationLedger />} />
            <Route path="profile" element={<OrganizationProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;