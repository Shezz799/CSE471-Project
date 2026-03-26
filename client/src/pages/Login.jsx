import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      if (user.profileCompleted) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/create-account", { replace: true });
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    const google = window.google;
    if (!google) {
      setError("Google Identity script not loaded");
      return;
    }

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          setError("");
          const nextUser = await login(response.credential);
          if (nextUser.profileCompleted) {
            navigate("/dashboard", { replace: true });
          } else {
            navigate("/create-account", { replace: true });
          }
        } catch (err) {
          setError(err.response?.data?.message || "Login failed");
        }
      },
    });

    google.accounts.id.renderButton(document.getElementById("google-login"), {
      theme: "filled_blue",
      size: "large",
      width: 360,
    });

    google.accounts.id.prompt();
  }, [login, navigate]);

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <h1 className="auth-hero__title">Micro SkillShare Platform</h1>
        <p className="auth-hero__subtitle">Need help on your projects? You are at the right place.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel auth-panel--center">
          <h1 className="auth-panel__title">Welcome back</h1>
          <p className="auth-panel__subtitle">Sign in with your institution&apos;s G-Suite account</p>
          {error && <div className="error">{error}</div>}
          <div className="auth-google" id="google-login"></div>
          <div className="auth-panel__link-row">
            New here? <Link to="/register">create account</Link>
          </div>
          <p className="auth-panel__footnote">Secure Authentication via Google</p>
        </div>
      </section>
    </div>
  );
};

export default Login;

