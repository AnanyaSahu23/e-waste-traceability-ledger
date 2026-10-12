import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Truck,
  Recycle,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "../services/api";

const eventLabels = {
  REGISTERED: "Device registered",
  COLLECTED: "Device collected",
  IN_TRANSIT: "In transit",
  RECEIVED: "Received at facility",
  INSPECTED: "Device inspected",
  MATERIAL_RECOVERY: "Material recovery",
  DISPOSAL: "Disposal recorded",
  COMPLETED: "Recycling completed",
};

function getEventIcon(type) {
  if (type === "IN_TRANSIT") return Truck;
  if (["MATERIAL_RECOVERY", "COMPLETED"].includes(type)) return Recycle;
  if (type === "REGISTERED") return Package;
  return Clock;
}

export default function TrackDevice() {
  const [searchParams] = useSearchParams();
  const [deviceId, setDeviceId] = useState(
    searchParams.get("deviceId") || ""
  );
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTracking(id = deviceId) {
    const trimmedId = id.trim();

    if (!trimmedId) {
      setError("Enter a device ID to track.");
      return;
    }

    setLoading(true);
    setError("");
    setTracking(null);

    try {
      const data = await apiRequest(
        `/tracking/${encodeURIComponent(trimmedId)}`
      );
      setTracking(data);
    } catch (err) {
      setError(err.message || "Failed to retrieve device tracking.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = searchParams.get("deviceId");
    if (id) {
      setDeviceId(id);
      loadTracking(id);
    }
  }, [searchParams]);

  const device = tracking?.device;
  const timeline = tracking?.timeline || [];
  const verification = tracking?.ledgerVerification;

  return (
    <div className="page tracking-page">
      <div className="tracking-intro">
        <h2>Device Lifecycle</h2>
        <p>
          Follow a device from registration through collection and recycling,
          with cryptographic ledger verification.
        </p>
      </div>

      <form
        className="tracking-search"
        onSubmit={(event) => {
          event.preventDefault();
          loadTracking();
        }}
      >
        <Search size={19} />
        <input
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          placeholder="Enter device UUID"
          aria-label="Device ID"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Track Device"}
        </button>
      </form>

      {error && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
          <button onClick={() => loadTracking()}>Try again</button>
        </div>
      )}

      {loading && (
        <div className="tracking-placeholder">
          <RefreshCw size={20} />
          <p>Loading tracking history...</p>
        </div>
      )}

      {!loading && device && (
        <>
          <section className="tracked-device-card">
            <div className="tracked-device-icon">
              <Package size={27} />
            </div>

            <div className="tracked-device-info">
              <p className="eyebrow">DEVICE DETAILS</p>
              <h2>
                {[device.brand, device.model].filter(Boolean).join(" ") ||
                  "Unnamed device"}
              </h2>
              <p>
                Category: {device.category?.name || "Electronic device"}
              </p>
              <p>Device ID: {device.id}</p>
              {device.serialNumber && (
                <p>Serial number: {device.serialNumber}</p>
              )}
            </div>

            <span className="status-pill">
              {(device.currentStatus || "UNKNOWN").replaceAll("_", " ")}
            </span>
          </section>

          <section className="ledger-status-card">
            <div className="ledger-status-icon">
              {verification?.valid ? (
                <ShieldCheck size={24} />
              ) : (
                <XCircle size={24} />
              )}
            </div>

            <div className="ledger-status-info">
              <h3>
                {verification?.valid
                  ? "Ledger integrity verified"
                  : "Ledger verification failed"}
              </h3>
              <p>
                {verification?.totalEntries ?? 0} ledger entries checked
              </p>
              {verification?.errors?.length > 0 && (
                <ul>
                  {verification.errors.map((message, index) => (
                    <li key={`${index}-${message}`}>{message}</li>
                  ))}
                </ul>
              )}
            </div>

            <button
              className="refresh-button"
              onClick={() => loadTracking(device.id)}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Verify again
            </button>
          </section>

          <section className="timeline-section">
            <div className="section-heading">
              <div>
                <h2>Lifecycle Timeline</h2>
                <p>Recorded events in chronological order.</p>
              </div>
              <span className="timeline-count">
                {timeline.length} events
              </span>
            </div>

            {timeline.length === 0 ? (
              <div className="empty-state">
                <Clock size={28} />
                <h3>No events recorded</h3>
                <p>This device does not have any tracking events yet.</p>
              </div>
            ) : (
              <div className="timeline">
                {timeline.map((event, index) => {
                  const Icon = getEventIcon(event.eventType);

                  return (
                    <article className="timeline-item" key={event.eventId}>
                      <div className="timeline-marker">
                        <Icon size={18} />
                      </div>

                      <div className="timeline-content">
                        <div className="timeline-event-heading">
                          <h3>
                            {eventLabels[event.eventType] ||
                              event.eventType.replaceAll("_", " ")}
                          </h3>
                          <time>
                            {event.timestamp
                              ? new Date(event.timestamp).toLocaleString()
                              : "Time unavailable"}
                          </time>
                        </div>

                        {event.organization && (
                          <p>
                            Organization:{" "}
                            {event.organization.name || event.organization.id}
                          </p>
                        )}

                        {event.fromOrganization && (
                          <p>
                            From:{" "}
                            {event.fromOrganization.name ||
                              event.fromOrganization.id}
                          </p>
                        )}

                        {event.toOrganization && (
                          <p>
                            To:{" "}
                            {event.toOrganization.name ||
                              event.toOrganization.id}
                          </p>
                        )}

                        {event.remarks && <p>{event.remarks}</p>}

                        {event.ledger && (
                          <details className="ledger-details">
                            <summary>
                              <CheckCircle2 size={14} />
                              View ledger hashes
                            </summary>
                            <div>
                              <span>Entry ID</span>
                              <code>{event.ledger.entryId}</code>
                              <span>Previous hash</span>
                              <code>
                                {event.ledger.previousHash || "Genesis entry"}
                              </code>
                              <span>Current hash</span>
                              <code>{event.ledger.currentHash}</code>
                            </div>
                          </details>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}