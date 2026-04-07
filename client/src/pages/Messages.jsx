import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  fetchChats,
  fetchInvites,
  fetchMessages,
  fetchUsers,
  respondInvite,
  sendInvite,
  uploadMessageWithFile,
} from "../api/chat";
import { connectChatSocket, disconnectChatSocket, getChatSocket } from "../socket/chatSocket";
import UserListPanel from "../components/chat/UserListPanel";
import InvitePanel from "../components/chat/InvitePanel";
import ConversationPanel from "../components/chat/ConversationPanel";

const Messages = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [invites, setInvites] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [typingUser, setTypingUser] = useState("");
  const [onlineMap, setOnlineMap] = useState(new Map());
  const [invitedUserIds, setInvitedUserIds] = useState(new Set());
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const activeChatIdRef = useRef("");
  const chatsRef = useRef([]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat._id === activeChatId) || null,
    [chats, activeChatId]
  );

  const activeOtherParticipant = useMemo(() => {
    if (!activeChat) return null;
    return activeChat.participants?.find((participant) => participant._id !== user.id) || null;
  }, [activeChat, user.id]);

  const activeSkills = Array.isArray(activeOtherParticipant?.skills)
    ? activeOtherParticipant.skills.filter(Boolean)
    : [];

  const loadInitial = async () => {
    try {
      const [usersRes, chatsRes, invitesRes] = await Promise.all([
        fetchUsers(),
        fetchChats(),
        fetchInvites(),
      ]);

      setUsers(usersRes.data.data || []);
      setChats(chatsRes.data.data || []);
      setInvites(invitesRes.data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadMessages = async (chatId) => {
    if (!chatId) return;
    const { data } = await fetchMessages(chatId);
    setMessages(data.data || []);
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    if (!token) return;

    const socket = connectChatSocket(token);
    if (!socket) return;

    socket.on("invite:received", (invite) => {
      setInvites((prev) => [invite, ...prev]);
    });

    socket.on("invite:updated", ({ invite, chat }) => {
      if (invite.status !== "pending") {
        setInvites((prev) => prev.filter((item) => item._id !== invite._id));
      }
      if (chat) {
        setChats((prev) => {
          const exists = prev.some((item) => item._id === chat._id);
          return exists ? prev : [chat, ...prev];
        });
      }
    });

    socket.on("chat:created", (chat) => {
      setChats((prev) => {
        const exists = prev.some((item) => item._id === chat._id);
        return exists ? prev : [chat, ...prev];
      });
    });

    socket.on("message:new", (message) => {
      if (String(message.chatId) === String(activeChatIdRef.current)) {
        setMessages((prev) => [...prev, message]);
      }
    });

    socket.on("presence:update", ({ userId, online }) => {
      setOnlineMap((prev) => {
        const next = new Map(prev);
        next.set(userId, online);
        return next;
      });
    });

    socket.on("chat:typing", ({ chatId, userId, isTyping }) => {
      if (String(activeChatIdRef.current) !== String(chatId)) return;
      if (!isTyping) {
        setTypingUser("");
        return;
      }
      const currentChat = chatsRef.current.find((chat) => chat._id === chatId);
      const participant = currentChat?.participants?.find((item) => item._id === userId);
      setTypingUser(participant?.name || "Someone");
    });

    return () => {
      socket.removeAllListeners();
      disconnectChatSocket();
    };
  }, [token]);

  useEffect(() => {
    if (!activeChatId) return;
    loadMessages(activeChatId);
    const socket = getChatSocket();
    socket?.emit("chat:join", activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    setIsProfileDrawerOpen(false);
  }, [activeChatId]);

  const handleInvite = async (receiverId) => {
    await sendInvite(receiverId);
    setInvitedUserIds((prev) => {
      const next = new Set(prev);
      next.add(receiverId);
      return next;
    });
  };

  const handleRespondInvite = async (inviteId, action) => {
    const { data } = await respondInvite(inviteId, action);
    setInvites((prev) => prev.filter((invite) => invite._id !== inviteId));
    if (data.data.chat) {
      setChats((prev) => {
        const exists = prev.some((chat) => chat._id === data.data.chat._id);
        return exists ? prev : [data.data.chat, ...prev];
      });
      setActiveChatId(data.data.chat._id);
    }
  };

  const handleSendMessage = async () => {
    if (!activeChatId) return;

    const text = messageText.trim();
    const socket = getChatSocket();

    if (selectedFile) {
      const formData = new FormData();
      formData.append("text", text);
      formData.append("file", selectedFile);
      await uploadMessageWithFile(activeChatId, formData);
      setSelectedFile(null);
      setMessageText("");
      return;
    }

    if (!text) return;

    socket?.emit("message:send", {
      chatId: activeChatId,
      text,
    });

    setMessageText("");
  };

  const handleTyping = (isTyping) => {
    const socket = getChatSocket();
    if (!socket || !activeChatId) return;
    socket.emit("chat:typing", { chatId: activeChatId, isTyping });
  };

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar__head">
          <h1>Messages</h1>
          <button type="button" className="chat-back-btn" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>

        <InvitePanel invites={invites} onRespond={handleRespondInvite} />

        <div className="chat-list-box">
          <h3 className="chat-section-title">Chats</h3>
          {chats.map((chat) => {
            const otherParticipant = chat.participants?.find((participant) => participant._id !== user.id);
            return (
              <button
                type="button"
                key={chat._id}
                className={`chat-list-item ${chat._id === activeChatId ? "chat-list-item--active" : ""}`}
                onClick={() => setActiveChatId(chat._id)}
              >
                <div>
                  <p className="chat-user-name">{otherParticipant?.name || "Chat"}</p>
                  <p className="chat-user-meta">{otherParticipant?.email || ""}</p>
                </div>
                <span className={`chat-presence-dot ${onlineMap.get(otherParticipant?._id) ? "is-online" : ""}`} />
              </button>
            );
          })}
        </div>

        <UserListPanel users={users} onInvite={handleInvite} invitedUserIds={invitedUserIds} />
      </aside>

      <main className="chat-middle-pane">
        <ConversationPanel
          activeChat={activeChat}
          currentUser={user}
          messages={messages}
          onlineMap={onlineMap}
          messageText={messageText}
          setMessageText={setMessageText}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          typingUser={typingUser}
          onToggleProfile={() => setIsProfileDrawerOpen((prev) => !prev)}
          isProfileOpen={isProfileDrawerOpen}
        />
      </main>

      <aside className={`chat-profile-panel ${isProfileDrawerOpen ? "is-open" : ""}`}>
        <div className="chat-profile-head">
          <h3>Profile</h3>
          <button
            type="button"
            className="chat-profile-close-btn"
            onClick={() => setIsProfileDrawerOpen(false)}
            aria-label="Close profile panel"
          >
            Close
          </button>
        </div>
        <div className="chat-profile-card">
          <div className="chat-profile-avatar">
            {activeOtherParticipant?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <h3>{activeOtherParticipant?.name || "No chat selected"}</h3>
          <p>{activeOtherParticipant ? "Active now" : "Select a user to view profile"}</p>

          <div className="chat-profile-actions">
            <button
              type="button"
              className="chat-profile-action-btn chat-profile-action-btn--call"
              disabled={!activeOtherParticipant}
            >
              Call
            </button>
            <button type="button" className="chat-block-btn" disabled={!activeOtherParticipant}>
              Block
            </button>
          </div>
        </div>

        <div className="chat-profile-info">
          <h4>Details</h4>
          <div className="chat-profile-detail-row">
            <span className="chat-profile-label">Email</span>
            <span className="chat-profile-value">{activeOtherParticipant?.email || "-"}</span>
          </div>
          <div className="chat-profile-detail-row">
            <span className="chat-profile-label">Department</span>
            <span className="chat-profile-value">{activeOtherParticipant?.department || "-"}</span>
          </div>
        </div>

        <div className="chat-profile-info">
          <h4>Skills</h4>
          <div className="chat-skill-chips" role="list" aria-label="Skills list">
            {activeSkills.length > 0 ? (
              activeSkills.map((skill) => (
                <span key={skill} className="chat-skill-chip" role="listitem">
                  {skill}
                </span>
              ))
            ) : (
              <p className="chat-empty-text">No skills added yet.</p>
            )}
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={`chat-profile-backdrop ${isProfileDrawerOpen ? "is-open" : ""}`}
        aria-label="Close profile panel"
        onClick={() => setIsProfileDrawerOpen(false)}
      />
    </div>
  );
};

export default Messages;
