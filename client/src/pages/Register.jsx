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
      theme: "outline",
      size: "large",
      width: 360,
    });

    google.accounts.id.prompt();
  }, [register, navigate]);

  return (
    <div className="page">
      <div className="card stack">
        <div>
          <h1 className="title">Create account</h1>
          <p className="subtitle">Use your BRACU Google account to join.</p>
        </div>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        <div id="google-register"></div>
        <div className="link-row">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
