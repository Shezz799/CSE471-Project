import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyReviewsGiven, getMyReviewsReceived } from "../api/reviews";

/**
 * Full list of reviews you gave or received (opened from Rate mentor → See more).
 */
const ReviewsAll = ({ mode }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

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
            <li key={r._id} className="module2-list-item">
              {isGiven ? (
                <>
                  <strong>{r.rating}★</strong> to {r.reviewee?.name || "Mentor"}
                  {r.post && (
                    <span className="module2-muted">
                      {" "}
                      · {r.post.subject} / {r.post.topic}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <strong>{r.rating}★</strong> from {r.reviewer?.name || "Student"}
                  {r.post && (
                    <span className="module2-muted">
                      {" "}
                      · {r.post.subject} / {r.post.topic}
                    </span>
                  )}
                </>
              )}
              {r.comment ? <p className="module2-review-text">{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReviewsAll;
