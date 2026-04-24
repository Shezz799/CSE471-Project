const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const User = require("../models/User");

let io;
const onlineUsers = new Map();
const activeCallSessions = new Map();

const getCallSession = (userId) => activeCallSessions.get(String(userId)) || null;

const setCallSessionPair = (userAId, userBId, chatId, state) => {
  const normalizedChatId = String(chatId);
  const normalizedState = state || "ringing";

  activeCallSessions.set(String(userAId), {
    peerUserId: String(userBId),
    chatId: normalizedChatId,
    state: normalizedState,
  });

  activeCallSessions.set(String(userBId), {
    peerUserId: String(userAId),
    chatId: normalizedChatId,
    state: normalizedState,
  });
};

const clearCallSessionForUser = (userId) => {
  const normalizedUserId = String(userId);
  const session = activeCallSessions.get(normalizedUserId);
  if (!session) return null;

  activeCallSessions.delete(normalizedUserId);

  const peerUserId = String(session.peerUserId);
  const peerSession = activeCallSessions.get(peerUserId);
  if (peerSession && String(peerSession.peerUserId) === normalizedUserId) {
    activeCallSessions.delete(peerUserId);
  }

  return session;
};

const isUserBusyWithAnotherCall = (userId, otherUserId, chatId) => {
  const session = getCallSession(userId);
  if (!session) return false;

  const samePeer = String(session.peerUserId) === String(otherUserId);
  const sameChat = String(session.chatId) === String(chatId);

  return !(samePeer && sameChat);
};

const addUserSocket = (userId, socketId) => {
  const currentSockets = onlineUsers.get(userId) || new Set();
  currentSockets.add(socketId);
  onlineUsers.set(userId, currentSockets);
};

const removeUserSocket = (userId, socketId) => {
  const currentSockets = onlineUsers.get(userId);
  if (!currentSockets) return;
  currentSockets.delete(socketId);
  if (currentSockets.size === 0) {
    onlineUsers.delete(userId);
  }
};

const emitToUser = (userId, eventName, payload) => {
  if (!io) return;
  const socketIds = onlineUsers.get(String(userId));
  if (socketIds && socketIds.size > 0) {
    socketIds.forEach((socketId) => {
      io.to(socketId).emit(eventName, payload);
    });
    return;
  }

  io.to(`user:${String(userId)}`).emit(eventName, payload);
};

const joinUserSocketsToChatRoom = (userId, chatId) => {
  if (!io) return;
  const socketIds = onlineUsers.get(String(userId));
  if (!socketIds) return;

  socketIds.forEach((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(String(chatId));
    }
  });
};

const joinUserRooms = async (socket, userId) => {
  socket.join(`user:${String(userId)}`);

  const chats = await Chat.find({ participants: userId }).select("_id");
  chats.forEach((chat) => socket.join(String(chat._id)));
};

const isParticipantInChat = async (chatId, userId) => {
  const chat = await Chat.findById(chatId).select("participants");
  if (!chat) {
    return { allowed: false, message: "Chat not found" };
  }
  const allowed = chat.participants.some((participantId) => String(participantId) === String(userId));
  return { allowed, message: allowed ? "" : "Not authorized for this chat" };
};

const validateCallRouting = async ({ chatId, senderUserId, targetUserId }) => {
  if (!chatId || !targetUserId) {
    return { allowed: false, message: "chatId and targetUserId are required" };
  }

  if (String(senderUserId) === String(targetUserId)) {
    return { allowed: false, message: "You cannot call yourself" };
  }

  const chat = await Chat.findById(chatId).select("participants");
  if (!chat) {
    return { allowed: false, message: "Chat not found" };
  }

  const senderAllowed = chat.participants.some((participantId) => String(participantId) === String(senderUserId));
  if (!senderAllowed) {
    return { allowed: false, message: "Not authorized for this chat" };
  }

  const targetAllowed = chat.participants.some((participantId) => String(participantId) === String(targetUserId));
  if (!targetAllowed) {
    return { allowed: false, message: "Target user is not in this chat" };
  }

  return { allowed: true };
};

