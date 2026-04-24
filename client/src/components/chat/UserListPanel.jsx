const UserListPanel = ({ users, onInvite, invitedUserIds }) => {
  return (
    <div className="chat-users-panel">
      <h3 className="chat-section-title">People</h3>
      <div className="chat-users-list">
        {users.map((targetUser) => (
          <div className="chat-user-row" key={targetUser._id}>
            <div>
              <p className="chat-user-name">{targetUser.name}</p>
              <p className="chat-user-meta">{targetUser.email}</p>
            </div>
            <button
              type="button"
              className="chat-invite-btn"
              disabled={invitedUserIds.has(targetUser._id)}
              onClick={() => onInvite(targetUser._id)}
            >
              {invitedUserIds.has(targetUser._id) ? "Invited" : "Invite"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserListPanel;
