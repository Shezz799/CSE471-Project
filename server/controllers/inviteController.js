const Chat = require("../models/Chat");
const ChatInvite = require("../models/ChatInvite");
const { emitToUser, joinUserSocketsToChatRoom } = require("../socket/socketServer");

const getMyInvites = async (req, res) => {
  try {
    const invites = await ChatInvite.find({ receiverId: req.user._id, status: "pending" })
      .populate("senderId", "name email department skills")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: invites });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const sendInvite = async (req, res) => {
  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ success: false, message: "receiverId is required" });
    }

    if (String(receiverId) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot invite yourself" });
    }

    const existingChat = await Chat.findOne({
      participants: { $all: [req.user._id, receiverId] },
    });
    if (existingChat) {
      return res.status(409).json({ success: false, message: "Chat already exists", data: existingChat });
    }

    const existingPending = await ChatInvite.findOne({
      senderId: req.user._id,
      receiverId,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({ success: false, message: "Invite already sent", data: existingPending });
    }

    const invite = await ChatInvite.create({
      senderId: req.user._id,
      receiverId,
      status: "pending",
    });

    const populatedInvite = await ChatInvite.findById(invite._id)
      .populate("senderId", "name email department skills")
      .populate("receiverId", "name email department skills");

    emitToUser(receiverId, "invite:received", populatedInvite);

    return res.status(201).json({ success: true, message: "Invite sent", data: populatedInvite });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const respondInvite = async (req, res) => {
  try {
    const { inviteId, action } = req.body;

    if (!inviteId || !action) {
      return res.status(400).json({ success: false, message: "inviteId and action are required" });
    }

    if (!["accepted", "rejected"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be accepted or rejected" });
    }

    const invite = await ChatInvite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }

    if (String(invite.receiverId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    if (invite.status !== "pending") {
      return res.status(400).json({ success: false, message: "Invite already resolved" });
    }

    invite.status = action;
    await invite.save();

    let chat = null;
    if (action === "accepted") {
      chat = await Chat.findOne({ participants: { $all: [invite.senderId, invite.receiverId] } });
      if (!chat) {
        chat = await Chat.create({ participants: [invite.senderId, invite.receiverId] });
      }
      chat = await Chat.findById(chat._id).populate("participants", "name email department skills");
    }

    const populatedInvite = await ChatInvite.findById(invite._id)
      .populate("senderId", "name email department skills")
      .populate("receiverId", "name email department skills");

    emitToUser(invite.senderId, "invite:responded", {
      invite: populatedInvite,
      chat,
    });

    emitToUser(invite.receiverId, "invite:updated", {
      invite: populatedInvite,
      chat,
    });

    if (chat) {
      joinUserSocketsToChatRoom(invite.senderId, chat._id);
      joinUserSocketsToChatRoom(invite.receiverId, chat._id);
      emitToUser(invite.senderId, "chat:created", chat);
      emitToUser(invite.receiverId, "chat:created", chat);
    }

    return res.status(200).json({
      success: true,
      message: `Invite ${action}`,
      data: {
        invite: populatedInvite,
        chat,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendInvite, respondInvite, getMyInvites };
