import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPosts } from "../api/posts";
import {
  createReview,
  getMyReviewsGiven,
  getMyReviewsReceived,
  getReviewStats,
} from "../api/reviews";
import { lookupUserByEmail } from "../api/users";

const RateMentor = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [postId, setPostId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [mentorEmail, setMentorEmail] = useState("");
  const [mentorFromLookup, setMentorFromLookup] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

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

  const selectedPost = useMemo(
    () => myPosts.find((p) => p._id === postId) || null,
    [myPosts, postId]
  );

  const offerMentors = selectedPost?.offers || [];

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
    if (postId) {
      setMentorFromLookup(null);
      setMentorEmail("");
      setLookupError("");
      setMentorId("");
      setStatsPreview(null);
    }
  }, [postId]);

  useEffect(() => {
    const id =
      mentorId ||
      (mentorFromLookup?.id && !postId ? mentorFromLookup.id : null);
    if (!id) {
      setStatsPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getReviewStats(id);
        if (!cancelled) setStatsPreview(data.data);
      } catch {
        if (!cancelled) setStatsPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mentorId, mentorFromLookup?.id, postId]);

  const handleLookupEmail = async () => {
    setLookupError("");
    setMentorFromLookup(null);
    const email = mentorEmail.trim().toLowerCase();
    if (!email) {
      setLookupError("Enter the mentor's university email.");
      return;
    }
    setLookupLoading(true);
    try {
      const { data } = await lookupUserByEmail(email);
      setMentorFromLookup(data.data);
    } catch (err) {
      setLookupError(err.response?.data?.message || "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  const resolveRevieweeId = () => {
    if (postId) {
      return mentorId || null;
    }
    return mentorFromLookup?.id || null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMessage({ type: "", text: "" });
    const revieweeId = resolveRevieweeId();
    if (!revieweeId) {
      setFormMessage({
        type: "error",
        text: postId
          ? "Choose a mentor from the list (they must have offered help on that request)."
          : "Look up the mentor by email first.",
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
        revieweeId,
        postId: postId || undefined,
        rating,
        comment: comment.trim(),
      });
      setFormMessage({ type: "ok", text: "Thank you — your review was saved." });
      setComment("");
      setRating(5);
      if (!postId) {
        setMentorFromLookup(null);
        setMentorEmail("");
      } else {
        setMentorId("");
      }
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
            Rate a mentor after they help you. If the help was for a posted request, link that request
            — only mentors who offered help on it can be selected.
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
          <form className="module2-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="rev-post">
                Related help request (optional)
              </label>
              <select
                id="rev-post"
                className="input"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
              >
                <option value="">— Not tied to a specific post —</option>
                {myPosts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.subject}: {p.topic}
                  </option>
                ))}
              </select>
              <p className="module2-hint">
                If you choose a post, you must pick a mentor who used &quot;Offer help&quot; on that post.
              </p>
            </div>

            {postId ? (
              <div className="field">
                <label className="label" htmlFor="rev-mentor">
                  Mentor
                </label>
                {offerMentors.length === 0 ? (
                  <p className="module2-muted">No one has offered help on this request yet.</p>
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
            ) : (
              <div className="field">
                <label className="label" htmlFor="rev-email">
                  Mentor email
                </label>
                <div className="module2-inline">
                  <input
                    id="rev-email"
                    className="input"
                    type="email"
                    value={mentorEmail}
                    onChange={(e) => setMentorEmail(e.target.value)}
                    placeholder="name@g.bracu.ac.bd"
                  />
                  <button
                    type="button"
                    className="button"
                    onClick={handleLookupEmail}
                    disabled={lookupLoading}
                  >
                    {lookupLoading ? "…" : "Look up"}
                  </button>
                </div>
                {lookupError && <p className="error module2-field-error">{lookupError}</p>}
                {mentorFromLookup && (
                  <p className="module2-lookup-ok">
                    Mentor: <strong>{mentorFromLookup.name}</strong> ({mentorFromLookup.email})
                  </p>
                )}
              </div>
            )}

            {statsPreview && (mentorId || mentorFromLookup) && (
              <p className="module2-stats-preview">
                Their public stats:{" "}
                <strong>
                  {statsPreview.reviewCount === 0
                    ? "No reviews yet"
                    : `${statsPreview.averageRating} ★ average (${statsPreview.reviewCount} review${
                        statsPreview.reviewCount === 1 ? "" : "s"
                      })`}
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
              <p className={formMessage.type === "ok" ? "module2-success" : "error"}>
                {formMessage.text}
              </p>
            )}

            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Saving…" : "Submit review"}
            </button>
          </form>
        </section>

        <section className="card module2-card">
          <h2 className="module2-card__title">Reviews you gave</h2>
          {given.length === 0 ? (
            <p className="module2-muted">You have not submitted any reviews yet.</p>
          ) : (
            <ul className="module2-list">
              {given.map((r) => (
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
          )}

          <h2 className="module2-card__title module2-card__title--second">Reviews you received</h2>
          {received.length === 0 ? (
            <p className="module2-muted">No reviews yet.</p>
          ) : (
            <ul className="module2-list">
              {received.map((r) => (
                <li key={r._id} className="module2-list-item">
                  <strong>{r.rating}★</strong> from {r.reviewer?.name || "Student"}
                  {r.comment ? <p className="module2-review-text">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default RateMentor;
