import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Recycle, LoaderCircle } from "lucide-react";
import { apiRequest } from "../services/api";
import AccountTypeSwitch from "../components/AccountTypeSwitch";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAccountType = searchParams.get("accountType") === "organization"
    ? "organization"
    : "individual";
  const [accountType, setAccountType] = useState(initialAccountType);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
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

    const email = form.email.trim().toLowerCase();

    if (!email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password: form.password,
        }),
      });

      if (!data.token) {
        throw new Error("Login succeeded but no authentication token was returned.");
      }
      const isOrganizationAccount = Boolean(data.user?.organizationId);
      if (
        (accountType === "organization" && !isOrganizationAccount) ||
        (accountType === "individual" && isOrganizationAccount)
      ) {
        throw new Error(
          accountType === "organization"
            ? "This account is not linked to an organization. Choose Individual or register an organization account."
            : "This account belongs to an organization. Choose Organization to sign in."
        );
      }

      localStorage.setItem("token", data.token);

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log in. Please try again.");
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
          <h1>Give every device a responsible next chapter.</h1>
          <p className="login-brand-description">
            Track electronic waste from registration to recycling with
            transparent records at every stage.
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
            <p className="login-eyebrow">WELCOME BACK</p>
            <h2>{accountType === "organization" ? "Organization sign in" : "Sign in to your account"}</h2>
            <p>Choose your portal, then enter your credentials.</p>
          </div>

          <AccountTypeSwitch value={accountType} onChange={(value) => { setAccountType(value); setError(""); }} />

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
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
              <label htmlFor="password">Password</label>

              <div className="login-password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
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
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="login-register-prompt">
            Don't have an account? <Link to={`/register?accountType=${accountType}`}>Create one</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;