import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Laptop, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api";

const initialForm = {
  categoryId: "",
  brand: "",
  model: "",
  serialNumber: "",
  manufactureYear: "",
};

export default function RegisterDevice() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.categoryId.trim() || !form.brand.trim() || !form.model.trim()) {
      setError("Category ID, brand, and model are required.");
      return;
    }

    const year = form.manufactureYear.trim()
      ? Number(form.manufactureYear)
      : undefined;

    if (
      year !== undefined &&
      (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())
    ) {
      setError("Enter a valid manufacture year.");
      return;
    }

    const payload = {
      categoryId: form.categoryId.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      ...(form.serialNumber.trim()
        ? { serialNumber: form.serialNumber.trim() }
        : {}),
      ...(year !== undefined ? { manufactureYear: year } : {}),
    };

    setLoading(true);

    try {
      const data = await apiRequest("/devices", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(data.message || "Device registered successfully.");
      setForm(initialForm);

      // Give the user a moment to see the confirmation.
      setTimeout(() => {
        navigate("/devices");
      }, 800);
    } catch (err) {
      setError(err.message || "Failed to register device.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page register-page">
      <Link to="/devices" className="back-link">
        <ArrowLeft size={16} />
        Back to devices
      </Link>

      <div className="register-card">
        <div className="register-heading">
          <div className="register-icon">
            <Laptop size={25} />
          </div>

          <h2>Register a Device</h2>
          <p>
            Add an electronic device to the system to begin tracking its
            recycling lifecycle.
          </p>
        </div>

        {error && (
          <div className="form-message error-message" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="form-message success-message" role="status">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="categoryId">Category ID *</label>
            <input
              id="categoryId"
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              placeholder="Enter the device category UUID"
              required
            />
            <span className="field-hint">
              Use an existing category ID from your database.
            </span>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="brand">Brand *</label>
              <input
                id="brand"
                name="brand"
                value={form.brand}
                onChange={handleChange}
                placeholder="e.g. Dell"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="model">Model *</label>
              <input
                id="model"
                name="model"
                value={form.model}
                onChange={handleChange}
                placeholder="e.g. Latitude 5420"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="serialNumber">Serial Number</label>
            <input
              id="serialNumber"
              name="serialNumber"
              value={form.serialNumber}
              onChange={handleChange}
              placeholder="Enter serial number (optional)"
            />
          </div>

          <div className="form-field">
            <label htmlFor="manufactureYear">Manufacture Year</label>
            <input
              id="manufactureYear"
              name="manufactureYear"
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={form.manufactureYear}
              onChange={handleChange}
              placeholder="e.g. 2022"
            />
          </div>

          <div className="form-actions">
            <Link to="/devices" className="secondary-button">
              Cancel
            </Link>

            <button
              type="submit"
              className="submit-button"
              disabled={loading}
            >
              {loading ? "Registering..." : "Register Device"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}