import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPosts } from "../api/posts";
import {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  updateComplaint,
} from "../api/complaints";

const CATEGORY_OPTIONS = [
  { value: "user_behavior", label: "User behavior" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "spam", label: "Spam or scams" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "platform_bug", label: "Platform bug or technical issue" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "dismissed"];

const formatStatus = (s) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";

const Complaints = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState("user_behavior");
  const [description, setDescription] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [relatedPostId, setRelatedPostId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState({ type: "", text: "" });

  const [mine, setMine] = useState([]);
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminEdits, setAdminEdits] = useState({});

  const myPosts = useMemo(
    () => posts.filter((p) => (p.author?._id || p.author) === user?.id),
    [posts, user?.id]
  );

  const loadMine = async () => {
    const { data } = await getMyComplaints();
    setMine(data.data || []);
  };

  const loadAdmin = async () => {
    setAdminLoading(true);
    try {
      const { data } = await getAllComplaints();
      setAdminList(data.data || []);
    } catch {
      setAdminList([]);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getPosts();
        if (!cancelled) setPosts(data.data || []);
      } catch {
        if (!cancelled) setPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadMine();
      } catch {
        if (!cancelled) setMine([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadAdmin();
  }, [isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMsg({ type: "", text: "" });
    if (description.trim().length < 20) {
      setFormMsg({
        type: "error",
        text: "Please write at least 20 characters so we understand the problem.",
      });
      return;
    }
    setSubmitting(true);
    try {
      await createComplaint({
        category,
        description: description.trim(),
        subjectUserEmail: subjectEmail.trim() || undefined,
        relatedPostId: relatedPostId || undefined,
      });
      setFormMsg({ type: "ok", text: "Complaint submitted. An admin will review it." });
      setDescription("");
      setSubjectEmail("");
      setRelatedPostId("");
      await loadMine();
      if (isAdmin) await loadAdmin();
    } catch (err) {
      setFormMsg({
        type: "error",
        text: err.response?.data?.message || "Could not submit complaint",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const setEdit = (id, patch) => {
    setAdminEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const handleAdminSave = async (complaintId) => {
    const row = adminList.find((c) => c._id === complaintId);
    if (!row) return;
    const edit = adminEdits[complaintId] || {};
    const statusVal = edit.status ?? row.status;
    const notesVal =
      edit.adminNotes !== undefined ? edit.adminNotes : row.adminNotes ?? "";
    try {
      await updateComplaint(complaintId, {
        status: statusVal,
        adminNotes: typeof notesVal === "string" ? notesVal : "",
      });
      await loadAdmin();
      setAdminEdits((prev) => {
        const next = { ...prev };
        delete next[complaintId];
        return next;
      });
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    }
  };

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Complaints</h1>
          <p className="module2-page__subtitle">
            Report issues safely. Admins can track and resolve tickets. Optional: name another user
            or link a post you created.
          </p>
        </div>
        <Link to="/dashboard" className="button module2-page__back">
          Back to dashboard
        </Link>
      </header>

      <div className="module2-page__grid module2-page__grid--wide">
        <section className="card module2-card">
          <h2 className="module2-card__title">File a complaint</h2>
          <form className="module2-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="cmp-cat">
                Category
              </label>
              <select
                id="cmp-cat"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="cmp-desc">
                What happened? (20–5000 characters)
              </label>
              <textarea
                id="cmp-desc"
                className="input"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minLength={20}
                maxLength={5000}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="cmp-email">
                Involved user email (optional)
              </label>
              <input
                id="cmp-email"
                className="input"
                type="email"
                value={subjectEmail}
                onChange={(e) => setSubjectEmail(e.target.value)}
                placeholder="Leave blank if not about a specific person"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="cmp-post">
                Related post you authored (optional)
              </label>
              <select
                id="cmp-post"
                className="input"
                value={relatedPostId}
                onChange={(e) => setRelatedPostId(e.target.value)}
              >
                <option value="">— None —</option>
                {myPosts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.subject}: {p.topic}
                  </option>
                ))}
              </select>
            </div>
            {formMsg.text && (
              <p className={formMsg.type === "ok" ? "module2-success" : "error"}>{formMsg.text}</p>
            )}
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Sending…" : "Submit complaint"}
            </button>
          </form>
        </section>

        <section className="card module2-card">
          <h2 className="module2-card__title">Your complaints</h2>
          {mine.length === 0 ? (
            <p className="module2-muted">You have not submitted any complaints.</p>
          ) : (
            <ul className="module2-list">
              {mine.map((c) => (
                <li key={c._id} className="module2-list-item">
                  <div>
                    <strong>{formatStatus(c.category)}</strong> ·{" "}
                    <span className={`module2-badge module2-badge--${c.status}`}>
                      {formatStatus(c.status)}
                    </span>
                  </div>
                  <p className="module2-review-text">{c.description}</p>
                  {c.adminNotes ? (
                    <p className="module2-admin-note">
                      <em>Admin:</em> {c.adminNotes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isAdmin && (
        <section className="card module2-card module2-admin">
          <h2 className="module2-card__title">Admin: all complaints</h2>
          {adminLoading ? (
            <p className="module2-muted">Loading…</p>
          ) : adminList.length === 0 ? (
            <p className="module2-muted">No complaints in the system.</p>
          ) : (
            <div className="module2-table-wrap">
              <table className="module2-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Complainant</th>
                    <th>Category</th>
                    <th>Summary</th>
                    <th>Status</th>
                    <th>Admin notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {adminList.map((c) => {
                    const edit = adminEdits[c._id] || {};
                    const statusVal = edit.status ?? c.status;
                    const notesVal = edit.adminNotes ?? c.adminNotes ?? "";
                    return (
                      <tr key={c._id}>
                        <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td>{c.complainant?.name || "—"}</td>
                        <td>{formatStatus(c.category)}</td>
                        <td className="module2-table__desc">
                          {c.description.length > 120
                            ? `${c.description.slice(0, 120)}…`
                            : c.description}
                        </td>
                        <td>
                          <select
                            className="input input--table"
                            value={statusVal}
                            onChange={(e) => setEdit(c._id, { status: e.target.value })}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {formatStatus(s)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="input input--table"
                            value={notesVal}
                            onChange={(e) => setEdit(c._id, { adminNotes: e.target.value })}
                            placeholder="Internal notes"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button button--small"
                            onClick={() => handleAdminSave(c._id)}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Complaints;
