import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Laptop, Plus, RefreshCw, Search } from "lucide-react";
import { apiRequest } from "../services/api";

export default function Devices() {
const [devices, setDevices] = useState([]);
const [search, setSearch] = useState("");
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

async function loadDevices() {
setLoading(true);
setError("");

try {
  const data = await apiRequest("/devices");
  setDevices(Array.isArray(data.devices) ? data.devices : []);
} catch (err) {
  setError(err.message || "Failed to load devices.");
} finally {
  setLoading(false);
}

}

useEffect(() => {
loadDevices();
}, []);

const filteredDevices = devices.filter((device) => {
const searchableText = [
device.brand,
device.model,
device.serialNumber,
device.currentStatus,
device.category?.name,
]
.filter(Boolean)
.join(" ")
.toLowerCase();

return searchableText.includes(search.toLowerCase());

});

return ( <div className="page devices-page"> <div className="page-toolbar"> <div> <h1>My Devices</h1> <p>View and track the e-waste devices registered in the system.</p> </div>

    <Link to="/register-device" className="primary-link">
      <Plus size={16} />
      Register Device
    </Link>
  </div>

  <div className="devices-controls">
    <div className="search-box">
      <Search size={18} />
      <input
        type="text"
        placeholder="Search brand, model, serial number..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </div>

    <button
      className="refresh-button"
      onClick={loadDevices}
      disabled={loading}
    >
      <RefreshCw size={16} />
      Refresh
    </button>
  </div>

  {error && (
    <div className="error-banner">
      <p>{error}</p>
      <button onClick={loadDevices}>Try again</button>
    </div>
  )}

  <div className="devices-summary">
    <span>
      {loading
        ? "Loading devices..."
        : `${filteredDevices.length} device${filteredDevices.length === 1 ? "" : "s"} found`}
    </span>
  </div>

  {loading ? (
    <div className="empty-state">Loading devices...</div>
  ) : filteredDevices.length === 0 ? (
    <div className="empty-state device-empty">
      <Laptop size={32} />
      <h3>{search ? "No matching devices" : "No devices registered"}</h3>
      <p>
        {search
          ? "Try a different search term."
          : "Register a device to start tracking its recycling journey."}
      </p>
      {!search && (
        <Link to="/register-device" className="primary-link">
          <Plus size={16} />
          Register Device
        </Link>
      )}
    </div>
  ) : (
    <div className="devices-grid">
      {filteredDevices.map((device) => (
        <article className="device-card" key={device.id}>
          <div className="device-card-top">
            <div className="device-icon">
              <Laptop size={23} />
            </div>

            <span className="status-pill">
              {(device.currentStatus || "UNKNOWN").replaceAll("_", " ")}
            </span>
          </div>

          <h3>
            {[device.brand, device.model].filter(Boolean).join(" ") ||
              "Unnamed device"}
          </h3>

          <p className="device-category">
            {device.category?.name || "Electronic device"}
          </p>

          <div className="device-details">
            <div>
              <span>Serial number</span>
              <strong>{device.serialNumber || "Not provided"}</strong>
            </div>

            <div>
              <span>Manufacture year</span>
              <strong>{device.manufactureYear || "—"}</strong>
            </div>

            <div>
              <span>Registered on</span>
              <strong>
                {device.createdAt
                  ? new Date(device.createdAt).toLocaleDateString()
                  : "—"}
              </strong>
            </div>
          </div>

          <Link
            to={`/track-device?deviceId=${device.id}`}
            className="device-track-link"
          >
            Track lifecycle <span>→</span>
          </Link>
        </article>
      ))}
    </div>
  )}
</div>

);
}
