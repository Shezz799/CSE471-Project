import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPosts, createPost, deletePost, offerHelpToPost } from "../api/posts";
import PostCard from "../components/PostCard";
import { useReviewNotifications } from "../context/ReviewNotificationContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadCount } = useReviewNotifications();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedTab, setFeedTab] = useState("all"); // "all" | "mine"
  const [form, setForm] = useState({ subject: "", topic: "", description: "", creditsOffered: "" });
  const [submitting, setSubmitting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadPosts = async () => {
    try {
      const { data } = await getPosts();
      setPosts(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.topic.trim() || !form.description.trim()) {
      alert("Subject, topic and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createPost({
        subject: form.subject.trim(),
        topic: form.topic.trim(),
        description: form.description.trim(),
        creditsOffered: form.creditsOffered ? Number(form.creditsOffered) : 0,
      });
      setForm({ subject: "", topic: "", description: "", creditsOffered: "" });
      setCreateModalOpen(false);
      await loadPosts();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const closeCreateModal = () => {
    if (!submitting) {
      setCreateModalOpen(false);
      setForm({ subject: "", topic: "", description: "", creditsOffered: "" });
    }
  };

  const handleDelete = async (postId) => {
    await deletePost(postId);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  const handleOfferHelp = async (postId) => {
    try {
      const { data } = await offerHelpToPost(postId);
      // Replace the old post with the updated one
      setPosts((prev) => prev.map((p) => (p._id === postId ? data.data : p)));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to offer help");
    }
  };

  const myPosts = posts.filter((p) => (p.author?._id || p.author) === user?.id);
  const displayPosts = feedTab === "mine" ? myPosts : posts;
  const openOthersCount = posts.filter(
    (p) =>
      p.status === "open" &&
      user?.id &&
      (p.author?._id || p.author) !== user.id
  ).length;

  return (
    <div className="skill-dashboard">
      <div className="skill-dashboard__main">
      {/* LEFT SECTION — Feed / Wall (readable column, not endless white) */}
      <section className="skill-dashboard__feed">
        <div className="skill-dashboard__feed-inner">
          <div className="skill-dashboard__feed-header">
            <h1 className="skill-dashboard__feed-title">Skill Sharing Feed</h1>
            <button
              type="button"
              className="button skill-dashboard__create-btn"
              onClick={() => setCreateModalOpen(true)}
            >
              Create help request
            </button>
          </div>

          <div className="skill-dashboard__tabs">
            <button
              type="button"
              className={`skill-dashboard__tab ${feedTab === "all" ? "skill-dashboard__tab--active" : ""}`}
              onClick={() => setFeedTab("all")}
            >
              All Posts
            </button>
            <button
              type="button"
              className={`skill-dashboard__tab ${feedTab === "mine" ? "skill-dashboard__tab--active" : ""}`}
              onClick={() => setFeedTab("mine")}
            >
              My Posts
            </button>
          </div>

          <div className="skill-dashboard__wall">
            {loading && <p className="skill-dashboard__message">Loading feed…</p>}
            {error && <p className="error skill-dashboard__error">{error}</p>}
            {!loading && !error && displayPosts.length === 0 && (
              <div className="skill-dashboard__empty">
                <p className="skill-dashboard__empty-title">
                  {feedTab === "mine" ? "You have not posted a help request yet" : "No help requests on the wall yet"}
                </p>
                <p className="skill-dashboard__empty-text">
                  {feedTab === "mine"
                    ? "Describe a topic you are stuck on. Mentors who offered help can appear in your post — rate them when you are done."
                    : "When someone posts, you will see it here. You can offer help on open posts that are not yours."}
                </p>
                {feedTab === "mine" && (
                  <button
                    type="button"
                    className="button skill-dashboard__empty-cta"
                    onClick={() => setCreateModalOpen(true)}
                  >
                    Create your first help request
                  </button>
                )}
              </div>
            )}
            {!loading && !error && displayPosts.length > 0 && (
              <div className="skill-dashboard__list">
                {displayPosts.map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    currentUser={user}
                    onDelete={handleDelete}
                    onOfferHelp={handleOfferHelp}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT SECTION — 70% — User dashboard area */}
      <aside className="skill-dashboard__panel">
        <div className="skill-dashboard__summary card">
          <h3 className="skill-dashboard__summary-title">Wall snapshot</h3>
          <ul className="skill-dashboard__summary-list">
            <li>
              <span className="skill-dashboard__summary-value">{posts.length}</span>
              <span className="skill-dashboard__summary-label">help requests total</span>
            </li>
            <li>
              <span className="skill-dashboard__summary-value">{myPosts.length}</span>
              <span className="skill-dashboard__summary-label">posted by you</span>
            </li>
            <li>
              <span className="skill-dashboard__summary-value">{openOthersCount}</span>
              <span className="skill-dashboard__summary-label">open posts you can help with</span>
            </li>
          </ul>
          <p className="skill-dashboard__summary-tip">
            After someone helps you, use <strong>Ratings &amp; reviews</strong> to leave feedback.
          </p>
        </div>

        <div className="skill-dashboard__profile card">
          <div className="skill-dashboard__avatar" aria-hidden>
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <h2 className="skill-dashboard__name">{user?.name || "User"}</h2>
          <p className="skill-dashboard__credits">
            <span className="skill-dashboard__credits-label">Credits:</span>{" "}
            {user?.credits != null ? user.credits : "—"}
          </p>
        </div>

        {user?.isDashboardAdmin ? (
          <div className="skill-dashboard__action card">
            <button
              type="button"
              className="skill-dashboard__action-btn skill-dashboard__action-btn--admin"
              onClick={() => navigate("/admin")}
            >
              <span className="skill-dashboard__action-icon" aria-hidden>⎔</span>
              Log in as admin
            </button>
          </div>
        ) : null}

        {/* Messaging — placeholder */}
        <div className="skill-dashboard__action card">
          <button
            type="button"
            className="skill-dashboard__action-btn"
            onClick={() => navigate("/messages")}
          >
            <span className="skill-dashboard__action-icon" aria-hidden>✉</span>
            Messages
          </button>
        </div>

        <div className="skill-dashboard__action card">
          <button
            type="button"
            className="skill-dashboard__action-btn skill-dashboard__action-btn--with-badge"
            onClick={() => navigate("/notifications")}
          >
            <span className="skill-dashboard__action-icon" aria-hidden>🔔</span>
            Notifications
            {unreadCount > 0 ? (
              <span className="skill-dashboard__notif-badge" aria-label={`${unreadCount} unread`}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="skill-dashboard__action card">
          <button
            type="button"
            className="skill-dashboard__action-btn"
            onClick={() => navigate("/analytics")}
          >
            <span className="skill-dashboard__action-icon" aria-hidden>📊</span>
            Analytics Dashboard
          </button>
        </div>

        <div className="skill-dashboard__action card">
          <button
            type="button"
            className="skill-dashboard__action-btn"
            onClick={() => navigate("/reviews")}
          >
            <span className="skill-dashboard__action-icon" aria-hidden>⭐</span>
            Ratings &amp; reviews
          </button>
        </div>

        <div className="skill-dashboard__action card">
          <button
            type="button"
            className="skill-dashboard__action-btn"
            onClick={() => navigate("/complaints")}
          >
            <span className="skill-dashboard__action-icon" aria-hidden>⚠</span>
            Complaints
          </button>
        </div>

        {/* Find Experts — placeholder */}
        <div className="skill-dashboard__action card">
          <button type="button" className="skill-dashboard__action-btn" disabled>
            <span className="skill-dashboard__action-icon" aria-hidden>🔍</span>
            Find Experts
            <span className="skill-dashboard__coming">(Coming soon)</span>
          </button>
        </div>

        {/* Buy Credits — placeholder */}
        <div className="skill-dashboard__action card">
          <button type="button" className="button skill-dashboard__buy-btn" disabled>
            Buy Credits
          </button>
          <p className="skill-dashboard__coming-text">(Coming in a later module)</p>
        </div>

        <button type="button" className="button logout skill-dashboard__logout" onClick={logout}>
          Log out
        </button>
      </aside>
      </div>

      {/* Messages drawer placeholder */}
      {/* Create Post modal */}
      {createModalOpen && (
        <div className="skill-dashboard__modal-overlay" onClick={closeCreateModal} aria-hidden />
      )}
      <div className={`skill-dashboard__modal ${createModalOpen ? "skill-dashboard__modal--open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="create-post-title">
        <div className="skill-dashboard__modal-inner" onClick={(e) => e.stopPropagation()}>
          <div className="skill-dashboard__modal-header">
            <h2 id="create-post-title" className="skill-dashboard__modal-title">Create a help request</h2>
            <button type="button" className="skill-dashboard__modal-close" onClick={closeCreateModal} aria-label="Close">
              ×
            </button>
          </div>
          <form className="skill-dashboard__modal-form" onSubmit={handleCreateSubmit}>
            <div className="field">
              <label className="label" htmlFor="modal-subject">Subject</label>
              <input
                id="modal-subject"
                className="input"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Data Structures"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="modal-topic">Topic</label>
              <input
                id="modal-topic"
                className="input"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="e.g. Recursion"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="modal-description">Problem description</label>
              <textarea
                id="modal-description"
                className="input"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe what you need help with..."
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="modal-credits">Credits offered (optional)</label>
              <input
                id="modal-credits"
                type="number"
                min={0}
                className="input"
                value={form.creditsOffered}
                onChange={(e) => setForm((f) => ({ ...f, creditsOffered: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="skill-dashboard__modal-actions">
              <button type="button" className="button skill-dashboard__modal-cancel" onClick={closeCreateModal} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Publishing..." : "Publish"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
