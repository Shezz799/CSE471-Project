const Chat = require("../models/Chat");
const Message = require("../models/Message");
const { uploadToCloudinary } = require("../utils/cloudinary");
const { getIO } = require("../socket/socketServer");

const ensureParticipant = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  if (!chat) {
    return { error: "Chat not found", status: 404 };
  }
  const isParticipant = chat.participants.some((participantId) => String(participantId) === String(userId));
  if (!isParticipant) {
    return { error: "Not authorized for this chat", status: 403 };
  }
  return { chat };
};

const getMessagesByChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const { error, status } = await ensureParticipant(chatId, req.user._id);
    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    const messages = await Message.find({ chatId })
      .populate("senderId", "name email")
      .sort({ createdAt: 1 });

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const text = req.body.text || "";

    const { error, status } = await ensureParticipant(chatId, req.user._id);
    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    let fileUrl = "";
    let fileType = "";

    if (req.file) {
      const uploadedFile = await uploadToCloudinary(req.file.buffer, req.file.mimetype, "skillshare-chat");
      fileUrl = uploadedFile.secure_url;
      fileType = req.file.mimetype;
    }

    if (!text.trim() && !fileUrl) {
      return res.status(400).json({ success: false, message: "Message text or file is required" });
    }

    const message = await Message.create({
      chatId,
      senderId: req.user._id,
      text,
      fileUrl,
      fileType,
    });

    const populatedMessage = await Message.findById(message._id).populate("senderId", "name email");

    const io = getIO();
    io.to(chatId).emit("message:new", populatedMessage);

    return res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMessagesByChat, createMessage, ensureParticipant };
