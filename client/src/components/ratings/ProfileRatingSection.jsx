import { useMemo } from "react";
import StarAverage from "./StarAverage";

const STAR_ORDER = [5, 4, 3, 2, 1];

const ProfileRatingSection = ({
  stats,
  reviews,
  reviewsLoading,
  filterStars,
  onFilterStarsChange,
}) => {
  const maxBar = useMemo(() => {
    if (!stats?.distribution) return 1;
    return Math.max(1, ...STAR_ORDER.map((k) => stats.distribution[String(k)] || 0));
  }, [stats]);

  const handleFilter = (stars) => {
    const next = filterStars === stars ? null : stars;
    onFilterStarsChange?.(next);
  };

  if (!stats) return null;

  const { reviewCount, averageRating, distribution, helpsOfferedCount } = stats;
  const hasReviews = reviewCount > 0 && averageRating != null;

  return (
    <section className="profile-rating-section">
      <h2 className="profile-rating-section__title">Ratings &amp; reviews</h2>

      {hasReviews ? (
        <div className="profile-rating-summary">
          <div className="profile-rating-summary__left">
            <div className="profile-rating-summary__score">
              {averageRating.toFixed(1)}
              <span className="profile-rating-summary__out">/5</span>
            </div>
            <StarAverage average={averageRating} size="lg" className="profile-rating-summary__stars" />
            <p className="profile-rating-summary__meta">
              {reviewCount} rating{reviewCount === 1 ? "" : "s"}
            </p>
            {helpsOfferedCount != null && (
              <p className="profile-rating-summary__helps">
                Offered help on {helpsOfferedCount} request{helpsOfferedCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <div className="profile-rating-summary__bars" aria-label="Rating breakdown">
            {STAR_ORDER.map((stars) => {
              const count = distribution?.[String(stars)] ?? 0;
              const w = maxBar ? (count / maxBar) * 100 : 0;
              return (
                <div key={stars} className="profile-rating-bar-row">
                  <span className="profile-rating-bar-row__label">{stars}★</span>
                  <div className="profile-rating-bar-row__track">
                    <div className="profile-rating-bar-row__fill" style={{ width: `${w}%` }} />
                  </div>
                  <span className="profile-rating-bar-row__count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="profile-rating-section__empty">No ratings yet — they need at least one review from a help request.</p>
      )}

      {hasReviews && (
        <>
          <div className="profile-review-filters">
            <span className="profile-review-filters__label">Filter:</span>
            <button
              type="button"
              className={`profile-review-chip ${filterStars == null ? "is-active" : ""}`}
              onClick={() => handleFilter(null)}
            >
              All
            </button>
            {STAR_ORDER.map((n) => (
              <button
                key={n}
                type="button"
                className={`profile-review-chip ${filterStars === n ? "is-active" : ""}`}
                onClick={() => handleFilter(n)}
              >
                {n}★
              </button>
            ))}
          </div>

          <h3 className="profile-reviews-list__heading">Reviews</h3>
          {reviewsLoading ? (
            <p className="module2-muted">Loading reviews…</p>
          ) : !reviews?.length ? (
            <p className="module2-muted">No reviews in this filter.</p>
          ) : (
            <ul className="profile-reviews-list">
              {reviews.map((r) => (
                <li key={r._id} className="profile-review-card">
                  <div className="profile-review-card__head">
                    <span className="profile-review-card__stars" aria-label={`${r.rating} out of 5`}>
                      {"★".repeat(r.rating)}
                      <span className="profile-review-card__stars-off">{"★".repeat(5 - r.rating)}</span>
                    </span>
                    <span className="profile-review-card__by">
                      {r.reviewer?.name || "Student"}
                      {r.post?.subject && (
                        <span className="profile-review-card__ctx">
                          {" "}
                          · {r.post.subject}
                          {r.post.topic ? ` — ${r.post.topic}` : ""}
                        </span>
                      )}
                    </span>
                    {r.createdAt && (
                      <time className="profile-review-card__date" dateTime={r.createdAt}>
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </time>
                    )}
                  </div>
                  {r.comment ? <p className="profile-review-card__text">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default ProfileRatingSection;
