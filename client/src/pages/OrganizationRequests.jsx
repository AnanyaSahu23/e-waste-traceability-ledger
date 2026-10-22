import { useCallback, useEffect, useState } from "react";
import { Check, Filter, RefreshCw, X } from "lucide-react";
import { apiRequest } from "../services/api";

const date = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function OrganizationRequests() {
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [requestData, categoryData] = await Promise.all([
        apiRequest(`/organization-portal/requests${params.size ? `?${params}` : ""}`),
        apiRequest("/device-categories"),
      ]);
      setRequests(requestData.requests || []);
      setCategories(categoryData.categories || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load incoming requests.");
    } finally {
      setLoading(false);
    }
  }, [status, categoryId, from, to]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function decide(request, decision) {
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/organization-portal/requests/${request.id}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      setNotice(`Request ${decision.toLowerCase()} successfully.`);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not update request.");
    } finally {
      setBusyId("");
    }
  }

  async function receive(request) {
    if (!window.confirm("Confirm that the device has been physically handed over to your organisation? This records receipt in its lifecycle.")) return;
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/organization-portal/requests/${request.id}/receive`, { method: "POST" });
      setNotice("Physical receipt recorded in the device lifecycle.");
      await load();
    } catch (err) {
      setError(err.message || "Could not record physical receipt.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="org-page">
      <div className="dashboard-intro">
        <div><h2>Incoming Recycling Requests</h2><p>Review requests assigned to your organisation. Acceptance is not physical custody.</p></div>
        <button className="refresh-button" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </div>
      {error && <div className="error-banner" role="alert"><p>{error}</p><button onClick={load}>Try again</button></div>}
      {notice && <div className="form-message success-message" role="status">{notice}</div>}
      <section className="dashboard-section">
        <div className="org-filter-row">
          <span><Filter size={16} /> Filters</span>
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            {["PENDING", "ACCEPTED", "SCHEDULED", "IN_PROGRESS", "COLLECTED", "REJECTED", "CANCELLED"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filter by category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
          <input aria-label="Requests from date" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          <input aria-label="Requests to date" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </div>
        {loading ? <div className="org-loading">Loading requests...</div> : requests.length ? (
          <div className="table-container"><table className="data-table">
            <thead><tr><th>Request / device</th><th>Owner</th><th>Method & pickup</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request.id}>
                <td><strong>{request.device.brand} {request.device.model}</strong><br />{request.device.category?.name || "Device"}<br /><small>{request.id}</small></td>
                <td>{request.device.owner?.name || "Device owner"}</td>
                <td>{request.collectionMethod.replaceAll("_", " ")}<br /><small>{request.pickupRequest?.pickupAddress || "Drop-off / address not supplied"}</small></td>
                <td>{date(request.createdAt)}</td>
                <td><span className={`status-pill status-${request.status.toLowerCase()}`}>{request.status.replaceAll("_", " ")}</span></td>
                <td className="org-action-cell">
                  <button className="table-link-button" onClick={() => setSelected(request)}>Details</button>
                  {request.status === "PENDING" && <>
                    <button className="icon-action accept" title="Accept request" disabled={busyId === request.id} onClick={() => decide(request, "ACCEPTED")}><Check size={16} /></button>
                    <button className="icon-action reject" title="Reject request" disabled={busyId === request.id} onClick={() => decide(request, "REJECTED")}><X size={16} /></button>
                  </>}
                  {request.status === "ACCEPTED" && <button className="table-link-button" disabled={busyId === request.id} onClick={() => receive(request)}>Record receipt</button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><Filter size={26} /><h3>No matching requests</h3><p>Try changing the filters or check back when a user submits a request.</p></div>}
      </section>
      {selected && <div className="org-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
        <section className="org-modal" role="dialog" aria-modal="true" aria-labelledby="request-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="section-heading"><div><p className="eyebrow">REQUEST DETAILS</p><h2 id="request-detail-title">{selected.device.brand} {selected.device.model}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18} /></button></div>
          <dl className="org-detail-list">
            <dt>Request ID</dt><dd>{selected.id}</dd>
            <dt>Device ID</dt><dd>{selected.device.id}</dd>
            <dt>Category</dt><dd>{selected.device.category?.name || "—"}</dd>
            <dt>Device owner</dt><dd>{selected.device.owner?.name || "—"}</dd>
            <dt>Current device status</dt><dd>{selected.device.currentStatus.replaceAll("_", " ")}</dd>
            <dt>Request status</dt><dd>{selected.status.replaceAll("_", " ")}</dd>
            <dt>Pickup address</dt><dd>{selected.pickupRequest?.pickupAddress || "Not provided"}</dd>
            <dt>Requested pickup</dt><dd>{date(selected.pickupRequest?.requestedDate)}</dd>
            <dt>Scheduled pickup</dt><dd>{date(selected.pickupRequest?.scheduledDate)}</dd>
          </dl>
          {selected.status === "PENDING" && <div className="org-modal-actions">
            <button className="submit-button" onClick={() => decide(selected, "ACCEPTED")} disabled={Boolean(busyId)}>Accept</button>
            <button className="danger-button" onClick={() => decide(selected, "REJECTED")} disabled={Boolean(busyId)}>Reject</button>
          </div>}
        </section>
      </div>}
    </div>
  );
}
