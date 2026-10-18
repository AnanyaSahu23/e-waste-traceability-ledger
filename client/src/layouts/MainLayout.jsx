import { Outlet, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import Sidebar from "../components/Sidebar";

const pageTitles = {
  "/": "Dashboard",
  "/devices": "My Devices",
  "/register-device": "Register Device",
  "/track-device": "Track Device",
  "/recycling-requests": "Recycling Requests",
};

export default function MainLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "EcoTrace";

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-area">
        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}