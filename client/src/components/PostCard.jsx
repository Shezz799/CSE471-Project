const PostCard = ({ post, currentUser, onDelete }) => {
  const authorName = post.author?.name || "Unknown";
  const authorId = post.author?._id || post.author;
  const isAuthor = currentUser && authorId && currentUser.id === authorId;
  const isAdmin = currentUser?.role === "admin";
  const canDelete = isAuthor || isAdmin;

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
      <p className="post-card__description">{post.description}</p>
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
