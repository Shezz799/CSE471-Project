import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAllComplaints } from "../../api/complaints";

const formatStatus = (s) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) : "");

const PIPELINE = [
  { value: "", label: "All stages" },
  { value: "received", label: "Complaint received" },
  { value: "under_review", label: "Being reviewed" },
  { value: "result", label: "Result" },
];

const AdminComplaints = () => {
  const [pipelineStage, setPipelineStage] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = pipelineStage ? { pipelineStage } : {};
      const { data } = await getAllComplaints(params);
      setList(data.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pipelineStage]);

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Complaints</h1>
          <p className="module2-page__subtitle">Open a ticket to verify details and take action.</p>
        </div>
        <Link to="/admin" className="button module2-page__back">
          Admin home
        </Link>
      </header>

      <div className="field" style={{ maxWidth: "20rem", marginBottom: "1rem" }}>
        <label className="label" htmlFor="pipe-filter">
          Pipeline stage
        </label>
        <select
          id="pipe-filter"
          className="input"
          value={pipelineStage}
          onChange={(e) => setPipelineStage(e.target.value)}
        >
          {PIPELINE.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="module2-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="module2-muted">No complaints in this filter.</p>
      ) : (
        <ul className="module2-list">
          {list.map((c) => (
            <li key={c._id} className="module2-list-item">
              <div>
                <Link to={`/admin/complaints/${c._id}`}>
                  <strong>{formatStatus(c.category)}</strong>
                </Link>{" "}
                · <span className="module2-muted">{formatStatus(c.status)}</span> ·{" "}
                <span className="module2-muted">{formatStatus(c.pipelineStage || "received")}</span>
              </div>
              <p className="module2-review-text">
                {c.description.length > 200 ? `${c.description.slice(0, 200)}…` : c.description}
              </p>
              <p className="module2-muted">
                From {c.complainant?.name || "—"} · {new Date(c.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminComplaints;
