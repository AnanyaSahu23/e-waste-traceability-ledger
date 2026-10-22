import { useCallback, useEffect, useRef, useState } from "react";
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

function getIdempotencyKey(reference, payload) {
  const fingerprint = JSON.stringify(payload);
  if (reference.current?.fingerprint !== fingerprint) {
    reference.current = {
      fingerprint,
      key: crypto.randomUUID(),
    };
  }
  return reference.current.key;
}

export default function TrackDevice() {
  const [searchParams] = useSearchParams();
  const [deviceId, setDeviceId] = useState(
    searchParams.get("deviceId") || ""
  );
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const recoveryKey = useRef(null);
  const disposalKey = useRef(null);
  const [recoveryRemarks, setRecoveryRemarks] = useState("");
  const [recoveryMaterials, setRecoveryMaterials] = useState([
    { materialType: "", quantity: "", unit: "kg", condition: "RECYCLABLE" },
  ]);
  const [disposal, setDisposal] = useState({
    wasteDescription: "",
    disposalMethod: "AUTHORIZED_TREATMENT",
    quantity: "",
    unit: "kg",
    facilityName: "",
    hazardous: true,
    disposalDate: "",
    remarks: "",
  });

  const loadTracking = useCallback(async (id) => {
    const trimmedId = typeof id === "string" ? id.trim() : "";

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
  }, []);

  useEffect(() => {
    const id = searchParams.get("deviceId");
    if (id) {
      void Promise.resolve().then(() => {
        setDeviceId(id);
        return loadTracking(id);
      });
    }
  }, [loadTracking, searchParams]);

  const device = tracking?.device;
  const timeline = tracking?.timeline || [];
  const verification = tracking?.ledgerVerification;

  function updateRecoveryMaterial(index, field, value) {
    setRecoveryMaterials((current) =>
      current.map((material, materialIndex) =>
        materialIndex === index
          ? { ...material, [field]: value }
          : material
      )
    );
  }

  async function submitRecovery(event) {
    event.preventDefault();
    if (!device) return;
    setSavingAction(true);
    setActionError("");
    setActionMessage("");
    try {
      const payload = {
        remarks: recoveryRemarks,
        materials: recoveryMaterials.map((material) => ({
          ...material,
          quantity: Number(material.quantity),
        })),
      };
      const idempotencyKey = getIdempotencyKey(recoveryKey, {
        deviceId: device.id,
        ...payload,
      });
      await apiRequest(`/devices/${encodeURIComponent(device.id)}/material-recovery`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      setActionMessage("Recovery operation recorded and added to the ledger.");
      recoveryKey.current = null;
      setRecoveryRemarks("");
      setRecoveryMaterials([
        { materialType: "", quantity: "", unit: "kg", condition: "RECYCLABLE" },
      ]);
      await loadTracking(device.id);
    } catch (err) {
      setActionError(err.message || "Failed to record material recovery.");
    } finally {
      setSavingAction(false);
    }
  }

  async function submitDisposal(event) {
    event.preventDefault();
    if (!device) return;
    setSavingAction(true);
    setActionError("");
    setActionMessage("");
    try {
      const payload = {
        ...disposal,
        quantity: Number(disposal.quantity),
        disposalDate: new Date(disposal.disposalDate).toISOString(),
      };
      const idempotencyKey = getIdempotencyKey(disposalKey, {
        deviceId: device.id,
        ...payload,
      });
      await apiRequest(`/devices/${encodeURIComponent(device.id)}/disposal`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      setActionMessage(
        "Waste stream recorded. The device remains in its current processing status."
      );
      setDisposal((current) => ({
        ...current,
        wasteDescription: "",
        quantity: "",
        facilityName: "",
        remarks: "",
      }));
      disposalKey.current = null;
      await loadTracking(device.id);
    } catch (err) {
      setActionError(err.message || "Failed to record disposal.");
    } finally {
      setSavingAction(false);
    }
  }

  return (
    <div className="page tracking-page">
      <div className="tracking-intro">
        <h1>Track Device</h1>
        <p>
          Follow a device from registration through collection and recycling,
          with cryptographic ledger verification.
        </p>
      </div>

      <form
        className="tracking-search"
        onSubmit={(event) => {
          event.preventDefault();
          loadTracking(deviceId);
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
          <button onClick={() => loadTracking(deviceId)}>Try again</button>
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
          {(actionError || actionMessage) && (
            <div
              className={`action-notice ${actionError ? "error-banner" : "success-message"}`}
              role={actionError ? "alert" : "status"}
            >
              {actionError || actionMessage}
            </div>
          )}

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

          {["UNDER_INSPECTION", "MATERIAL_RECOVERY"].includes(
            device.currentStatus
          ) && (
            <section className="processing-section">
              <div className="section-heading">
                <div>
                  <h2>Material recovery and disposal</h2>
                  <p>
                    Record recovered materials and each waste stream separately.
                    Disposal does not mark the whole device as complete.
                  </p>
                </div>
              </div>

              <div className="processing-grid">
                <form className="processing-card" onSubmit={submitRecovery}>
                  <h3>Record material recovery</h3>
                  {recoveryMaterials.map((material, index) => (
                    <div className="material-entry" key={index}>
                      <label>
                        Material
                        <input
                          required
                          maxLength={100}
                          value={material.materialType}
                          onChange={(event) =>
                            updateRecoveryMaterial(
                              index,
                              "materialType",
                              event.target.value
                            )
                          }
                          placeholder="Copper"
                        />
                      </label>
                      <label>
                        Quantity
                        <input
                          required
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={material.quantity}
                          onChange={(event) =>
                            updateRecoveryMaterial(
                              index,
                              "quantity",
                              event.target.value
                            )
                          }
                          placeholder="0.4"
                        />
                      </label>
                      <label>
                        Unit
                        <select
                          value={material.unit}
                          onChange={(event) =>
                            updateRecoveryMaterial(
                              index,
                              "unit",
                              event.target.value
                            )
                          }
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="pieces">pieces</option>
                          <option value="litres">litres</option>
                        </select>
                      </label>
                      <label>
                        Condition
                        <select
                          value={material.condition}
                          onChange={(event) =>
                            updateRecoveryMaterial(
                              index,
                              "condition",
                              event.target.value
                            )
                          }
                        >
                          <option value="REUSABLE">Reusable</option>
                          <option value="RECYCLABLE">Recyclable</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>
                      {recoveryMaterials.length > 1 && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            setRecoveryMaterials((current) =>
                              current.filter((_, materialIndex) => materialIndex !== index)
                            )
                          }
                        >
                          Remove material
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setRecoveryMaterials((current) => [
                        ...current,
                        {
                          materialType: "",
                          quantity: "",
                          unit: "kg",
                          condition: "RECYCLABLE",
                        },
                      ])
                    }
                    disabled={recoveryMaterials.length >= 50}
                  >
                    Add another material
                  </button>
                  <label>
                    Remarks
                    <textarea
                      maxLength={2000}
                      value={recoveryRemarks}
                      onChange={(event) => setRecoveryRemarks(event.target.value)}
                      placeholder="Optional recovery notes"
                    />
                  </label>
                  <button type="submit" disabled={savingAction}>
                    {savingAction ? "Saving..." : "Record recovery"}
                  </button>
                </form>

                <form className="processing-card" onSubmit={submitDisposal}>
                  <h3>Record a waste stream</h3>
                  <label>
                    Waste description
                    <input
                      required
                      maxLength={500}
                      value={disposal.wasteDescription}
                      onChange={(event) =>
                        setDisposal({ ...disposal, wasteDescription: event.target.value })
                      }
                      placeholder="Damaged lithium-ion battery"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Quantity
                      <input
                        required
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={disposal.quantity}
                        onChange={(event) =>
                          setDisposal({ ...disposal, quantity: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Unit
                      <select
                        value={disposal.unit}
                        onChange={(event) =>
                          setDisposal({ ...disposal, unit: event.target.value })
                        }
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="pieces">pieces</option>
                        <option value="litres">litres</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Disposal method
                    <select
                      value={disposal.disposalMethod}
                      onChange={(event) =>
                        setDisposal({ ...disposal, disposalMethod: event.target.value })
                      }
                    >
                      <option value="AUTHORIZED_TREATMENT">Authorized treatment</option>
                      <option value="RECYCLING">Recycling</option>
                      <option value="LANDFILL">Landfill</option>
                      <option value="INCINERATION">Incineration</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={disposal.hazardous}
                      onChange={(event) =>
                        setDisposal({
                          ...disposal,
                          hazardous: event.target.checked,
                          disposalMethod: event.target.checked
                            ? "AUTHORIZED_TREATMENT"
                            : disposal.disposalMethod,
                        })
                      }
                    />
                    Hazardous waste
                  </label>
                  <label>
                    Receiving facility{disposal.hazardous ? " (required)" : ""}
                    <input
                      required={disposal.hazardous}
                      maxLength={200}
                      value={disposal.facilityName}
                      onChange={(event) =>
                        setDisposal({ ...disposal, facilityName: event.target.value })
                      }
                      placeholder="Authorized treatment facility"
                    />
                  </label>
                  <label>
                    Disposal date and time
                    <input
                      required
                      type="datetime-local"
                      value={disposal.disposalDate}
                      onChange={(event) =>
                        setDisposal({ ...disposal, disposalDate: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Remarks
                    <textarea
                      maxLength={2000}
                      value={disposal.remarks}
                      onChange={(event) =>
                        setDisposal({ ...disposal, remarks: event.target.value })
                      }
                      placeholder="Optional disposal notes"
                    />
                  </label>
                  <button type="submit" disabled={savingAction}>
                    {savingAction ? "Saving..." : "Record waste stream"}
                  </button>
                </form>
              </div>
            </section>
          )}

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
                {timeline.map((event) => {
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

                        {event.recovery?.materials?.length > 0 && (
                          <div className="event-details">
                            <strong>Recovered materials</strong>
                            <ul>
                              {event.recovery.materials.map((material, materialIndex) => (
                                <li key={`${material.materialType}-${materialIndex}`}>
                                  {material.materialType}: {material.quantity} {material.unit} ·{" "}
                                  {material.condition.toLowerCase()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {event.disposal && (
                          <div className="event-details">
                            <strong>Waste stream</strong>
                            <p>
                              {event.disposal.wasteDescription}
                              {event.disposal.quantity !== null &&
                                ` · ${event.disposal.quantity} ${event.disposal.unit}`}
                            </p>
                            <p>
                              Method: {event.disposal.disposalMethod.replaceAll("_", " ")}
                              {event.disposal.hazardous ? " · Hazardous" : ""}
                            </p>
                            {event.disposal.facilityName && (
                              <p>Facility: {event.disposal.facilityName}</p>
                            )}
                          </div>
                        )}

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