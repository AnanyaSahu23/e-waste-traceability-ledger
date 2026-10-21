import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { apiRequest } from "../services/api";
import Dashboard from "./Dashboard";

export default function PortalHome() {
  const [organizationId, setOrganizationId] = useState(undefined);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiRequest("/auth/me")
      .then((data) => {
        if (active) setOrganizationId(data.user?.organizationId || null);
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load account.");
      });
    return () => { active = false; };
  }, []);
  if (error) return <div className="error-banner" role="alert"><p>{error}</p></div>;
  if (organizationId === undefined) return <div className="org-loading">Loading account...</div>;
  if (organizationId) return <Navigate to="/org/dashboard" replace />;
  return <Dashboard />;
}

export function IndividualPortalGuard() {
  const [organizationId, setOrganizationId] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/auth/me")
      .then((data) => {
        if (active) setOrganizationId(data.user?.organizationId || null);
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not verify account access.");
      });
    return () => { active = false; };
  }, []);

  if (error) return <div className="error-banner" role="alert"><p>{error}</p></div>;
  if (organizationId === undefined) return <div className="org-loading">Loading account...</div>;
  if (organizationId) return <Navigate to="/org/dashboard" replace />;
  return <Outlet />;
}
