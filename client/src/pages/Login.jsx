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
      theme: "outline",
      size: "large",
      width: 360,
    });

    google.accounts.id.prompt();
  }, [login, navigate]);

  return (
    <div className="page">
      <div className="card stack">
        <div>
          <h1 className="title">Welcome back</h1>
          <p className="subtitle">Sign in with your BRACU Google account.</p>
        </div>
        {error && <div className="error">{error}</div>}
        <div id="google-login"></div>
        <div className="link-row">
          New here? <Link to="/register">Create account</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
