import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { connectChatSocket, getChatSocket } from "../socket/chatSocket";
import ConversationPanel from "../components/chat/ConversationPanel";
import StarAverage from "../components/ratings/StarAverage";
import { getReviewStats, getReviewsForUser } from "../api/reviews";

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [sidebarTab, setSidebarTab] = useState("chats");
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [profileStats, setProfileStats] = useState(null);
  const [profileReviews, setProfileReviews] = useState([]);
  const [profileRatingsLoading, setProfileRatingsLoading] = useState(false);
  const [listsReady, setListsReady] = useState(false);

  const activeChatIdRef = useRef("");
  const chatsRef = useRef([]);
  const lastHandledWithParam = useRef("");

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

  const normalizedSidebarQuery = sidebarQuery.trim().toLowerCase();

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      const otherParticipant = chat.participants?.find((participant) => participant._id !== user.id);
      const searchable = `${otherParticipant?.name || ""} ${otherParticipant?.email || ""}`.toLowerCase();
      return !normalizedSidebarQuery || searchable.includes(normalizedSidebarQuery);
    });
  }, [chats, user.id, normalizedSidebarQuery]);

  const filteredUsers = useMemo(() => {
    return users.filter((targetUser) => {
      if (targetUser._id === user.id) return false;
      const searchable = `${targetUser.name || ""} ${targetUser.email || ""}`.toLowerCase();
      return !normalizedSidebarQuery || searchable.includes(normalizedSidebarQuery);
    });
  }, [users, user.id, normalizedSidebarQuery]);

  const filteredInvites = useMemo(() => {
    return invites.filter((invite) => {
      const senderName = invite.senderId?.name || "";
      const senderEmail = invite.senderId?.email || "";
      const searchable = `${senderName} ${senderEmail}`.toLowerCase();
      return !normalizedSidebarQuery || searchable.includes(normalizedSidebarQuery);
    });
  }, [invites, normalizedSidebarQuery]);

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
    } finally {
      setListsReady(true);
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
    const withId = searchParams.get("with");
    if (!withId) {
      lastHandledWithParam.current = "";
      return;
    }
    if (!listsReady || !user?.id) return;
    if (lastHandledWithParam.current === withId) return;
    lastHandledWithParam.current = withId;

    const clearWithParam = () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("with");
          return next;
        },
        { replace: true }
      );
    };

    if (String(withId) === String(user.id)) {
      clearWithParam();
      return;
    }

    const chat = chats.find((c) => {
      const other = c.participants?.find((participant) => String(participant._id) !== String(user.id));
      return String(other?._id) === String(withId);
    });

    if (chat) {
      setActiveChatId(chat._id);
      setSidebarTab("chats");
    } else {
      setSidebarTab("people");
      sendInvite(withId)
        .then(() => {
          setInvitedUserIds((prev) => {
            const next = new Set(prev);
            next.add(withId);
            return next;
          });
        })
        .catch(() => {});
    }

    clearWithParam();
  }, [listsReady, chats, searchParams, user?.id, setSearchParams]);

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

    const onInviteReceived = (invite) => {
      setInvites((prev) => [invite, ...prev]);
    };

    const onInviteUpdated = ({ invite, chat }) => {
      if (invite.status !== "pending") {
        setInvites((prev) => prev.filter((item) => item._id !== invite._id));
      }
      if (chat) {
        setChats((prev) => {
          const exists = prev.some((item) => item._id === chat._id);
          return exists ? prev : [chat, ...prev];
        });
      }
    };

    const onChatCreated = (chat) => {
      setChats((prev) => {
        const exists = prev.some((item) => item._id === chat._id);
        return exists ? prev : [chat, ...prev];
      });
    };

    const onMessageNew = (message) => {
      if (String(message.chatId) === String(activeChatIdRef.current)) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const onPresenceUpdate = ({ userId, online }) => {
      setOnlineMap((prev) => {
        const next = new Map(prev);
        next.set(userId, online);
        return next;
      });
    };

    const onChatTyping = ({ chatId, userId, isTyping }) => {
      if (String(activeChatIdRef.current) !== String(chatId)) return;
      if (!isTyping) {
        setTypingUser("");
        return;
      }
      const currentChat = chatsRef.current.find((chat) => chat._id === chatId);
      const participant = currentChat?.participants?.find((item) => item._id === userId);
      setTypingUser(participant?.name || "Someone");
    };

    socket.on("invite:received", onInviteReceived);
    socket.on("invite:updated", onInviteUpdated);
    socket.on("chat:created", onChatCreated);
    socket.on("message:new", onMessageNew);
    socket.on("presence:update", onPresenceUpdate);
    socket.on("chat:typing", onChatTyping);

    return () => {
      socket.off("invite:received", onInviteReceived);
      socket.off("invite:updated", onInviteUpdated);
      socket.off("chat:created", onChatCreated);
      socket.off("message:new", onMessageNew);
      socket.off("presence:update", onPresenceUpdate);
      socket.off("chat:typing", onChatTyping);
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

  const activeOtherUserId = activeOtherParticipant?._id || activeOtherParticipant?.id;

  useEffect(() => {
    if (!activeOtherUserId) {
      setProfileStats(null);
      setProfileReviews([]);
      return;
    }
    let cancelled = false;
    setProfileRatingsLoading(true);
    (async () => {
      const id = String(activeOtherUserId);
      try {
        const [statsRes, revRes] = await Promise.all([
          getReviewStats(id),
          getReviewsForUser(id, { limit: 5 }),
        ]);
        if (!cancelled) {
          setProfileStats(statsRes.data.data);
          setProfileReviews(revRes.data.data || []);
        }
      } catch {
        if (!cancelled) {
          setProfileStats(null);
          setProfileReviews([]);
        }
      } finally {
        if (!cancelled) setProfileRatingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOtherUserId]);

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

        <div className="chat-sidebar-top">
          <input
            type="text"
            className="chat-sidebar-search"
            placeholder="Search chats, people, invites"
            value={sidebarQuery}
            onChange={(event) => setSidebarQuery(event.target.value)}
          />

          <div className="chat-sidebar-tabs" role="tablist" aria-label="Message sidebar tabs">
            {[
              { id: "chats", label: "Chats" },
              { id: "people", label: "People" },
              { id: "invites", label: "Invites" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={sidebarTab === tab.id}
                className={`chat-sidebar-tab ${sidebarTab === tab.id ? "is-active" : ""}`}
                onClick={() => setSidebarTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-sidebar-list">
          {sidebarTab === "chats" && (
            filteredChats.length > 0 ? (
              filteredChats.map((chat) => {
                const otherParticipant = chat.participants?.find((participant) => participant._id !== user.id);
                const isOnline = Boolean(onlineMap.get(otherParticipant?._id));
                const displayName = otherParticipant?.name || "Chat";

                return (
                  <button
                    type="button"
                    key={chat._id}
                    className={`chat-sidebar-item chat-sidebar-item--interactive ${chat._id === activeChatId ? "is-active" : ""}`}
                    onClick={() => setActiveChatId(chat._id)}
                  >
                    <div className="chat-sidebar-item-main">
                      <div className="chat-sidebar-avatar-wrap">
                        <span className="chat-sidebar-avatar">{displayName.charAt(0).toUpperCase()}</span>
                        <span className={`chat-sidebar-online-dot ${isOnline ? "is-online" : ""}`} />
                      </div>

                      <div className="chat-sidebar-item-text">
                        <p className="chat-user-name">{displayName}</p>
                        <p className="chat-user-meta">{otherParticipant?.email || "Tap to open chat"}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="chat-empty-text">No chats found.</p>
            )
          )}

          {sidebarTab === "people" && (
            filteredUsers.length > 0 ? (
              filteredUsers.map((targetUser) => {
                const isOnline = Boolean(onlineMap.get(targetUser._id));

                return (
                  <div className="chat-sidebar-item" key={targetUser._id}>
                    <div className="chat-sidebar-item-main">
                      <div className="chat-sidebar-avatar-wrap">
                        <span className="chat-sidebar-avatar">{targetUser.name?.charAt(0)?.toUpperCase() || "?"}</span>
                        <span className={`chat-sidebar-online-dot ${isOnline ? "is-online" : ""}`} />
                      </div>

                      <div className="chat-sidebar-item-text">
                        <p className="chat-user-name">{targetUser.name}</p>
                        <p className="chat-user-meta">{targetUser.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="chat-sidebar-invite-btn"
                      disabled={invitedUserIds.has(targetUser._id)}
                      onClick={() => handleInvite(targetUser._id)}
                    >
                      {invitedUserIds.has(targetUser._id) ? "Invited" : "Invite"}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="chat-empty-text">No people found.</p>
            )
          )}

          {sidebarTab === "invites" && (
            filteredInvites.length > 0 ? (
              filteredInvites.map((invite) => {
                const sender = invite.senderId;
                const isOnline = Boolean(onlineMap.get(sender?._id));

                return (
                  <div className="chat-sidebar-item chat-sidebar-item--invite" key={invite._id}>
                    <div className="chat-sidebar-item-main">
                      <div className="chat-sidebar-avatar-wrap">
                        <span className="chat-sidebar-avatar">{sender?.name?.charAt(0)?.toUpperCase() || "?"}</span>
                        <span className={`chat-sidebar-online-dot ${isOnline ? "is-online" : ""}`} />
                      </div>

                      <div className="chat-sidebar-item-text">
                        <p className="chat-user-name">{sender?.name || "A user"}</p>
                        <p className="chat-user-meta">{sender?.email || "Wants to chat"}</p>
                      </div>
                    </div>

                    <div className="chat-sidebar-item-actions">
                      <button
                        type="button"
                        className="chat-accept-btn"
                        onClick={() => handleRespondInvite(invite._id, "accepted")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="chat-reject-btn"
                        onClick={() => handleRespondInvite(invite._id, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="chat-empty-text">No pending invites.</p>
            )
          )}
        </div>
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

        <div className="chat-profile-info">
          <h4>Ratings</h4>
          {!activeOtherParticipant && <p className="chat-empty-text">—</p>}
          {activeOtherParticipant && profileRatingsLoading && (
            <p className="chat-empty-text">Loading…</p>
          )}
          {activeOtherParticipant && !profileRatingsLoading && profileStats?.reviewCount > 0 && (
            <>
              <div className="chat-profile-rating-row">
                <StarAverage average={profileStats.averageRating} size="md" />
                <span className="chat-profile-rating-meta">
                  {profileStats.averageRating != null ? profileStats.averageRating.toFixed(1) : "—"} ·{" "}
                  {profileStats.reviewCount} rating{profileStats.reviewCount === 1 ? "" : "s"}
                </span>
              </div>
              {profileStats.helpsOfferedCount != null && (
                <p className="chat-profile-helps-offered">
                  Offered help on {profileStats.helpsOfferedCount} request
                  {profileStats.helpsOfferedCount === 1 ? "" : "s"}
                </p>
              )}
              {profileReviews.length > 0 && (
                <ul className="chat-profile-mini-reviews">
                  {profileReviews.slice(0, 3).map((r) => (
                    <li key={r._id}>
                      <strong>{r.rating}★</strong> {r.reviewer?.name || "Peer"}
                      {r.comment ? (
                        <span className="chat-profile-mini-review-text"> — {r.comment}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {activeOtherParticipant && !profileRatingsLoading && (!profileStats || profileStats.reviewCount === 0) && (
            <p className="chat-empty-text">No ratings yet.</p>
          )}
          {activeOtherParticipant && (
            <Link
              to={`/profile/${String(activeOtherUserId)}`}
              className="chat-profile-full-link"
            >
              Full profile &amp; all reviews
            </Link>
          )}
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
