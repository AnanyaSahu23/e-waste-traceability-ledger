import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import RegisterDevice from "./pages/RegisterDevice";
import TrackDevice from "./pages/TrackDevice";
import RecyclingRequests from "./pages/RecyclingRequests";
import Login from "./pages/Login";

import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/register-device" element={<RegisterDevice />} />
          <Route path="/track-device" element={<TrackDevice />} />
          <Route
            path="/recycling-requests"
            element={<RecyclingRequests />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;