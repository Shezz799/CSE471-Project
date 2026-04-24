import { useState } from "react";
import { Link } from "react-router-dom";
import StarAverage from "./ratings/StarAverage";

const SENTENCE_LIMIT = 2;

function getFirstSentences(text, limit = SENTENCE_LIMIT) {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  if (sentences.length <= limit) return trimmed;
  return sentences.slice(0, limit).join(" ").trim();
}

function hasMoreSentences(text, limit = SENTENCE_LIMIT) {
  if (!text || typeof text !== "string") return false;
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences.length > limit;
}

const PostCard = ({ post, currentUser, onDelete, onOfferHelp }) => {
  const [expanded, setExpanded] = useState(false);
  const [offering, setOffering] = useState(false);
  const authorName = post.author?.name || "Unknown";
  const authorInitial = authorName?.charAt(0)?.toUpperCase() || "?";
  const authorId = post.author?._id || post.author;
  const isAuthor = currentUser && authorId && currentUser.id === authorId;
  const isPanelAdmin = currentUser?.isDashboardAdmin;
  const canDelete = isAuthor || isPanelAdmin;

  // Determine if the current user has already offered help
  const alreadyOffered = Array.isArray(post.offers) && post.offers.some(
    (offer) => (offer._id || offer) === currentUser?.id
  );
  
  // Can offer help if not the author, post is open, and haven't already offered
  const canOfferHelp = currentUser && !isAuthor && post.status === "open" && !alreadyOffered;

  const description = post.description || "";
  const showExpand = hasMoreSentences(description);
  const displayDescription = showExpand && !expanded
    ? getFirstSentences(description)
    : description;

  const handleCardClick = (event) => {
    if (!showExpand) return;

    const interactiveTarget = event.target.closest("button, a, input, textarea, select, label");
    if (interactiveTarget) return;

    setExpanded((prev) => !prev);
  };

  const timestamp = post.createdAt
    ? new Date(post.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const handleDelete = async () => {
    if (!window.confirm("Remove this post?")) return;
    try {
      await onDelete(post._id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete");
    }
  };

  const handleOfferHelp = async () => {
    if (!onOfferHelp) return;
    setOffering(true);
    try {
      await onOfferHelp(post._id);
    } finally {
      setOffering(false);
    }
  };

  return (
    <article
      className={`post-card ${showExpand ? "post-card--expandable" : ""}`}
      onClick={handleCardClick}
    >
      <div className="post-card__layout">
        <div className="post-card__left" aria-hidden>
          <span className="post-card__author-avatar">{authorInitial}</span>
        </div>

        <div className="post-card__center">
          <div className="post-card__head">
            <span className="post-card__author">{authorName}</span>
            {timestamp && <span className="post-card__date">{timestamp}</span>}
          </div>

          <h3 className="post-card__subject">{post.subject}</h3>
          <p className="post-card__description">{displayDescription}</p>

          {showExpand && (
            <button
              type="button"
              className="post-card__toggle-details"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Minimize" : "Show Details"}
            </button>
          )}

          <div className="post-card__meta-line">
            {post.topic ? <p className="post-card__topic">{post.topic}</p> : null}
            <span className={`post-card__status post-card__status--${post.status}`}>
              {post.status}
            </span>
            {post.creditsOffered > 0 && (
              <span className="post-card__credits">{post.creditsOffered} credits</span>
            )}
          </div>
        </div>

        <div className="post-card__right">
          {canDelete ? (
            <button type="button" className="post-card__delete" onClick={handleDelete}>
              Remove
            </button>
          ) : canOfferHelp ? (
            <button
              type="button"
              className="button button--primary post-card__offer-btn"
              onClick={handleOfferHelp}
              disabled={offering}
            >
              {offering ? "Offering..." : "Offer Help"}
            </button>
          ) : alreadyOffered ? (
            <span className="post-card__offered-badge">You offered help</span>
          ) : null}
        </div>
      </div>

      {isAuthor && Array.isArray(post.offers) && post.offers.length > 0 && (
        <div className="post-card__offers">
          <h4 className="post-card__offers-title">Offers of Help ({post.offers.length})</h4>
          <ul className="post-card__offer-list">
            {post.offers.map((offer) => {
              const oid = offer._id || offer;
              const avg = offer.ratingSummary?.averageRating;
              return (
                <li key={oid} className="post-card__offer-item">
                  <span className="post-card__offer-main">
                    <Link to={`/profile/${oid}`} className="post-card__offer-name post-card__offer-name-link">
                      {offer.name || "Unknown Mentor"}
                    </Link>
                    {typeof avg === "number" && !Number.isNaN(avg) && (
                      <StarAverage average={avg} size="sm" className="post-card__offer-stars" />
                    )}
                    {offer.department && (
                      <span className="post-card__offer-dept">• {offer.department}</span>
                    )}
                    {offer.email && (
                      <span className="post-card__offer-email">({offer.email})</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
};

export default PostCard;
