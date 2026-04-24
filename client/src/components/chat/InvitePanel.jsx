const InvitePanel = ({ invites, onRespond }) => {
  return (
    <div className="chat-invite-panel">
      <h3 className="chat-section-title">Chat Invites</h3>
      {invites.length === 0 && <p className="chat-empty-text">No pending invites.</p>}
      {invites.map((invite) => (
        <div className="chat-invite-item" key={invite._id}>
          <p className="chat-invite-text">
            <strong>{invite.senderId?.name || "A user"}</strong> invited you to chat.
          </p>
          <div className="chat-invite-actions">
            <button
              type="button"
              className="chat-accept-btn"
              onClick={() => onRespond(invite._id, "accepted")}
            >
              Accept
            </button>
            <button
              type="button"
              className="chat-reject-btn"
              onClick={() => onRespond(invite._id, "rejected")}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InvitePanel;