const setupSocketHandlers = (socket) => {
  const userId = socket.user.id;

  socket.on("chat:join", async (chatId) => {
    const { allowed, message } = await isParticipantInChat(chatId, userId);
    if (!allowed) {
      socket.emit("socket:error", { message });
      return;
    }
    socket.join(String(chatId));
  });

  socket.on("message:send", async (payload) => {
    try {
      const { chatId, text, fileUrl = "", fileType = "" } = payload || {};
      if (!chatId) {
        socket.emit("socket:error", { message: "chatId is required" });
        return;
      }

      const { allowed, message: membershipError } = await isParticipantInChat(chatId, userId);
      if (!allowed) {
        socket.emit("socket:error", { message: membershipError });
        return;
      }

      if (!String(text || "").trim() && !fileUrl) {
        socket.emit("socket:error", { message: "Message text or file is required" });
        return;
      }

      const savedMessage = await Message.create({
        chatId,
        senderId: userId,
        text: text || "",
        fileUrl,
        fileType,
      });

      const populatedMessage = await Message.findById(savedMessage._id).populate("senderId", "name email");
      io.to(String(chatId)).emit("message:new", populatedMessage);
    } catch (error) {
      socket.emit("socket:error", { message: error.message });
    }
  });

  socket.on("chat:typing", async (payload) => {
    const { chatId, isTyping } = payload || {};
    if (!chatId) return;
    const { allowed } = await isParticipantInChat(chatId, userId);
    if (!allowed) return;
    socket.to(String(chatId)).emit("chat:typing", {
      chatId,
      userId,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on("call_user", async (payload) => {
    try {
      const { targetUserId, chatId } = payload || {};

      const { allowed, message } = await validateCallRouting({
        chatId,
        senderUserId: userId,
        targetUserId,
      });

      if (!allowed) {
        socket.emit("socket:error", { message });
        return;
      }

      if (isUserBusyWithAnotherCall(userId, targetUserId, chatId)) {
        socket.emit("call_busy", {
          chatId,
          targetUserId,
          reason: "You are already on another call",
        });
        return;
      }

      if (isUserBusyWithAnotherCall(targetUserId, userId, chatId)) {
        socket.emit("call_busy", {
          chatId,
          targetUserId,
          reason: "Target user is currently on another call",
        });
        return;
      }

      if (!onlineUsers.has(String(targetUserId))) {
        socket.emit("call_unavailable", {
          chatId,
          targetUserId,
          reason: "Target user is offline",
        });
        return;
      }

      setCallSessionPair(userId, targetUserId, chatId, "ringing");

      emitToUser(targetUserId, "call_user", {
        chatId,
        fromUserId: userId,
        fromUserName: socket.user.name,
      });
    } catch (error) {
      socket.emit("socket:error", { message: error.message });
    }
  });

  socket.on("call_offer", async (payload) => {
    try {
      const { targetUserId, chatId, offer } = payload || {};
      if (!offer) {
        socket.emit("socket:error", { message: "offer is required" });
        return;
      }

      const { allowed, message } = await validateCallRouting({
        chatId,
        senderUserId: userId,
        targetUserId,
      });

      if (!allowed) {
        socket.emit("socket:error", { message });
        return;
      }

      if (isUserBusyWithAnotherCall(userId, targetUserId, chatId) || isUserBusyWithAnotherCall(targetUserId, userId, chatId)) {
        socket.emit("call_busy", {
          chatId,
          targetUserId,
          reason: "Call target is no longer available",
        });
        return;
      }

      setCallSessionPair(userId, targetUserId, chatId, "ringing");

      emitToUser(targetUserId, "call_offer", {
        chatId,
        fromUserId: userId,
        fromUserName: socket.user.name,
        offer,
      });
    } catch (error) {
      socket.emit("socket:error", { message: error.message });
    }
  });

  socket.on("call_answer", async (payload) => {
    try {
      const { targetUserId, chatId, answer } = payload || {};
      if (!answer) {
        socket.emit("socket:error", { message: "answer is required" });
        return;
      }

      const { allowed, message } = await validateCallRouting({
        chatId,
        senderUserId: userId,
        targetUserId,
      });

      if (!allowed) {
        socket.emit("socket:error", { message });
        return;
      }

      if (isUserBusyWithAnotherCall(userId, targetUserId, chatId) || isUserBusyWithAnotherCall(targetUserId, userId, chatId)) {
        socket.emit("call_unavailable", {
          chatId,
          targetUserId,
          reason: "Call session is no longer active",
        });
        return;
      }

      setCallSessionPair(userId, targetUserId, chatId, "connected");

      emitToUser(targetUserId, "call_answer", {
        chatId,
        fromUserId: userId,
        fromUserName: socket.user.name,
        answer,
      });
    } catch (error) {
      socket.emit("socket:error", { message: error.message });
    }
  });

  socket.on("call_ice_candidate", async (payload) => {
    try {
      const { targetUserId, chatId, candidate } = payload || {};
      if (!candidate) {
        socket.emit("socket:error", { message: "candidate is required" });
        return;
      }

      const { allowed, message } = await validateCallRouting({
        chatId,
        senderUserId: userId,
        targetUserId,
      });

      if (!allowed) {
        socket.emit("socket:error", { message });
        return;
      }

      emitToUser(targetUserId, "call_ice_candidate", {
        chatId,
        fromUserId: userId,
        fromUserName: socket.user.name,
        candidate,
      });
    } catch (error) {
      socket.emit("socket:error", { message: error.message });
    }
  });

  socket.on("call_end", async (payload) => {
    try {
      const { targetUserId, chatId, reason = "Call ended" } = payload || {};

      const { allowed, message } = await validateCallRouting({
        chatId,
        senderUserId: userId,
        targetUserId,
      });

      if (!allowed) {
        socket.emit("socket:error", { message });
        return;
      }

      clearCallSessionForUser(userId);

      emitToUser(targetUserId, "call_end", {
        chatId,
        fromUserId: userId,
        fromUserName: socket.user.name,
        reason,
      });
    } catch (error) {
      socket.emit("socket:error", { message: error.message });
    }
  });
};

const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id name email");
      if (!user) {
        return next(new Error("Unauthorized"));
      }

      socket.user = { id: String(user._id), name: user.name, email: user.email };
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.id;
    addUserSocket(userId, socket.id);
    await joinUserRooms(socket, userId);

    io.emit("presence:update", { userId, online: true });

    setupSocketHandlers(socket);

    socket.on("disconnect", () => {
      removeUserSocket(userId, socket.id);
      if (!onlineUsers.has(userId)) {
        const endedCallSession = clearCallSessionForUser(userId);
        if (endedCallSession?.peerUserId) {
          emitToUser(endedCallSession.peerUserId, "call_end", {
            chatId: endedCallSession.chatId,
            fromUserId: userId,
            fromUserName: socket.user.name,
            reason: "The other user disconnected",
          });
        }

        io.emit("presence:update", { userId, online: false });
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized");
  }
  return io;
};

module.exports = { initSocketServer, getIO, emitToUser, joinUserSocketsToChatRoom };
