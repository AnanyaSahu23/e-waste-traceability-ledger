
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  RefreshCw,
  XCircle,
  CalendarDays,
  Package,
  MapPin,
  Building2,
  Clock,
} from "lucide-react";
import { apiRequest } from "../services/api";

const statusClass = (status) =>
  `request-status status-${(status || "pending").toLowerCase()}`;

const formatDate = (value) => {
  if (!value) return "Not scheduled";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getErrorMessage = (error) =>
  error.message || "Something went wrong. Please try again.";

function RecyclingRequests() {
  const [requests, setRequests] = useState([]);
  const [devices, setDevices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    deviceId: "",
    organizationId: "",
    pickupAddress: "",
    requestedDate: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [requestData, deviceData] = await Promise.all([
        apiRequest("/recycling-requests"),
        apiRequest("/devices"),
      ]);

      setRequests(requestData.requests || []);
      setDevices(deviceData.devices || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const requestedDate = new Date(form.requestedDate);

      if (requestedDate <= new Date()) {
        throw new Error("Choose a future pickup date and time.");
      }

      await apiRequest("/recycling-requests", {
        method: "POST",
        body: JSON.stringify({
          deviceId: form.deviceId,
          organizationId: form.organizationId.trim(),
          pickupAddress: form.pickupAddress.trim(),
          requestedDate: requestedDate.toISOString(),
        }),
      });

      setSuccess("Recycling request created successfully.");
      setForm({
        deviceId: "",
        organizationId: "",
        pickupAddress: "",
        requestedDate: "",
      });
      setShowForm(false);

      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this recycling request?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setCancellingId(requestId);

    try {
      await apiRequest(
        `/recycling-requests/${requestId}/cancel`,
        { method: "PATCH" }
      );

      setSuccess("Recycling request cancelled successfully.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  const activeCount = requests.filter((request) =>
    ["PENDING", "ACCEPTED", "SCHEDULED"].includes(request.status)
  ).length;

  const completedCount = requests.filter((request) =>
    ["COMPLETED"].includes(request.status)
  ).length;

  const canCancel = (request) =>
    ["PENDING", "ACCEPTED", "SCHEDULED"].includes(request.status) &&
    request.pickupRequest?.status !== "COMPLETED";

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">COLLECTION MANAGEMENT</p>
          <h1>Recycling Requests</h1>
          <p className="page-description">
            Request pickup for your registered e-waste devices and track
            the progress of each request.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm((previous) => !previous);
          }}
        >
          {showForm ? <XCircle size={18} /> : <Plus size={18} />}
          {showForm ? "Close Form" : "New Request"}
        </button>
      </div>

      {error && (
        <div className="request-alert request-alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="request-alert request-alert-success">
          {success}
        </div>
      )}

      <div className="request-summary">
        <div className="request-summary-card">
          <span>Total requests</span>
          <strong>{requests.length}</strong>
        </div>

        <div className="request-summary-card">
          <span>Active requests</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="request-summary-card">
          <span>Completed requests</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      {showForm && (
        <section className="request-form-card">
          <div className="request-section-heading">
            <div>
              <h2>Create a recycling request</h2>
              <p>Enter your device and pickup details.</p>
            </div>
          </div>

          {devices.length === 0 ? (
            <p className="request-empty">
              You have no registered devices.{" "}
              <Link to="/register-device">Register a device first.</Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="request-form">
              <div className="request-field">
                <label htmlFor="deviceId">Device</label>
                <select
                  id="deviceId"
                  name="deviceId"
                  value={form.deviceId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a device</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.brand} {device.model}
                      {device.serialNumber
                        ? ` — ${device.serialNumber}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="request-field">
                <label htmlFor="organizationId">
                  Collection organization ID
                </label>
                <input
                  id="organizationId"
                  name="organizationId"
                  value={form.organizationId}
                  onChange={handleChange}
                  placeholder="Enter the organization UUID"
                  required
                />
                <small>
                  Enter the ID of the organization that will collect your
                  device.
                </small>
              </div>

              <div className="request-field">
                <label htmlFor="pickupAddress">Pickup address</label>
                <textarea
                  id="pickupAddress"
                  name="pickupAddress"
                  value={form.pickupAddress}
                  onChange={handleChange}
                  placeholder="Enter the complete pickup address"
                  rows={3}
                  required
                />
              </div>

              <div className="request-field">
                <label htmlFor="requestedDate">
                  Requested pickup date and time
                </label>
                <input
                  id="requestedDate"
                  name="requestedDate"
                  type="datetime-local"
                  value={form.requestedDate}
                  onChange={handleChange}
                  min={new Date(Date.now() + 60000)
                    .toISOString()
                    .slice(0, 16)}
                  required
                />
              </div>

              <div className="request-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <div className="request-list-heading">
        <div>
          <h2>Your requests</h2>
          <p>View the status and pickup details of your requests.</p>
        </div>

        <button
          className="icon-button"
          onClick={loadData}
          disabled={loading}
          title="Refresh requests"
          aria-label="Refresh requests"
        >
          <RefreshCw size={18} className={loading ? "spin-icon" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="request-empty">Loading your requests...</div>
      ) : requests.length === 0 ? (
        <div className="request-empty">
          <Package size={36} />
          <h3>No recycling requests yet</h3>
          <p>Create a request when you are ready to recycle a device.</p>
          <button
            className="primary-button"
            onClick={() => setShowForm(true)}
          >
            <Plus size={18} />
            Create your first request
          </button>
        </div>
      ) : (
        <div className="request-list">
          {requests.map((request) => {
            const pickup = request.pickupRequest;
            const device = request.device;
            const organization = request.organization;

            return (
              <article className="recycling-request-card" key={request.id}>
                <div className="recycling-request-top">
                  <div className="request-device">
                    <div className="request-device-icon">
                      <Package size={22} />
                    </div>

                    <div>
                      <h3>
                        {device?.brand || "Unknown brand"}{" "}
                        {device?.model || "Device"}
                      </h3>
                      <p>
                        {device?.serialNumber
                          ? `Serial: ${device.serialNumber}`
                          : `Device ID: ${device?.id || "—"}`}
                      </p>
                    </div>
                  </div>

                  <span className={statusClass(request.status)}>
                    {(request.status || "UNKNOWN").replaceAll("_", " ")}
                  </span>
                </div>

                <div className="request-details-grid">
                  <div className="request-detail">
                    <Building2 size={17} />
                    <div>
                      <span>Collection organization</span>
                      <strong>
                        {organization?.name ||
                          organization?.organizationName ||
                          "Organization"}
                      </strong>
                    </div>
                  </div>

                  <div className="request-detail">
                    <CalendarDays size={17} />
                    <div>
                      <span>Requested pickup</span>
                      <strong>{formatDate(pickup?.requestedDate)}</strong>
                    </div>
                  </div>

                  <div className="request-detail">
                    <Clock size={17} />
                    <div>
                      <span>Scheduled pickup</span>
                      <strong>{formatDate(pickup?.scheduledDate)}</strong>
                    </div>
                  </div>

                  <div className="request-detail">
                    <MapPin size={17} />
                    <div>
                      <span>Pickup address</span>
                      <strong>{pickup?.pickupAddress || "Not provided"}</strong>
                    </div>
                  </div>
                </div>

                <div className="recycling-request-footer">
                  <div className="pickup-status-line">
                    <span>Pickup status</span>
                    <span className={statusClass(pickup?.status)}>
                      {(pickup?.status || "UNKNOWN").replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="request-actions">
                    <Link
                      className="secondary-button"
                      to={`/track-device?deviceId=${device?.id || ""}`}
                    >
                      Track device
                    </Link>

                    {canCancel(request) && (
                      <button
                        className="danger-button"
                        onClick={() => handleCancel(request.id)}
                        disabled={cancellingId === request.id}
                      >
                        {cancellingId === request.id
                          ? "Cancelling..."
                          : "Cancel request"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RecyclingRequests;