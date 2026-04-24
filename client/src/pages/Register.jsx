import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register, user } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
          setSuccess("");
          await register(response.credential);
          setSuccess("Account created successfully");
          navigate("/create-account", { replace: true });
        } catch (err) {
          setError(err.response?.data?.message || "Registration failed");
        }
      },
    });

    google.accounts.id.renderButton(document.getElementById("google-register"), {
      theme: "filled_blue",
      size: "large",
      width: 360,
    });

    google.accounts.id.prompt();
  }, [register, navigate]);

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <h1 className="auth-hero__title">Micro SkillShare Platform</h1>
        <p className="auth-hero__subtitle">Collaborate, ask for help, and share your expertise with your peers.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <h1 className="auth-panel__title">Create account</h1>
          <p className="auth-panel__subtitle">Sign up with your Google account</p>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <div className="auth-google" id="google-register"></div>
          <div className="auth-panel__link-row">
            Already have an account? <Link to="/login">sign in</Link>
          </div>
          <p className="auth-panel__footnote">Secure Authentication via Google</p>
        </div>
      </section>
    </div>
  );
};

export default Register;
