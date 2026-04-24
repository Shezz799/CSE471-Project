import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMyComplaint, submitComplaintAppeal } from "../api/complaints";

const formatStatus = (s) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) : "");

const OUTCOME_LABELS = {
  complainant_upheld: "Ruling in your favor",
  subject_upheld: "Ruling in favor of the reported user",
  partial: "Mixed or partial outcome",
};

const PIPELINE_LABELS = {
  received: "Complaint received",
  under_review: "Under review",
  result: "Result / decision stage",
};

const ComplaintTicketDetail = () => {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appealText, setAppealText] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = async () => {
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const { data } = await getMyComplaint(id);
      setC(data.data);
    } catch {
      setC(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const canAppeal =
    c &&
    ["resolved", "dismissed"].includes(c.status) &&
    !c.appealExhausted;

  const submitAppeal = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (appealText.trim().length < 20) {
      setMsg({ type: "error", text: "Write at least 20 characters explaining why you are appealing." });
      return;
    }
    setAppealBusy(true);
    try {
      await submitComplaintAppeal(id, { message: appealText.trim() });
      setAppealText("");
      setMsg({ type: "ok", text: "Appeal submitted. The team will review your ticket again." });
      await load();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Could not submit appeal" });
    } finally {
      setAppealBusy(false);
    }
  };

  if (loading) return <p className="module2-muted">Loading…</p>;
  if (!c) {
    return (
      <div className="module2-page">
        <p className="error">Ticket not found or you do not have access.</p>
        <Link to="/complaints" className="button">
          Back to complaints
        </Link>
      </div>
    );
  }

  return (
    <div className="module2-page complaint-ticket-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Your ticket</h1>
          <p className="module2-page__subtitle">
            <span className={`module2-badge module2-badge--${c.status}`}>{formatStatus(c.status)}</span>
            <span className="module2-muted"> · {formatStatus(c.category)}</span>
          </p>
          <p className="module2-muted" style={{ marginTop: "0.35rem" }}>
            <strong>Pipeline:</strong>{" "}
            {PIPELINE_LABELS[c.pipelineStage] || formatStatus(c.pipelineStage || "received")}
          </p>
        </div>
        <Link to="/complaints" className="button module2-page__back">
          All my complaints
        </Link>
      </header>

      <section className="card module2-card" style={{ marginBottom: "1rem" }}>
        <h2 className="module2-card__title">What you reported</h2>
        <p className="module2-review-text">{c.description}</p>
        {Array.isArray(c.evidenceLinks) && c.evidenceLinks.length > 0 ? (
          <div className="complaint-ticket-page__evidence">
            <p className="module2-muted" style={{ marginBottom: "0.35rem" }}>
              Evidence you attached
            </p>
            <ul className="module2-list">
              {c.evidenceLinks.map((url) => (
                <li key={url} className="module2-list-item">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {url.length > 64 ? `${url.slice(0, 64)}…` : url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {c.appealedAt && c.appealMessage ? (
        <section className="card module2-card complaint-ticket-page__appeal-banner" style={{ marginBottom: "1rem" }}>
          <h2 className="module2-card__title">Your appeal</h2>
          <p className="module2-muted">Submitted {new Date(c.appealedAt).toLocaleString()}</p>
          <p className="module2-review-text">{c.appealMessage}</p>
        </section>
      ) : null}

      {c.resolutionSummary?.trim() ? (
        <section className="card module2-card complaint-ticket-page__resolution" style={{ marginBottom: "1rem" }}>
          <h2 className="module2-card__title">{c.appealedAt ? "Previous decision" : "Decision for you"}</h2>
          {c.disputeOutcome ? (
            <p className="complaint-ticket-page__outcome">
              <strong>{OUTCOME_LABELS[c.disputeOutcome] || formatStatus(c.disputeOutcome)}</strong>
            </p>
          ) : null}
          <p className="module2-review-text">{c.resolutionSummary}</p>
          {c.complainantMessage ? (
            <p className="module2-success" style={{ marginTop: "0.75rem" }}>
              <strong>Message from the team:</strong> {c.complainantMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {canAppeal ? (
        <section className="card module2-card">
          <h2 className="module2-card__title">Appeal this decision (one time)</h2>
          <p className="module2-muted">
            If you believe the outcome was wrong or missing information, explain clearly below. An administrator will
            review your ticket again.
          </p>
          <form className="module2-form" onSubmit={submitAppeal}>
            <div className="field">
              <label className="label" htmlFor="appeal-body">
                Your appeal (20–2000 characters)
              </label>
              <textarea
                id="appeal-body"
                className="input"
                rows={5}
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                minLength={20}
                maxLength={2000}
                required
              />
            </div>
            {msg.text ? <p className={msg.type === "ok" ? "module2-success" : "error"}>{msg.text}</p> : null}
            <button type="submit" className="button" disabled={appealBusy}>
              {appealBusy ? "Submitting…" : "Submit appeal"}
            </button>
          </form>
        </section>
      ) : null}

      {!canAppeal && c.status === "in_progress" && c.appealExhausted ? (
        <p className="module2-muted">Your appeal is with the team — you will see updates here and by email when they save changes.</p>
      ) : null}
    </div>
  );
};

export default ComplaintTicketDetail;
