import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReviewNotifications } from "../context/ReviewNotificationContext";

const Notifications = () => {
  const navigate = useNavigate();
  const { items, dismiss, clearAll, markAllRead } = useReviewNotifications();

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  const count = items.length;

  return (
    <div className="module2-page notifications-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Notifications</h1>
          <p className="module2-page__subtitle">
            New <strong>reviews</strong> and other alerts appear here. Open{" "}
            <Link to="/reviews">Ratings &amp; reviews</Link> for your full received history.
          </p>
        </div>
        <div className="notifications-page__header-actions">
          {count > 0 && (
            <button type="button" className="button button--ghost notifications-page__clear" onClick={clearAll}>
              Clear all
            </button>
          )}
          <button type="button" className="button module2-page__back" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </header>

      {count === 0 ? (
        <section className="card module2-card notifications-page__empty-card">
          <p className="module2-muted notifications-page__empty-text">
            You&apos;re caught up. When someone rates you while you&apos;re online, it will show here. Other kinds of
            alerts will be added here as the app grows.
          </p>
        </section>
      ) : (
        <ul className="notifications-page__list">
          {items.map((n) => (
            <li key={n.localId} className="notifications-page__item">
              <button
                type="button"
                className="notifications-page__item-main"
                onClick={() => {
                  dismiss(n.localId);
                  navigate("/reviews/all-received");
                }}
              >
                <span className="notifications-page__item-type">Review</span>
                <span className="notifications-page__item-line">
                  <strong>{n.reviewerName}</strong> rated you <strong>{n.rating}★</strong>
                  {n.post?.subject ? (
                    <span className="notifications-page__item-meta">
                      {" "}
                      · {n.post.subject}
                      {n.post.topic ? ` / ${n.post.topic}` : ""}
                    </span>
                  ) : null}
                </span>
                {n.comment ? (
                  <span className="notifications-page__item-comment">&ldquo;{n.comment}&rdquo;</span>
                ) : (
                  <span className="notifications-page__item-comment notifications-page__item-comment--muted">
                    No written comment.
                  </span>
                )}
                <span className="notifications-page__item-cta">View in Ratings &amp; reviews →</span>
              </button>
              <button
                type="button"
                className="notifications-page__item-dismiss"
                onClick={() => dismiss(n.localId)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Notifications;
