const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const User = require("../models/User");

let io;
const onlineUsers = new Map();

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
