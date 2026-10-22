import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Truck } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { apiRequest } from "../services/api";

export default function OrganizationTransfers() {
  const { organization } = useOutletContext();
  const [transfers, setTransfers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({ deviceId: "", toOrganizationId: "", remarks: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const incomingPending = transfers.filter((transfer) =>
    transfer.status === "PENDING" && transfer.toOrganizationId === organization.id
  );

  const load = useCallback(async () => {
    try {
      const [transferData, inventoryData] = await Promise.all([
        apiRequest("/organization-portal/transfers"),
        apiRequest("/organization-portal/inventory"),
      ]);
      setTransfers(transferData.transfers || []);
      setOrganizations(transferData.organizations || []);
      setDevices(inventoryData.devices || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load custody transfers.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function createTransfer(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/transfers", { method: "POST", body: JSON.stringify(form) });
      setNotice("Transfer initiated. Custody changes only after the receiving organisation accepts.");
      setForm({ deviceId: "", toOrganizationId: "", remarks: "" });
      await load();
    } catch (err) {
      setError(err.message || "Could not initiate transfer.");
    } finally {
      setSaving(false);
    }
  }

  async function acceptTransfer(transfer) {
    if (!window.confirm("Confirm that your organisation has physically received this device?")) return;
    setBusyId(transfer.id);
    setError("");
    try {
      await apiRequest(`/transfers/${transfer.id}/accept`, { method: "POST" });
      setNotice("Custody accepted and receipt added to the lifecycle.");
      await load();
    } catch (err) {
      setError(err.message || "Could not accept transfer.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="org-page">
      <div className="dashboard-intro"><div><h2>Custody Transfers</h2><p>Dispatch a device to another organisation or accept an incoming handover.</p></div><button className="refresh-button" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw size={16} /> Refresh</button></div>
      {error && <div className="error-banner" role="alert"><p>{error}</p><button onClick={load}>Try again</button></div>}
      {notice && <div className="form-message success-message" role="status">{notice}</div>}
      <section className="dashboard-section">
        <div className="section-heading"><div><h2>Incoming transfer requests</h2><p>Accept a handover after your organisation has physically received the device.</p></div><span className="status-pill">{incomingPending.length} pending</span></div>
        {loading ? <div className="org-loading">Loading incoming transfers...</div> : incomingPending.length ? <div className="table-container"><table className="data-table">
          <thead><tr><th>Device</th><th>From organisation</th><th>Requested</th><th>Notes</th><th>Action</th></tr></thead>
          <tbody>{incomingPending.map((transfer) => <tr key={transfer.id}>
            <td><strong>{transfer.device.brand} {transfer.device.model}</strong><br /><small>{transfer.device.id}</small></td>
            <td>{transfer.fromOrganization.name}</td>
            <td>{new Date(transfer.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
            <td>{transfer.initiatedEvent?.remarks || "—"}</td>
            <td><button className="table-link-button" disabled={busyId === transfer.id} onClick={() => acceptTransfer(transfer)}><Truck size={14} /> {busyId === transfer.id ? "Accepting..." : "Accept handover"}</button></td>
          </tr>)}</tbody>
        </table></div> : <div className="empty-state"><h3>No incoming transfers to accept</h3><p>Requests sent to your organisation will appear here.</p></div>}
      </section>
      <section className="org-form-card">
        <h3>Initiate a custody transfer</h3>
        <p>Device status changes to in transit. The receiver records custody only when they accept the transfer.</p>
        <form className="org-form-grid" onSubmit={createTransfer}>
          <label>Device in your custody<select required value={form.deviceId} onChange={(event) => setForm({ ...form, deviceId: event.target.value })}><option value="">Choose device</option>{devices.filter((device) => !["IN_TRANSIT", "COMPLETED", "DISPOSED"].includes(device.currentStatus)).map((device) => <option value={device.id} key={device.id}>{device.brand} {device.model} · {device.currentStatus.replaceAll("_", " ")}</option>)}</select></label>
          <label>Receiving organisation<select required value={form.toOrganizationId} onChange={(event) => setForm({ ...form, toOrganizationId: event.target.value })}><option value="">Choose organisation</option>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name} · {organization.type.replaceAll("_", " ")}</option>)}</select></label>
          <label className="org-form-full">Transfer notes<textarea maxLength={2000} value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Optional dispatch details" /></label>
          <button className="submit-button" disabled={saving || !devices.length || !organizations.length}>{saving ? "Sending..." : "Initiate transfer"}</button>
        </form>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><div><h2>Transfer history</h2><p>Incoming and outgoing transfers for your organisation.</p></div></div>
        {loading ? <div className="org-loading">Loading transfer history...</div> : transfers.length ? <div className="table-container"><table className="data-table">
          <thead><tr><th>Device</th><th>From</th><th>To</th><th>Requested</th><th>Status</th><th /></tr></thead>
          <tbody>{transfers.map((transfer) => <tr key={transfer.id}>
            <td><strong>{transfer.device.brand} {transfer.device.model}</strong><br /><small>{transfer.device.id}</small></td>
            <td>{transfer.fromOrganization.name}</td><td>{transfer.toOrganization.name}</td>
            <td>{new Date(transfer.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
            <td><span className="status-pill">{transfer.status}</span></td>
            <td>{transfer.status === "PENDING" && transfer.toOrganizationId === organization.id ? "Awaiting acceptance" : "—"}</td>
          </tr>)}</tbody>
        </table></div> : <div className="empty-state"><h3>No transfers yet</h3><p>When you dispatch or are assigned a device transfer, it will appear here.</p></div>}
      </section>
    </div>
  );
}
