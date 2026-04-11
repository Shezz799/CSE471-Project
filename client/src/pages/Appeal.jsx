import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";

const Appeal = () => {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatus({ type: "err", text: "Missing token in URL. Open the link from your email." });
      return;
    }
    setSending(true);
    setStatus({ type: "", text: "" });
    try {
      const { data } = await api.post("/api/moderation/appeal", {
        token: token.trim(),
        message: message.trim(),
      });
      setStatus({ type: "ok", text: data.message || "Submitted." });
    } catch (err) {
      setStatus({
        type: "err",
        text: err.response?.data?.message || "Could not submit",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 480 }}>
        <h1 className="title" style={{ fontSize: "1.35rem" }}>
          Account review request
        </h1>
        <p className="subtitle">
          If your account was suspended or banned, use this form to ask the administrators to review your case.
          You must use the link from your notification email.
        </p>
        {!token ? (
          <p className="error">No token provided. Check your email for the full link.</p>
        ) : (
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label className="label" htmlFor="appeal-msg">
                Message (optional)
              </label>
              <textarea
                id="appeal-msg"
                className="input"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                placeholder="Anything you want the admin team to know"
              />
            </div>
            {status.text && (
              <p className={status.type === "ok" ? "success" : "error"}>{status.text}</p>
            )}
            <button type="submit" className="button" disabled={sending}>
              {sending ? "Submitting…" : "Submit request"}
            </button>
          </form>
        )}
        <p className="link-row" style={{ marginTop: "1rem" }}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
};

export default Appeal;
