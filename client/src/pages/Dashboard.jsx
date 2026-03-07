import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getPosts, createPost, deletePost } from "../api/posts";
import PostCard from "../components/PostCard";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedTab, setFeedTab] = useState("all"); // "all" | "mine"
  const [form, setForm] = useState({ subject: "", topic: "", description: "", creditsOffered: "" });
  const [submitting, setSubmitting] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
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

  const myPosts = posts.filter((p) => (p.author?._id || p.author) === user?.id);
  const displayPosts = feedTab === "mine" ? myPosts : posts;

  return (
    <div className="skill-dashboard">
      {/* LEFT SECTION — Feed / Wall (40–45%) */}
      <section className="skill-dashboard__feed">
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

        {/* Toggle: All Posts / My Posts */}
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

        {/* Scrollable feed */}
        <div className="skill-dashboard__wall">
          {loading && <p className="skill-dashboard__message">Loading feed...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && displayPosts.length === 0 && (
            <p className="skill-dashboard__message">
              {feedTab === "mine" ? "You haven't posted yet." : "No posts yet. Be the first to ask for help!"}
            </p>
          )}
          {!loading && !error && displayPosts.length > 0 && (
            <div className="skill-dashboard__list">
              {displayPosts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  currentUser={user}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT SECTION — 70% — User dashboard area */}
      <aside className="skill-dashboard__panel">
        {/* User profile */}
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

        {/* Messaging — placeholder */}
        <div className="skill-dashboard__action card">
          <button
            type="button"
            className="skill-dashboard__action-btn"
            onClick={() => setMessagesOpen(true)}
          >
            <span className="skill-dashboard__action-icon" aria-hidden>✉</span>
            Messages
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

        {/* Notifications — placeholder */}
        <div className="skill-dashboard__action card">
          <button type="button" className="skill-dashboard__action-btn" disabled>
            <span className="skill-dashboard__action-icon skill-dashboard__action-icon--bell" aria-hidden>🔔</span>
            Notifications
            <span className="skill-dashboard__badge">0</span>
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

      {/* Messages drawer placeholder */}
      {messagesOpen && (
        <div className="skill-dashboard__drawer-overlay" onClick={() => setMessagesOpen(false)} aria-hidden />
      )}
      <div className={`skill-dashboard__drawer ${messagesOpen ? "skill-dashboard__drawer--open" : ""}`}>
        <div className="skill-dashboard__drawer-header">
          <h2>Messages</h2>
          <button type="button" className="skill-dashboard__drawer-close" onClick={() => setMessagesOpen(false)}>
            ×
          </button>
        </div>
        <p className="skill-dashboard__placeholder">Messaging will be available in a future module.</p>
      </div>

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
