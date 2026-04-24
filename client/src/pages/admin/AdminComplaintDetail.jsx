import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getComplaint, resolveComplaint, updateComplaint } from "../../api/complaints";
import { banUser, suspendUser } from "../../api/admin";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "dismissed"];
const PIPELINE_OPTIONS = ["received", "under_review", "result"];

const formatStatus = (s) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) : "");

const OUTCOME_LABELS = {
  complainant_upheld: "Complainant upheld",
  subject_upheld: "Subject user upheld",
  partial: "Partial / mixed outcome",
};

const AdminComplaintDetail = () => {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("open");
  const [pipelineStage, setPipelineStage] = useState("received");
  const [adminNotes, setAdminNotes] = useState("");
  const [complainantMessage, setComplainantMessage] = useState("");
  const [notifyComplainant, setNotifyComplainant] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modReason, setModReason] = useState("");
  const [msg, setMsg] = useState("");
  const [disputeOutcome, setDisputeOutcome] = useState("partial");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [compensationCredits, setCompensationCredits] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await getComplaint(id);
        if (cancelled) return;
        const row = data.data;
        setC(row);
        setStatus(row.status);
        setPipelineStage(row.pipelineStage || "received");
        setAdminNotes(row.adminNotes || "");
        setComplainantMessage(row.complainantMessage || "");
      } catch {
        if (!cancelled) setC(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!c) return;
    setResolutionSummary(c.resolutionSummary || "");
    setDisputeOutcome(
      ["complainant_upheld", "subject_upheld", "partial"].includes(c.disputeOutcome) ? c.disputeOutcome : "partial"
    );
  }, [c]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await updateComplaint(id, {
        status,
        pipelineStage,
        adminNotes,
        complainantMessage,
        notifyComplainant,
      });
      setMsg("Saved.");
      setNotifyComplainant(false);
      const { data } = await getComplaint(id);
      setC(data.data);
    } catch (e) {
      setMsg(e.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const finalizeResolution = async () => {
    setSaving(true);
    setMsg("");
    try {
      await resolveComplaint(id, {
        disputeOutcome,
        resolutionSummary,
        compensationCredits: Number(compensationCredits) || 0,
        complainantMessage,
        notifyComplainant,
      });
      setMsg("Dispute resolved.");
      const { data } = await getComplaint(id);
      setC(data.data);
      setStatus(data.data.status || "resolved");
      setPipelineStage(data.data.pipelineStage || "result");
    } catch (e) {
      setMsg(e.response?.data?.message || "Failed to resolve dispute");
    } finally {
      setSaving(false);
    }
  };

  const subjectId = c?.subjectUser?._id || c?.subjectUser;

  const doSuspend = async () => {
    if (!subjectId) return;
    if (!window.confirm("Suspend this user? They will be blocked and emailed.")) return;
    try {
      await suspendUser(subjectId, modReason || "Related to complaint review");
      setMsg("User suspended.");
    } catch (e) {
      alert(e.response?.data?.message || "Failed");
    }
  };

  const doBan = async () => {
    if (!subjectId) return;
    if (!window.confirm("Ban this user? They will be blocked and emailed.")) return;
    try {
      await banUser(subjectId, modReason || "Related to complaint review");
      setMsg("User banned.");
    } catch (e) {
      alert(e.response?.data?.message || "Failed");
    }
  };

  if (loading) return <p className="module2-muted">Loading…</p>;
  if (!c) return <p className="error">Complaint not found.</p>;

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Complaint detail</h1>
          <p className="module2-page__subtitle">{formatStatus(c.category)}</p>
        </div>
        <Link to="/admin/complaints" className="button module2-page__back">
          All complaints
        </Link>
      </header>

      <div className="card module2-card" style={{ marginBottom: "1rem" }}>
        <p className="module2-review-text">{c.description}</p>
        <p className="module2-muted">
          Complainant: {c.complainant?.name} ({c.complainant?.email})
        </p>
        {c.subjectUser ? (
          <p className="module2-muted">
            Subject user: {c.subjectUser.name} ({c.subjectUser.email}) —{" "}
            <Link to={`/profile/${subjectId}`}>Profile</Link>
          </p>
        ) : (
          <p className="module2-muted">No named subject user on this ticket.</p>
        )}
        {c.post && (
          <p className="module2-muted">
            Post: {c.post.subject} / {c.post.topic}
          </p>
        )}
        {Array.isArray(c.evidenceLinks) && c.evidenceLinks.length > 0 ? (
          <div style={{ marginTop: "0.75rem" }}>
            <p className="module2-muted" style={{ marginBottom: "0.35rem" }}>
              Evidence from complainant
            </p>
            <ul className="module2-list">
              {c.evidenceLinks.map((url) => (
                <li key={url} className="module2-list-item">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {url.length > 72 ? `${url.slice(0, 72)}…` : url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {c.appealedAt && c.appealMessage ? (
        <div className="card module2-card" style={{ marginBottom: "1rem", borderColor: "#c2410c" }}>
          <h2 className="module2-card__title">Complainant appeal</h2>
          <p className="module2-muted">Submitted {new Date(c.appealedAt).toLocaleString()}</p>
          <p className="module2-review-text">{c.appealMessage}</p>
        </div>
      ) : null}

      {(c.status === "resolved" || c.status === "dismissed") && (c.resolutionSummary || c.disputeOutcome) ? (
        <div className="card module2-card" style={{ marginBottom: "1rem" }}>
          <h2 className="module2-card__title">Last recorded decision</h2>
          {c.disputeOutcome ? (
            <p className="module2-muted">
              Outcome: <strong>{OUTCOME_LABELS[c.disputeOutcome] || formatStatus(c.disputeOutcome)}</strong>
            </p>
          ) : null}
          {c.resolutionSummary ? <p className="module2-review-text">{c.resolutionSummary}</p> : null}
          {c.resolvedBy?.name ? (
            <p className="module2-muted" style={{ marginTop: "0.5rem" }}>
              Closed by {c.resolvedBy.name}
              {c.resolvedAt ? ` · ${new Date(c.resolvedAt).toLocaleString()}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="card module2-card module2-form">
        <h2 className="module2-card__title">Admin workflow</h2>
        <div className="field">
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {formatStatus(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Pipeline</label>
          <select
            className="input"
            value={pipelineStage}
            onChange={(e) => setPipelineStage(e.target.value)}
          >
            {PIPELINE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {formatStatus(s)}
              </option>
            ))}
          </select>
          <p className="module2-muted" style={{ marginTop: "0.35rem", fontSize: "0.82rem" }}>
            Saving status or pipeline sends an <strong>in-app notification</strong> to the complainant if they are
            online. Use “Email the complainant” for email as well.
          </p>
        </div>
        <div className="field">
          <label className="label">Internal admin notes</label>
          <textarea
            className="input"
            rows={3}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Message to complainant (included in email if you notify)</label>
          <textarea
            className="input"
            rows={3}
            value={complainantMessage}
            onChange={(e) => setComplainantMessage(e.target.value)}
          />
        </div>
        <label className="module2-check">
          <input
            type="checkbox"
            checked={notifyComplainant}
            onChange={(e) => setNotifyComplainant(e.target.checked)}
          />{" "}
          Email the complainant about this update
        </label>
        {msg && <p className={msg === "Saved." ? "module2-success" : "error"}>{msg}</p>}
        <button type="button" className="button" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </button>
        <hr style={{ opacity: 0.2 }} />
        {c.status !== "resolved" && c.status !== "dismissed" ? (
          <>
            <h3 className="module2-card__title" style={{ fontSize: "1.05rem" }}>
              Resolve dispute
            </h3>
            <p className="module2-muted" style={{ marginBottom: "0.75rem" }}>
              Requires a written summary and outcome. Optional credit compensation is logged on the complainant wallet.
            </p>
            <div className="field">
              <label className="label">Outcome</label>
              <select className="input" value={disputeOutcome} onChange={(e) => setDisputeOutcome(e.target.value)}>
                <option value="complainant_upheld">Complainant upheld</option>
                <option value="subject_upheld">Subject user upheld</option>
                <option value="partial">Partial / mixed outcome</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Resolution summary (required)</label>
              <textarea
                className="input"
                rows={3}
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">Compensation credits to complainant (optional)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={200}
                value={compensationCredits}
                onChange={(e) => setCompensationCredits(e.target.value)}
              />
            </div>
            <button type="button" className="button" disabled={saving} onClick={finalizeResolution}>
              {saving ? "Resolving…" : "Finalize dispute resolution"}
            </button>
          </>
        ) : (
          <p className="module2-muted">
            This ticket is marked <strong>{formatStatus(c.status)}</strong>. To change the outcome, set status back
            to <em>In progress</em> above and save, or wait for a complainant <strong>appeal</strong> (reopens
            automatically).
          </p>
        )}
      </div>

      {subjectId && (
        <div className="card module2-card module2-form">
          <h2 className="module2-card__title">Actions on subject user</h2>
          <p className="module2-muted">Only after you have verified the complaint.</p>
          <div className="field">
            <label className="label">Reason (stored on user record)</label>
            <input className="input" value={modReason} onChange={(e) => setModReason(e.target.value)} />
          </div>
          <div className="skill-dashboard__modal-actions">
            <button type="button" className="button button--ghost" onClick={doSuspend}>
              Suspend user
            </button>
            <button type="button" className="button" onClick={doBan}>
              Ban user
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminComplaintDetail;
