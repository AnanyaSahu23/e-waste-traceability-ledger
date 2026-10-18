import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Laptop,
  PlusCircle,
  UserRound,
  LogOut,
  GitBranch,
  Recycle,
  Leaf,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "My Devices", path: "/devices", icon: Laptop },
  { label: "Register Device", path: "/register-device", icon: PlusCircle },
  { label: "Track Device", path: "/track-device", icon: GitBranch },
  {
    label: "Recycling Requests",
    path: "/recycling-requests",
    icon: Recycle,
  },
];


const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");

  navigate("/login", { replace: true });
};

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Leaf size={23} />
        </div>
        <div>
          <h2>EcoTrace</h2>
          <p>E-Waste Ledger</p>
        </div>
      </div>

      <p className="nav-heading">WORKSPACE</p>

      <nav className="nav-list">
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              `nav-link ${isActive ? "active" : ""}`
            }
          >
            <Icon size={19} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
         <UserRound size={20} />
         <span>Profile</span>

         <LogOut
           size={18}
           className="logout-icon"
           onClick={handleLogout}
           title="Logout"
           aria-label="Logout"
         />
      </div>
    </aside>
  );
}