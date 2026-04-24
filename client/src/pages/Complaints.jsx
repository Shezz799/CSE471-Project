import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPosts } from "../api/posts";
import { createComplaint, getMyComplaints } from "../api/complaints";

const CATEGORY_OPTIONS = [
  { value: "user_behavior", label: "User behavior" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "spam", label: "Spam or scams" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "platform_bug", label: "Platform bug or technical issue" },
  { value: "other", label: "Other" },
];

const formatStatus = (s) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";

const Complaints = () => {
  const { user } = useAuth();
  const isDashboardAdmin = user?.isDashboardAdmin;

  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState("user_behavior");
  const [description, setDescription] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [relatedPostId, setRelatedPostId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState({ type: "", text: "" });

  const [mine, setMine] = useState([]);

  const myPosts = useMemo(
    () => posts.filter((p) => (p.author?._id || p.author) === user?.id),
    [posts, user?.id]
  );

  const loadMine = async () => {
    const { data } = await getMyComplaints();
    setMine(data.data || []);
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
    } catch (err) {
      setFormMsg({
        type: "error",
        text: err.response?.data?.message || "Could not submit complaint",
      });
    } finally {
      setSubmitting(false);
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
                  {c.complainantMessage ? (
                    <p className="module2-success">
                      <em>Update for you:</em> {c.complainantMessage}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isDashboardAdmin && (
        <section className="card module2-card module2-admin">
          <h2 className="module2-card__title">Administrator</h2>
          <p className="module2-muted">
            Manage all complaints, pipeline stages, and notifications from the admin dashboard.
          </p>
          <Link to="/admin/complaints" className="button" style={{ width: "auto", marginTop: "0.75rem" }}>
            Open admin complaints
          </Link>
        </section>
      )}
    </div>
  );
};

export default Complaints;
