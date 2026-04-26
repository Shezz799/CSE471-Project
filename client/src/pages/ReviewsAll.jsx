import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteMyReview, getMyReviewsGiven, getMyReviewsReceived } from "../api/reviews";

/**
 * Full list of reviews you gave or received (opened from Rate mentor → See more).
 */
const ReviewsAll = ({ mode }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const isGiven = mode === "given";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fn = isGiven ? getMyReviewsGiven : getMyReviewsReceived;
        const { data } = await fn();
        if (!cancelled) setList(data.data || []);
      } catch {
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGiven]);

  const handleDeleteGiven = async (reviewId) => {
    if (!isGiven || !reviewId || deletingId) return;
    setDeletingId(reviewId);
    try {
      await deleteMyReview(reviewId);
      setList((prev) => prev.filter((r) => String(r._id) !== String(reviewId)));
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="module2-page reviews-all-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">{isGiven ? "Reviews you gave" : "Reviews you received"}</h1>
          <p className="module2-page__subtitle">
            {isGiven
              ? "Every rating and comment you have submitted for mentors."
              : "Every rating and comment other students left for you."}
          </p>
        </div>
        <div className="reviews-all-page__actions">
          <Link to="/reviews" className="button module2-page__back reviews-all-page__back-link">
            Back to ratings
          </Link>
        </div>
      </header>

      {loading ? (
        <p className="module2-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="module2-muted">No reviews in this list yet.</p>
      ) : (
        <ul className="module2-list">
          {list.map((r) => (
            <li key={r._id} className={`module2-list-item${isGiven ? " module2-review-given-row" : ""}`}>
              {isGiven ? (
                <>
                  <div className="module2-review-given-row__body">
                    <strong>{Number(r.rating).toFixed(2)}★</strong> to {r.reviewee?.name || "Mentor"}
                    {r.post && (
                      <span className="module2-muted">
                        {" "}
                        · {r.post.subject} / {r.post.topic}
                      </span>
                    )}
                    {r.comment ? <p className="module2-review-text">{r.comment}</p> : null}
                    {r.criteria ? (
                      <p className="module2-muted">
                        Topic {r.criteria.topicKnowledge}/5 · Clarity {r.criteria.teachingClarity}/5 · Communication{" "}
                        {r.criteria.communication}/5 · Patience {r.criteria.patience}/5 · Professionalism{" "}
                        {r.criteria.professionalism}/5 · Helpfulness {r.criteria.helpfulness}/5
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="module2-btn-delete-review"
                    disabled={deletingId === r._id}
                    onClick={() => handleDeleteGiven(r._id)}
                  >
                    {deletingId === r._id ? "…" : "Delete"}
                  </button>
                </>
              ) : (
                <>
                  <strong>{Number(r.rating).toFixed(2)}★</strong> from {r.reviewer?.name || "Student"}
                  {r.post && (
                    <span className="module2-muted">
                      {" "}
                      · {r.post.subject} / {r.post.topic}
                    </span>
                  )}
                  {r.comment ? <p className="module2-review-text">{r.comment}</p> : null}
                  {r.criteria ? (
                    <p className="module2-muted">
                      Topic {r.criteria.topicKnowledge}/5 · Clarity {r.criteria.teachingClarity}/5 · Communication{" "}
                      {r.criteria.communication}/5 · Patience {r.criteria.patience}/5 · Professionalism{" "}
                      {r.criteria.professionalism}/5 · Helpfulness {r.criteria.helpfulness}/5
                    </p>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReviewsAll;
