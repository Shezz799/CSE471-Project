import { useState } from "react";

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

const PostCard = ({ post, currentUser, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const authorName = post.author?.name || "Unknown";
  const authorId = post.author?._id || post.author;
  const isAuthor = currentUser && authorId && currentUser.id === authorId;
  const isAdmin = currentUser?.role === "admin";
  const canDelete = isAuthor || isAdmin;

  const description = post.description || "";
  const showExpand = hasMoreSentences(description);
  const displayDescription = showExpand && !expanded
    ? getFirstSentences(description)
    : description;

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

  return (
    <article className="post-card">
      <div className="post-card__meta">
        <span className="post-card__author">{authorName}</span>
        <span className="post-card__date">{timestamp}</span>
        {canDelete && (
          <button type="button" className="post-card__delete" onClick={handleDelete}>
            Remove
          </button>
        )}
      </div>
      <h3 className="post-card__subject">{post.subject}</h3>
      <p className="post-card__topic">Topic: {post.topic}</p>
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
      {post.creditsOffered > 0 && (
        <p className="post-card__credits">{post.creditsOffered} credits offered</p>
      )}
      <span className={`post-card__status post-card__status--${post.status}`}>
        {post.status}
      </span>
    </article>
  );
};

export default PostCard;
