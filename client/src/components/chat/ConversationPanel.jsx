import { useEffect, useMemo, useRef } from "react";

const MAX_COMPOSER_HEIGHT = 180;

const formatTime = (timeValue) => {
  if (!timeValue) return "";
  return new Date(timeValue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const ConversationPanel = ({
  activeChat,
  currentUser,
  messages,
  onlineMap,
  messageText,
  setMessageText,
  selectedFile,
  setSelectedFile,
  onSendMessage,
  onTyping,
  typingUser,
  onToggleProfile,
  isProfileOpen,
  onStartVoiceCall,
  canStartVoiceCall,
}) => {
  const composerInputRef = useRef(null);

  const resizeComposerInput = (inputEl) => {
    if (!inputEl) return;

    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
    inputEl.style.overflowY = inputEl.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  };

  const otherParticipant = useMemo(() => {
    if (!activeChat) return null;
    return activeChat.participants?.find((participant) => participant._id !== currentUser.id) || null;
  }, [activeChat, currentUser.id]);

  useEffect(() => {
    resizeComposerInput(composerInputRef.current);
  }, [messageText, activeChat?._id]);

  if (!activeChat) {
    return (
      <section className="chat-conversation chat-conversation--empty">
        <p>Select a chat to start messaging.</p>
      </section>
    );
  }

  return (
    <section className="chat-conversation">
      <div className="chat-conversation__header">
        <div className="chat-conversation__user">
          <div className="chat-conversation__avatar">
            {otherParticipant?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <h2>{otherParticipant?.name || "Chat"}</h2>
            <p>
              {onlineMap.get(otherParticipant?._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-call-btn"
            aria-label="Start voice call"
            onClick={onStartVoiceCall}
            disabled={!canStartVoiceCall}
          >
            Start Voice Call
          </button>
          <button
            type="button"
            className="chat-profile-toggle-btn"
            onClick={onToggleProfile}
            aria-label={isProfileOpen ? "Hide profile panel" : "Show profile panel"}
          >
            {isProfileOpen ? "Hide profile" : "Profile"}
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => {
          const isMine = (message.senderId?._id || message.senderId) === currentUser.id;
          const senderName = typeof message.senderId === "object"
            ? message.senderId?.name
            : otherParticipant?.name;
          const senderInitial = senderName?.charAt(0)?.toUpperCase() || "?";

          return (
            <div
              key={message._id}
              className={`chat-message-row ${isMine ? "chat-message-row--mine" : "chat-message-row--received"}`}
            >
              {!isMine && (
                <div className="chat-message-avatar" aria-hidden="true">
                  {senderInitial}
                </div>
              )}

              <div className={`chat-message ${isMine ? "chat-message--mine" : ""}`}>
                <p className="chat-message-author">{isMine ? "You" : (senderName || "User")}</p>
                {message.text && <p>{message.text}</p>}
                {message.fileUrl && (
                  <a href={message.fileUrl} target="_blank" rel="noreferrer" className="chat-file-link">
                    {message.fileType || "Attachment"}
                  </a>
                )}
                <span className="chat-message-time">{formatTime(message.createdAt)}</span>
              </div>
            </div>
          );
        })}
        {typingUser && <p className="chat-typing">{typingUser} is typing...</p>}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSendMessage();
        }}
      >
        <textarea
          ref={composerInputRef}
          className="chat-input"
          value={messageText}
          onChange={(event) => {
            setMessageText(event.target.value);
            resizeComposerInput(event.target);
            onTyping(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSendMessage();
            }
          }}
          onBlur={() => onTyping(false)}
          placeholder="Type your message..."
          rows={1}
        />
        <input
          type="file"
          className="chat-file-input"
          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
        />
        {selectedFile && <span className="chat-selected-file">{selectedFile.name}</span>}
        <button type="submit" className="chat-send-btn">Send</button>
      </form>
    </section>
  );
};

export default ConversationPanel;
