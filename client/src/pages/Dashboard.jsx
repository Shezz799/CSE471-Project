import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPosts, createPost, deletePost, offerHelpToPost } from "../api/posts";
import { fetchMyCredits } from "../api/session";
import PostCard from "../components/PostCard";
import { useReviewNotifications } from "../context/ReviewNotificationContext";
import toast from "react-hot-toast";

const FEED_BATCH_SIZE = 10;

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setUserProfile } = useAuth();
  const { unreadCount } = useReviewNotifications();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedTab, setFeedTab] = useState("all"); // "all" | "mine"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubtag, setSelectedSubtag] = useState("All");
  const [form, setForm] = useState({ subject: "", topic: "", description: "", creditsOffered: "" });
  const [submitting, setSubmitting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(FEED_BATCH_SIZE);
  const infiniteSentinelRef = useRef(null);

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

  useEffect(() => {
    let cancelled = false;

    const loadWalletCredits = async () => {
      try {
        const { data } = await fetchMyCredits();
        if (cancelled || !user) return;

        const nextCredits = data?.data;
        if (!nextCredits) return;

        setUserProfile({
          ...user,
          credits: Number(nextCredits.totalCredits || 0),
          totalCredits: Number(nextCredits.totalCredits || 0),
          heldCredits: Number(nextCredits.heldCredits || 0),
        });
      } catch {
        // Wallet fetch is non-blocking for dashboard rendering.
      }
    };

    loadWalletCredits();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
      toast.success("Successfully offered help! The author has been notified.");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to offer help");
    }
  };

  const categories = ["All", ...new Set(posts.map((p) => p.subject).filter(Boolean))];
  const subTags = [
    "All",
    ...new Set(
      posts
        .filter((p) => selectedCategory === "All" || p.subject === selectedCategory)
        .map((p) => p.topic)
        .filter(Boolean)
    ),
  ];

  const filteredPosts = posts.filter((p) => {
    // 1. Tab filter
    if (feedTab === "mine" && (p.author?._id || p.author) !== user?.id) return false;
    
    // 2. Category / Subject
    if (selectedCategory !== "All" && p.subject !== selectedCategory) return false;

    // 3. Sub-tag / Topic
    if (selectedSubtag !== "All" && p.topic !== selectedSubtag) return false;

    // 4. Keyword Search (case-insensitive)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchSubject = p.subject?.toLowerCase().includes(q);
      const matchTopic = p.topic?.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      if (!matchSubject && !matchTopic && !matchDesc) return false;
    }

    return true;
  });

  const displayPosts = filteredPosts;

  const visiblePosts = displayPosts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < displayPosts.length;

  useEffect(() => {
    setVisibleCount(FEED_BATCH_SIZE);
  }, [feedTab, searchQuery, selectedCategory, selectedSubtag]);

  useEffect(() => {
    if (!hasMorePosts || !infiniteSentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + FEED_BATCH_SIZE, displayPosts.length));
      },
      {
        root: null,
        rootMargin: "220px 0px",
        threshold: 0,
      }
    );

    observer.observe(infiniteSentinelRef.current);
    return () => observer.disconnect();
  }, [displayPosts.length, hasMorePosts]);

  const profilePath = user?.id ? `/profile/${user.id}` : "";
  const isRouteActive = (path) => location.pathname === path;

  return (
    <div className="skill-dashboard">
      <header className="skill-dashboard__topbar">
        <h1 className="skill-dashboard__brand">MicroSkillShare</h1>

        <label className="skill-dashboard__search-wrap" htmlFor="dashboard-search">
          <input
            id="dashboard-search"
            className="skill-dashboard__search"
            type="search"
            placeholder="Search keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="skill-dashboard__search-icon" aria-hidden>
            ⌕
          </span>
        </label>
      </header>

      <div className="skill-dashboard__main">
        <aside className="skill-dashboard__sidebar">
          <nav className="skill-dashboard__sidebar-nav" aria-label="Dashboard navigation">
            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${isRouteActive("/dashboard") ? "is-active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>◉</span>
              <span className="skill-dashboard__sidebar-label">Feed</span>
            </button>

            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${profilePath && isRouteActive(profilePath) ? "is-active" : ""}`}
              onClick={() => {
                if (user?.id) navigate(`/profile/${user.id}`);
              }}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>◌</span>
              <span className="skill-dashboard__sidebar-label">My profile</span>
            </button>

            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${isRouteActive("/messages") ? "is-active" : ""}`}
              onClick={() => navigate("/messages")}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>✉</span>
              <span className="skill-dashboard__sidebar-label">Messages</span>
            </button>

            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${isRouteActive("/notifications") ? "is-active" : ""}`}
              onClick={() => navigate("/notifications")}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>🔔</span>
              <span className="skill-dashboard__sidebar-label">Notification</span>
              {unreadCount > 0 ? (
                <span className="skill-dashboard__sidebar-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              ) : null}
            </button>

            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${isRouteActive("/analytics") ? "is-active" : ""}`}
              onClick={() => navigate("/analytics")}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>◫</span>
              <span className="skill-dashboard__sidebar-label">Analytics Dashboard</span>
            </button>

            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${isRouteActive("/reviews") ? "is-active" : ""}`}
              onClick={() => navigate("/reviews")}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>★</span>
              <span className="skill-dashboard__sidebar-label">Reviews and rating</span>
            </button>

            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${isRouteActive("/credits") ? "is-active" : ""}`}
              onClick={() => navigate("/credits")}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>৳</span>
              <span className="skill-dashboard__sidebar-label">Credits & gifts</span>
            </button>

            <button
              type="button"
              className={`skill-dashboard__sidebar-link ${isRouteActive("/complaints") ? "is-active" : ""}`}
              onClick={() => navigate("/complaints")}
            >
              <span className="skill-dashboard__sidebar-icon" aria-hidden>⚑</span>
              <span className="skill-dashboard__sidebar-label">Complaints</span>
            </button>

            {user?.isDashboardAdmin ? (
              <button
                type="button"
                className={`skill-dashboard__sidebar-link skill-dashboard__sidebar-link--admin ${location.pathname.startsWith("/admin") ? "is-active" : ""}`}
                onClick={() => navigate("/admin")}
              >
                <span className="skill-dashboard__sidebar-icon" aria-hidden>⎔</span>
                <span className="skill-dashboard__sidebar-label">Admin panel</span>
              </button>
            ) : null}
          </nav>

          <div className="skill-dashboard__sidebar-footer">
            <div className="skill-dashboard__identity">
              <span className="skill-dashboard__identity-avatar" aria-hidden>
                {user?.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
              <div>
                <p className="skill-dashboard__identity-name">{user?.name || "User"}</p>
                <p className="skill-dashboard__identity-meta">
                  Credits: {user?.totalCredits != null ? user.totalCredits : "-"}
                  {user?.heldCredits ? ` (held ${user.heldCredits})` : ""}
                </p>
              </div>
            </div>

            <div className="skill-dashboard__sidebar-footer-divider" aria-hidden />

            <button type="button" className="skill-dashboard__logout" onClick={logout}>
              <span className="skill-dashboard__logout-icon" aria-hidden>↪</span>
              <span className="skill-dashboard__logout-label">Log out</span>
            </button>
          </div>
        </aside>

        <section className="skill-dashboard__feed">
          <div className="skill-dashboard__toolbar">
            <button
              type="button"
              className={`skill-dashboard__pill ${feedTab === "all" ? "skill-dashboard__pill--active" : ""}`}
              onClick={() => setFeedTab("all")}
            >
              Feed
            </button>
            <button
              type="button"
              className={`skill-dashboard__pill ${feedTab === "mine" ? "skill-dashboard__pill--active" : ""}`}
              onClick={() => setFeedTab("mine")}
            >
              My requests
            </button>

            <button
              type="button"
              className="button skill-dashboard__create-request"
              onClick={() => setCreateModalOpen(true)}
            >
              Create help request
            </button>
          </div>

          <div className="skill-dashboard__filter-bar" style={{ display: 'flex', gap: '1rem', padding: '1rem 2rem', borderBottom: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="label" style={{ marginBottom: 0, whiteSpace: 'nowrap', color: '#ffffff', fontWeight: '600', fontSize: '1rem' }} htmlFor="filter-cat">Category:</label>
              <select 
                id="filter-cat"
                className="input" 
                style={{ padding: '0.4rem', height: 'auto', minWidth: '150px' }}
                value={selectedCategory} 
                onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubtag("All"); }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="label" style={{ marginBottom: 0, whiteSpace: 'nowrap', color: '#ffffff', fontWeight: '600', fontSize: '1rem' }} htmlFor="filter-sub">Sub-tag:</label>
              <select 
                id="filter-sub"
                className="input" 
                style={{ padding: '0.4rem', height: 'auto', minWidth: '150px' }}
                value={selectedSubtag} 
                onChange={(e) => setSelectedSubtag(e.target.value)}
              >
                {subTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {(selectedCategory !== "All" || selectedSubtag !== "All" || searchQuery) && (
              <button 
                type="button" 
                className="button button--danger" 
                style={{ height: 'auto', padding: '0.4rem 1rem', marginLeft: 'auto' }}
                onClick={() => { setSelectedCategory("All"); setSelectedSubtag("All"); setSearchQuery(""); }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="skill-dashboard__feed-body">
            {loading && <p className="skill-dashboard__message">Loading feed…</p>}
            {error && <p className="error skill-dashboard__error">{error}</p>}
            {!loading && !error && displayPosts.length === 0 && (
              <div className="skill-dashboard__empty">
                <p className="skill-dashboard__empty-title">
                  {feedTab === "mine"
                    ? "You have not posted a help request yet"
                    : "No help requests on the wall yet"}
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
                {visiblePosts.map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    currentUser={user}
                    onDelete={handleDelete}
                    onOfferHelp={handleOfferHelp}
                  />
                ))}
                {hasMorePosts ? (
                  <div ref={infiniteSentinelRef} className="skill-dashboard__infinite-sentinel" aria-hidden />
                ) : null}
              </div>
            )}
          </div>
        </section>

        <aside className="skill-dashboard__right-pane" aria-label="Secondary pane" />
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
