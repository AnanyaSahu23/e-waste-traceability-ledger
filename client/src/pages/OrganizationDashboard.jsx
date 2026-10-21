import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Recycle,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { apiRequest } from "../services/api";

const metricCards = [
  ["Pending requests", "pendingRequests", Clock3, "orange"],
  ["Accepted requests", "acceptedRequests", CheckCircle2, "blue"],
  ["Devices in custody", "devicesInCustody", PackageCheck, "green"],
  ["Recovery operations", "recoveryOperations", Recycle, "purple"],
  ["Disposal records", "disposalRecords", Trash2, "orange"],
];

const formatDate = (date) => new Date(date).toLocaleString("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function OrganizationDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const dashboard = await apiRequest("/organization-portal/dashboard");
      setData(dashboard);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load organisation dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (loading && !data) return <div className="org-loading">Loading dashboard...</div>;
  const metrics = data?.metrics || {};
  const stages = Object.entries(data?.lifecycleStages || {});
  return (
    <div className="org-page">
      <div className="dashboard-intro">
        <div>
          <h2>Operations overview</h2>
          <p>Live activity and work assigned to your organisation.</p>
        </div>
        <button className="refresh-button" onClick={() => { setLoading(true); void load(); }} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {error && <div className="error-banner" role="alert"><p>{error}</p><button onClick={load}>Try again</button></div>}
      <div className="org-metric-grid">
        {metricCards.map(([label, key, Icon, color]) => (
          <article className="stat-card" key={key}>
            <div className={`stat-icon ${color}`}><Icon size={20} /></div>
            <p>{label}</p>
            <h3>{metrics[key] ?? "—"}</h3>
          </article>
        ))}
        <article className="stat-card">
          <div className="stat-icon green"><Activity size={20} /></div>
          <p>Devices completed</p>
          <h3>{metrics.completedDevices ?? "—"}</h3>
        </article>
      </div>

      <div className="org-dashboard-grid">
        {data?.organization?.type === "COLLECTION_CENTER" && <section className="dashboard-section">
          <div className="section-heading">
            <div><h2>Pending requests</h2><p>Requests awaiting your review.</p></div>
            <Link className="text-link" to="/org/requests">View all <ArrowRight size={14} /></Link>
          </div>
          {data?.pendingRequests?.length ? (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Device</th><th>Requester</th><th>Received</th><th /></tr></thead>
                <tbody>{data.pendingRequests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.device.brand} {request.device.model}</strong><br />{request.device.category?.name}</td>
                    <td>{request.device.owner?.name || "Device owner"}</td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td><Link className="table-link" to="/org/requests">Review</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="org-empty-inline">No pending requests.</div>}
        </section>}

        <section className="dashboard-section">
          <div className="section-heading">
            <div><h2>Devices by lifecycle stage</h2><p>Current custody inventory.</p></div>
            <PackageCheck size={18} />
          </div>
          {stages.length ? <div className="stage-list">{stages.map(([stage, count]) => (
            <div className="stage-row" key={stage}>
              <span>{stage.replaceAll("_", " ")}</span><strong>{count}</strong>
              <div><span style={{ width: `${Math.max(4, (count / Math.max(...stages.map((item) => item[1]))) * 100)}%` }} /></div>
            </div>
          ))}</div> : <div className="org-empty-inline">No devices currently in custody.</div>}
        </section>
      </div>

      <section className="dashboard-section org-activity-section">
        <div className="section-heading">
          <div><h2>Recent activity</h2><p>Latest lifecycle activity recorded by your organisation.</p></div>
          <Link className="text-link" to="/org/ledger">Open ledger <ArrowRight size={14} /></Link>
        </div>
        {data?.recentActivity?.length ? <div className="activity-list">
          {data.recentActivity.map((event) => (
            <div className="activity-row" key={event.id}>
              <div className="activity-icon"><Activity size={16} /></div>
              <div><strong>{event.eventType.replaceAll("_", " ")}</strong><p>{event.device.brand} {event.device.model} · {event.device.id}</p></div>
              <time>{formatDate(event.createdAt)}</time>
            </div>
          ))}
        </div> : <div className="org-empty-inline">No recent activity.</div>}
        {(metrics.invalidLedgerChecks || 0) > 0 && (
          <div className="org-alert"><ShieldAlert size={18} /> Ledger verification needs attention.</div>
        )}
      </section>
    </div>
  );
}
