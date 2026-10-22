import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  ArrowLeftRight,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LogOut,
  PackageCheck,
  Recycle,
  ShieldCheck,
} from "lucide-react";
import { apiRequest } from "../services/api";

const navItems = [
  { label: "Overview", path: "/org/dashboard", icon: LayoutDashboard },
  { label: "Incoming requests", path: "/org/requests", icon: ClipboardList },
  { label: "Device intake", path: "/org/inventory", icon: PackageCheck },
  { label: "Transfers", path: "/org/transfers", icon: ArrowLeftRight },
  { label: "Recovery & disposal", path: "/org/processing", icon: Recycle },
  { label: "Ledger", path: "/org/ledger", icon: ShieldCheck },
  { label: "Organisation profile", path: "/org/profile", icon: Building2 },
];

export default function OrganizationLayout() {
  const location = useLocation();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrganization = useCallback(async () => {
    try {
      const account = await apiRequest("/auth/me");
      setError("");
      if (!account.user?.organizationId) {
        setOrganization(null);
        return;
      }
      const data = await apiRequest("/organization-portal/profile");
      setOrganization(data.organization);
    } catch (err) {
      setError(err.message || "Could not verify organization access.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadOrganization);
  }, [loadOrganization]);

  if (loading) {
    return <div className="org-loading">Loading your organisation workspace...</div>;
  }
  if (error) {
    return (
      <main className="org-access-error">
        <h1>Organisation workspace unavailable</h1>
        <p>{error}</p>
        <button className="secondary-button" onClick={() => { setLoading(true); void loadOrganization(); }}>Try again</button>
      </main>
    );
  }
  if (!organization) return <Navigate to="/" replace />;

  const isCollectionCenter = organization.type === "COLLECTION_CENTER";
  const isRecycler = organization.type === "RECYCLING_FACILITY";
  const visibleItems = navItems.filter(({ path }) => {
    if (path === "/org/requests") return isCollectionCenter;
    if (path === "/org/processing") return isRecycler;
    return true;
  });
  if (location.pathname === "/org/requests" && !isCollectionCenter) {
    return <Navigate to="/org/dashboard" replace />;
  }
  if (location.pathname === "/org/processing" && !isRecycler) {
    return <Navigate to="/org/dashboard" replace />;
  }

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    window.location.replace("/login");
  };

  return (
    <div className="org-shell">
      <aside className="org-sidebar">
        <div className="org-brand">
          <div className="brand-icon"><Leaf size={23} /></div>
          <div><h2>EcoTrace</h2><p>Organisation portal</p></div>
        </div>
        <p className="nav-heading">OPERATIONS</p>
        <nav className="nav-list">
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="org-sidebar-footer">
          <div>
            <Building2 size={17} />
            <span>{organization.name}</span>
          </div>
          <button onClick={logout} aria-label="Sign out">
            <LogOut size={17} /><span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="org-main">
        <section className="org-page-content">
          <Outlet context={{ organization }} />
        </section>
      </main>
    </div>
  );
}
