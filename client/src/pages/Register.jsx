import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Recycle, LoaderCircle } from "lucide-react";
import AccountTypeSwitch from "../components/AccountTypeSwitch";
import { apiRequest } from "../services/api";
import "./Login.css";

function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAccountType = searchParams.get("accountType") === "organization"
    ? "organization"
    : "individual";
  const [accountType, setAccountType] = useState(initialAccountType);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    organizationType: "",
    licenseNumber: "",
    contactEmail: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (
      accountType === "organization" &&
      (!form.organizationName.trim() ||
        !form.organizationType ||
        !form.licenseNumber.trim() ||
        !form.contactEmail.trim())
    ) {
      setError("Complete all required organization details.");
      return;
    }

    setLoading(true);

    try {
      const isOrganization = accountType === "organization";
      const data = await apiRequest(
        isOrganization ? "/auth/register-organization" : "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
            ...(isOrganization
              ? {
                  organizationName: form.organizationName.trim(),
                  organizationType: form.organizationType,
                  licenseNumber: form.licenseNumber.trim(),
                  contactEmail: form.contactEmail.trim().toLowerCase(),
                }
              : {}),
          }),
        }
      );

      if (!data.token) {
        throw new Error("Account created, but no authentication token was returned.");
      }

      localStorage.setItem("token", data.token);

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <div className="login-brand-icon">
            <Recycle size={28} />
          </div>
          <span>EcoTrace</span>
        </div>

        <div className="login-brand-content">
          <h1>Join the Circular Economy</h1>
          <p className="login-brand-description">
            Create an account to register your devices, arrange collection,
            and follow their recycling journey.
          </p>
        </div>

        <p className="login-brand-footer">
          Responsible recycling. Verifiable records.
        </p>
      </section>

      <section className="login-form-panel">
        <div className="login-form-container">
          <div className="login-mobile-brand">
            <Recycle size={25} />
            <span>EcoLedger</span>
          </div>

          <div className="login-heading">
            <p className="login-eyebrow">GET STARTED</p>
            <h2>{accountType === "organization" ? "Register your organization" : "Create your account"}</h2>
            <p>{accountType === "organization" ? "Create an organization workspace and its first linked account." : "Enter your details to get started."}</p>
          </div>

          <AccountTypeSwitch value={accountType} onChange={(value) => { setAccountType(value); setError(""); }} />

          <form className="login-form register-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="name">Full name *</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Enter your full name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="email">Email address *</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="phone">Phone number (optional)</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            {accountType === "organization" && (
              <>
                <div className="account-type-note">
                  Organization registration creates the organization record and links your account to it. License details are submitted as provided; they are not independently verified during signup.
                </div>
                <div className="login-field">
                  <label htmlFor="organizationName">Organization name *</label>
                  <input
                    id="organizationName"
                    name="organizationName"
                    autoComplete="organization"
                    value={form.organizationName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="organizationType">Organization type *</label>
                  <select
                    id="organizationType"
                    name="organizationType"
                    value={form.organizationType}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select organization type</option>
                    <option value="COLLECTION_CENTER">Collection center</option>
                    <option value="TRANSPORT_COMPANY">Transport company</option>
                    <option value="RECYCLING_FACILITY">Recycling facility</option>
                  </select>
                </div>
                <div className="login-field">
                  <label htmlFor="licenseNumber">License / registration number *</label>
                  <input
                    id="licenseNumber"
                    name="licenseNumber"
                    value={form.licenseNumber}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="contactEmail">Organization contact email *</label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    autoComplete="email"
                    value={form.contactEmail}
                    onChange={handleChange}
                    required
                  />
                </div>
              </>
            )}

            <div className="login-field">
              <label htmlFor="password">Password *</label>
              <div className="login-password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  minLength={8}
                  required
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="confirmPassword">Confirm password *</label>
              <div className="login-password-wrapper">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((visible) => !visible)
                  }
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="login-spinner" size={18} />
                  Creating account...
                </>
              ) : (
                accountType === "organization" ? "Create organization account" : "Create account"
              )}
            </button>
          </form>

          <p className="login-register-prompt">
            Already have an account? <Link to={`/login?accountType=${accountType}`}>Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;
