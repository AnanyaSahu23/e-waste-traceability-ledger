import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { apiRequest } from "../services/api";

export default function OrganizationInventory() {
  const { organization } = useOutletContext();
  const isRecycler = organization.type === "RECYCLING_FACILITY";
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiRequest("/organization-portal/inventory");
      setDevices(data.devices || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load devices in custody.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function recordProcess(device, eventType) {
    const prompt = eventType === "COMPLETED"
      ? "Confirm that all processing and required waste handling are complete."
      : "Confirm that the device has been inspected.";
    if (!window.confirm(prompt)) return;
    setBusyId(device.id);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/devices/${device.id}/process`, {
        method: "POST",
        body: JSON.stringify({ eventType }),
      });
      setNotice(`${eventType === "INSPECTED" ? "Inspection" : "Completion"} recorded for ${device.brand} ${device.model}.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not update the lifecycle.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="org-page">
      <div className="dashboard-intro">
        <div><h2>Device intake & custody</h2><p>Devices are listed here only while your organisation is their current custodian.</p></div>
        <button className="refresh-button" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </div>
      {error && <div className="error-banner" role="alert"><p>{error}</p><button onClick={load}>Try again</button></div>}
      {notice && <div className="form-message success-message" role="status">{notice}</div>}
      <section className="dashboard-section">
        {loading ? <div className="org-loading">Loading custody inventory...</div> : devices.length ? (
          <div className="table-container"><table className="data-table">
            <thead><tr><th>Device</th><th>Category</th><th>Received / added</th><th>Lifecycle status</th><th>Actions</th></tr></thead>
            <tbody>{devices.map((device) => (
              <tr key={device.id}>
                <td><strong>{device.brand} {device.model}</strong><br /><small>{device.id}</small></td>
                <td>{device.category?.name || "—"}</td>
                <td>{new Date(device.events[0]?.createdAt || device.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td><span className="status-pill">{device.currentStatus.replaceAll("_", " ")}</span></td>
                <td className="org-action-cell">
                  <Link className="table-link" to={`/org/ledger?deviceId=${device.id}`}>Lifecycle <ArrowRight size={13} /></Link>
                  {isRecycler && device.currentStatus === "RECEIVED" && <button className="table-link-button" disabled={busyId === device.id} onClick={() => recordProcess(device, "INSPECTED")}>Inspect</button>}
                  {isRecycler && ["MATERIAL_RECOVERY", "DISPOSED"].includes(device.currentStatus) && <button className="table-link-button" disabled={busyId === device.id} onClick={() => recordProcess(device, "COMPLETED")}>Mark complete</button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><h3>No devices in custody</h3><p>Record receipt after an accepted request is physically handed over, or accept an incoming custody transfer.</p><Link className="primary-link" to="/org/requests">Review requests</Link></div>}
      </section>
    </div>
  );
}
