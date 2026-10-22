import { useCallback, useEffect, useState } from "react";
import { Search, ShieldCheck, XCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../services/api";

const title = (value) => value?.replaceAll("_", " ") || "Lifecycle event";

export default function OrganizationLedger() {
  const [searchParams] = useSearchParams();
  const [deviceId, setDeviceId] = useState(searchParams.get("deviceId") || "");
  const [data, setData] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(Boolean(searchParams.get("deviceId")));
  const [error, setError] = useState("");

  const load = useCallback(async (id) => {
    if (!id.trim()) { setError("Enter a device ID."); return; }
    try {
      const result = await apiRequest(`/organization-portal/devices/${encodeURIComponent(id.trim())}/tracking`);
      setDeviceId(id);
      setData(result);
      setVerification(null);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load lifecycle.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const id = searchParams.get("deviceId");
    if (id) void Promise.resolve().then(() => load(id));
  }, [searchParams, load]);

  async function verify() {
    if (!data?.device?.id) return;
    setLoading(true); setError("");
    try {
      setVerification(await apiRequest(`/organization-portal/devices/${data.device.id}/verify`));
    } catch (err) {
      setError(err.message || "Ledger verification failed to run.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="org-page">
      <div className="dashboard-intro"><div><h2>Lifecycle ledger</h2><p>Readable event history first; hash-chain details are available on demand.</p></div></div>
      <form className="org-ledger-search" onSubmit={(event) => { event.preventDefault(); setLoading(true); setError(""); setData(null); void load(deviceId); }}>
        <Search size={17} /><input aria-label="Device ID" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="Enter device UUID" />
        <button className="submit-button" disabled={loading}>{loading ? "Loading..." : "View lifecycle"}</button>
      </form>
      {error && <div className="error-banner" role="alert"><p>{error}</p><button onClick={() => { setLoading(true); void load(deviceId); }}>Try again</button></div>}
      {data && <>
        <section className="tracked-device-card">
          <div className="tracked-device-icon"><ShieldCheck size={24} /></div>
          <div className="tracked-device-info"><p className="eyebrow">DEVICE</p><h2>{data.device.brand} {data.device.model}</h2><p>{data.device.id}</p><p>Current state: {title(data.device.currentStatus)}</p></div>
          <button className="refresh-button" onClick={verify} disabled={loading}><ShieldCheck size={16} /> Verify ledger</button>
        </section>
        {verification && <section className={`org-verification ${verification.valid ? "valid" : "invalid"}`}>
          {verification.valid ? <ShieldCheck size={20} /> : <XCircle size={20} />}
          <div><strong>{verification.valid ? "Ledger chain verified" : "Ledger verification failed"}</strong><p>{verification.totalEntries} entries checked. Hash-linked records show consistency at the time of verification; this does not independently prove physical custody.</p>
            {!!verification.errors?.length && <ul>{verification.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
          </div>
        </section>}
        <section className="dashboard-section">
          <div className="section-heading"><div><h2>Lifecycle timeline</h2><p>{data.timeline.length} recorded events, chronological</p></div></div>
          {data.timeline.length ? <div className="timeline org-timeline">{data.timeline.map((event) => <article className="timeline-item" key={event.eventId}>
            <div className="timeline-marker"><ShieldCheck size={16} /></div><div className="timeline-content">
              <div className="timeline-event-heading"><h3>{title(event.eventType)}</h3><time>{new Date(event.timestamp).toLocaleString("en-IN")}</time></div>
              {event.organization && <p>Organisation: {event.organization.name}</p>}
              {event.fromOrganization && <p>From: {event.fromOrganization.name}</p>}
              {event.toOrganization && <p>To: {event.toOrganization.name}</p>}
              {event.remarks && <p>{event.remarks}</p>}
              {event.recovery?.materials?.map((item, index) => <p key={`${item.materialType}-${index}`}>Recovered: {item.materialType} · {Number(item.quantity)} {item.unit} · {item.condition.toLowerCase()}</p>)}
              {event.disposal && <p>Waste: {event.disposal.wasteDescription} · {event.disposal.quantity ?? "Quantity not recorded"} {event.disposal.unit || ""} · {event.disposal.disposalMethod.replaceAll("_", " ")}</p>}
              {event.ledger && <details className="ledger-details"><summary>View hash-chain details</summary><div><span>Previous hash</span><code>{event.ledger.previousHash || "Genesis entry"}</code><span>Current hash</span><code>{event.ledger.currentHash}</code></div></details>}
            </div>
          </article>)}</div> : <div className="empty-state"><h3>No lifecycle events</h3><p>No events have been recorded for this device.</p></div>}
        </section>
      </>}
    </div>
  );
}
