import { useEffect, useState } from "react";
import {
Laptop,
Clock3,
CheckCircle2,
Activity,
ArrowRight,
RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api";

function getArray(data, key) {
if (Array.isArray(data)) return data;
if (Array.isArray(data?.[key])) return data[key];
return [];
}

function Dashboard() {
const [devices, setDevices] = useState([]);
const [requests, setRequests] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

async function loadDashboard() {
setLoading(true);
setError("");

try {
  const [deviceData, requestData] = await Promise.all([
    apiRequest("/devices"),
    apiRequest("/recycling-requests"),
  ]);

  setDevices(getArray(deviceData, "devices"));
  setRequests(getArray(requestData, "requests"));
} catch (err) {
  setError(err.message || "Could not load dashboard data.");
} finally {
  setLoading(false);
}

}

useEffect(() => {
loadDashboard();
}, []);

const pendingRequests = requests.filter((request) =>
["PENDING", "ACCEPTED", "SCHEDULED"].includes(
request.status?.toUpperCase()
)
).length;

const completedDevices = devices.filter((device) =>
["COMPLETED", "RECYCLED"].includes(
device.currentStatus?.toUpperCase()
)
).length;

const recentDevices = [...devices]
.sort(
(a, b) =>
new Date(b.createdAt || 0).getTime() -
new Date(a.createdAt || 0).getTime()
)
.slice(0, 5);

const stats = [
{
label: "Registered Devices",
value: devices.length,
icon: Laptop,
color: "green",
},
{
label: "Active Requests",
value: pendingRequests,
icon: Clock3,
color: "orange",
},
{
label: "Completed Devices",
value: completedDevices,
icon: CheckCircle2,
color: "blue",
},
{
label: "Recorded Devices",
value: devices.length,
icon: Activity,
color: "purple",
},
];

return ( <div className="page dashboard"> <div className="dashboard-intro"> <div> <h1>Dashboard</h1> <p>
Monitor your registered devices and their recycling progress. </p> </div>

    <button
      className="refresh-button"
      onClick={loadDashboard}
      disabled={loading}
    >
      <RefreshCw size={16} />
      Refresh
    </button>
  </div>

  {error && (
    <div className="error-banner">
      <p>{error}</p>
      <button onClick={loadDashboard}>Try again</button>
    </div>
  )}

  <div className="stats-grid">
    {stats.map(({ label, value, icon: Icon, color }) => (
      <div className="stat-card" key={label}>
        <div className={`stat-icon ${color}`}>
          <Icon size={21} />
        </div>
        <p>{label}</p>
        <h3>{loading ? "—" : value}</h3>
      </div>
    ))}
  </div>

  <div className="dashboard-section">
    <div className="section-heading">
      <div>
        <h2>Recently Registered Devices</h2>
        <p>Your latest device registrations.</p>
      </div>

      <Link to="/devices" className="text-link">
        View all <ArrowRight size={16} />
      </Link>
    </div>

    <div className="table-container">
      {loading ? (
        <p className="empty-state">Loading devices...</p>
      ) : recentDevices.length === 0 ? (
        <div className="empty-state">
          <Laptop size={30} />
          <h3>No devices yet</h3>
          <p>Register your first device to begin tracking its lifecycle.</p>
          <Link to="/register-device" className="primary-link">
            Register a device
          </Link>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Serial Number</th>
              <th>Registered</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentDevices.map((device) => (
              <tr key={device.id}>
                <td>
                  <strong>
                    {[device.brand, device.model]
                      .filter(Boolean)
                      .join(" ") || "Unnamed device"}
                  </strong>
                </td>
                <td>{device.serialNumber || "—"}</td>
                <td>
                  {device.createdAt
                    ? new Date(device.createdAt).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  <span className="status-pill">
                    {(device.currentStatus || "UNKNOWN").replaceAll(
                      "_",
                      " "
                    )}
                  </span>
                </td>
                <td>
                  <Link
                    to={`/track-device?deviceId=${device.id}`}
                    className="table-link"
                  >
                    Track
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
</div>

);
}

export default Dashboard;
