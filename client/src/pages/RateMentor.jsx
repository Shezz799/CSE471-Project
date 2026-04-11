import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPosts } from "../api/posts";
import {
  createReview,
  getMyReviewsGiven,
  getMyReviewsReceived,
  getReviewStats,
} from "../api/reviews";

const RateMentor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const receivedSectionRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [postId, setPostId] = useState("");
  const [mentorId, setMentorId] = useState("");

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: "", text: "" });

  const [given, setGiven] = useState([]);
  const [received, setReceived] = useState([]);
  const [statsPreview, setStatsPreview] = useState(null);

  const myPosts = useMemo(
    () => posts.filter((p) => (p.author?._id || p.author) === user?.id),
    [posts, user?.id]
  );

  /** Posts where at least one person who offered help has not been reviewed yet for that post */
  const myPostsEligible = useMemo(() => {
    return myPosts.filter((post) => {
      const offers = post.offers || [];
      if (offers.length === 0) return false;
      const pid = String(post._id);
      const reviewedMentorIds = new Set(
        given
          .filter((r) => String(r.post?._id || r.post) === pid)
          .map((r) => String(r.reviewee?._id || r.reviewee))
      );
      return offers.some((o) => !reviewedMentorIds.has(String(o._id || o)));
    });
  }, [myPosts, given]);

  const selectedPost = useMemo(
    () => myPostsEligible.find((p) => p._id === postId) || null,
    [myPostsEligible, postId]
  );

  /** Mentors on the selected post you have not reviewed yet for that post */
  const offerMentors = useMemo(() => {
    const offers = selectedPost?.offers || [];
    if (!selectedPost?._id || offers.length === 0) return [];
    const pid = String(selectedPost._id);
    const reviewedMentorIds = new Set(
      given
        .filter((r) => String(r.post?._id || r.post) === pid)
        .map((r) => String(r.reviewee?._id || r.reviewee))
    );
    return offers.filter((o) => !reviewedMentorIds.has(String(o._id || o)));
  }, [selectedPost, given]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getPosts();
        if (!cancelled) setPosts(data.data || []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoadingPosts(false);
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
        const [g, r] = await Promise.all([getMyReviewsGiven(), getMyReviewsReceived()]);
        if (!cancelled) {
          setGiven(g.data.data || []);
          setReceived(r.data.data || []);
        }
      } catch {
        if (!cancelled) {
          setGiven([]);
          setReceived([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (location.hash !== "#reviews-received") return;
    const t = window.setTimeout(() => {
      receivedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [location.hash, location.pathname]);

  useEffect(() => {
    setMentorId("");
    setStatsPreview(null);
  }, [postId]);

  useEffect(() => {
    if (postId && !myPostsEligible.some((p) => p._id === postId)) {
      setPostId("");
    }
  }, [postId, myPostsEligible]);

  useEffect(() => {
    if (!mentorId || offerMentors.length === 0) return;
    if (!offerMentors.some((m) => String(m._id) === String(mentorId))) {
      setMentorId("");
    }
  }, [mentorId, offerMentors]);

  useEffect(() => {
    if (!mentorId || !postId) {
      setStatsPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getReviewStats(mentorId);
        if (!cancelled) setStatsPreview(data.data);
      } catch {
        if (!cancelled) setStatsPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mentorId, postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMessage({ type: "", text: "" });
    if (!postId) {
      setFormMessage({
        type: "error",
        text: "Choose the help request where they offered help.",
      });
      return;
    }
    if (!mentorId) {
      setFormMessage({
        type: "error",
        text: "Choose the mentor from the list for that request.",
      });
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setFormMessage({ type: "error", text: "Pick a star rating from 1 to 5." });
      return;
    }
    setSubmitting(true);
    try {
      await createReview({
        revieweeId: mentorId,
        postId,
        rating,
        comment: comment.trim(),
      });
      setFormMessage({ type: "ok", text: "Thank you — your review was saved." });
      setComment("");
      setRating(5);
      setMentorId("");
      const [g, r] = await Promise.all([getMyReviewsGiven(), getMyReviewsReceived()]);
      setGiven(g.data.data || []);
      setReceived(r.data.data || []);
    } catch (err) {
      setFormMessage({
        type: "error",
        text: err.response?.data?.message || "Could not save review",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Ratings &amp; reviews</h1>
          <p className="module2-page__subtitle">
            Rate a mentor only after they offered help on your posted request. Each help request allows one review
            per mentor.
          </p>
        </div>
        <Link to="/dashboard" className="button module2-page__back">
          Back to dashboard
        </Link>
      </header>

      <div className="module2-page__grid">
        <section className="card module2-card">
          <h2 className="module2-card__title">Submit a review</h2>
          {loadingPosts && <p className="module2-muted">Loading your help requests…</p>}
          {!loadingPosts && myPosts.length === 0 && (
            <p className="module2-muted">
              You have no help requests yet. Create one from the dashboard, then after someone offers help you can
              rate them here.
            </p>
          )}
          {!loadingPosts && myPosts.length > 0 && myPostsEligible.length === 0 && (
            <p className="module2-muted">
              Every help request that had offers is already reviewed. When someone new offers help on a post, it will
              show up here again.
            </p>
          )}
          <form className="module2-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="rev-post">
                Your help request
              </label>
              <select
                id="rev-post"
                className="input"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                required
                disabled={myPostsEligible.length === 0}
              >
                <option value="">Select help request</option>
                {myPostsEligible.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.subject}: {p.topic}
                  </option>
                ))}
              </select>
              <p className="module2-hint">
                Only requests where you still owe a review to at least one mentor are listed. Each mentor can be
                reviewed once per request.
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="rev-mentor">
                Mentor
              </label>
              {!postId ? (
                <p className="module2-muted">Select a help request first.</p>
              ) : offerMentors.length === 0 ? (
                <p className="module2-muted">No mentors left to review for this request.</p>
              ) : (
                <select
                  id="rev-mentor"
                  className="input"
                  value={mentorId}
                  onChange={(e) => setMentorId(e.target.value)}
                  required
                >
                  <option value="">Select mentor</option>
                  {offerMentors.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {statsPreview && mentorId && postId && (
              <p className="module2-stats-preview">
                Their public stats:{" "}
                <strong>
                  {statsPreview.reviewCount === 0
                    ? "No reviews yet"
                    : `${statsPreview.averageRating} ★ average (${statsPreview.reviewCount} review${
                        statsPreview.reviewCount === 1 ? "" : "s"
                      }) · offered help on ${statsPreview.helpsOfferedCount ?? 0} request${
                        statsPreview.helpsOfferedCount === 1 ? "" : "s"
                      }`}
                </strong>
              </p>
            )}

            <div className="field">
              <span className="label">Rating</span>
              <div className="module2-stars" role="group" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`module2-star ${n <= rating ? "module2-star--on" : ""}`}
                    onClick={() => setRating(n)}
                    aria-pressed={n <= rating}
                  >
                    ★
                  </button>
                ))}
                <span className="module2-star-label">{rating} / 5</span>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="rev-comment">
                Written review (optional)
              </label>
              <textarea
                id="rev-comment"
                className="input"
                rows={4}
                maxLength={2000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What went well? What could improve?"
              />
            </div>

            {formMessage.text && (
              <p className={formMessage.type === "ok" ? "module2-success" : "error"}>{formMessage.text}</p>
            )}

            <button type="submit" className="button" disabled={submitting || myPostsEligible.length === 0}>
              {submitting ? "Saving…" : "Submit review"}
            </button>
          </form>
        </section>

        <section className="card module2-card">
          <h2 className="module2-card__title">Reviews you gave</h2>
          {given.length === 0 ? (
            <p className="module2-muted">You have not submitted any reviews yet.</p>
          ) : (
            <>
              <ul className="module2-list">
                {given.slice(0, 1).map((r) => (
                  <li key={r._id} className="module2-list-item">
                    <strong>{r.rating}★</strong> to {r.reviewee?.name || "Mentor"}
                    {r.post && (
                      <span className="module2-muted">
                        {" "}
                        · {r.post.subject} / {r.post.topic}
                      </span>
                    )}
                    {r.comment ? <p className="module2-review-text">{r.comment}</p> : null}
                  </li>
                ))}
              </ul>
              {given.length > 1 && (
                <button
                  type="button"
                  className="module2-see-more"
                  onClick={() => navigate("/reviews/all-given")}
                >
                  See more ({given.length - 1} older)
                </button>
              )}
            </>
          )}

          <div id="reviews-received-section" ref={receivedSectionRef} className="module2-reviews-received-anchor">
            <h2 className="module2-card__title module2-card__title--second">Reviews you received</h2>
            {received.length === 0 ? (
              <p className="module2-muted">No reviews yet.</p>
            ) : (
              <>
                <ul className="module2-list">
                  {received.slice(0, 1).map((r) => (
                    <li key={r._id} className="module2-list-item">
                      <strong>{r.rating}★</strong> from {r.reviewer?.name || "Student"}
                      {r.post && (
                        <span className="module2-muted">
                          {" "}
                          · {r.post.subject} / {r.post.topic}
                        </span>
                      )}
                      {r.comment ? <p className="module2-review-text">{r.comment}</p> : null}
                    </li>
                  ))}
                </ul>
                {received.length > 1 && (
                  <button
                    type="button"
                    className="module2-see-more"
                    onClick={() => navigate("/reviews/all-received")}
                  >
                    See more ({received.length - 1} older)
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default RateMentor;
