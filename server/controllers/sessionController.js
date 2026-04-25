const mongoose = require("mongoose");
const Chat = require("../models/Chat");
const Post = require("../models/Post");
const Session = require("../models/Session");
const {
  holdCreditsForSession,
  refundHeldCredits,
  settleHeldCreditsToHelper,
  normalizeUserCreditFields,
} = require("./creditController");
const { emitToUser, joinUserSocketsToChatRoom } = require("../socket/socketServer");
const { applyMentorshipStreakOnSessionCompleted } = require("../services/mentorshipStreakService");

const ACTIVE_STATUSES = ["pending", "active", "ending"];

const isParticipant = (session, userId) => {
  return session.participants.some((id) => String(id) === String(userId));
};

const getOtherParticipantId = (session, userId) => {
  return session.participants.find((id) => String(id) !== String(userId));
};

const serializeSession = async (sessionId) => {
  return Session.findById(sessionId)
    .populate("participants", "name email department skills")
    .populate("requesterId", "name email")
    .populate("helperId", "name email")
    .populate("postId", "subject topic status creditsOffered")
    .populate("chatId", "participants");
};

const startSession = async (req, res) => {
  let creditsHeldByRequester = false;
  let heldCreditsAmount = 0;

  try {
    const { postId, helperUserId, creditsToHold } = req.body || {};

    if (!postId || !helperUserId) {
      return res.status(400).json({ success: false, message: "postId and helperUserId are required" });
    }

    if (!mongoose.isValidObjectId(postId) || !mongoose.isValidObjectId(helperUserId)) {
      return res.status(400).json({ success: false, message: "Invalid postId or helperUserId" });
    }

    if (String(helperUserId) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot start a session with yourself" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Only the post owner can start a help session" });
    }

    const helperOffered = post.offers.some((offerId) => String(offerId) === String(helperUserId));
    if (!helperOffered) {
      return res.status(400).json({ success: false, message: "The selected helper has not offered help on this post" });
    }

    const existingSession = await Session.findOne({
      postId,
      requesterId: req.user._id,
      helperId: helperUserId,
      status: { $in: ACTIVE_STATUSES },
    });

    if (existingSession) {
      const populatedExisting = await serializeSession(existingSession._id);
      return res.status(409).json({
        success: false,
        message: "An active session already exists for this helper and post",
        data: { session: populatedExisting },
      });
    }

    const parsedCredits = Number(creditsToHold);
    const fallbackCredits = Number(post.creditsOffered || 0);
    const finalCreditsToHold = Number.isNaN(parsedCredits) ? fallbackCredits : parsedCredits;

    if (!Number.isInteger(finalCreditsToHold) || finalCreditsToHold <= 0) {
      return res.status(400).json({ success: false, message: "creditsToHold must be a positive whole number" });
    }

    const { requester: requesterCreditState, heldAmount } = await holdCreditsForSession({
      userId: req.user._id,
      creditsAmount: finalCreditsToHold,
    });
    heldCreditsAmount = Number(heldAmount || 0);
    creditsHeldByRequester = heldCreditsAmount > 0;

    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, helperUserId] },
    }).populate("participants", "name email department skills");

    let chatCreated = false;
    if (!chat) {
      const createdChat = await Chat.create({
        participants: [req.user._id, helperUserId],
      });
      chat = await Chat.findById(createdChat._id).populate("participants", "name email department skills");
      chatCreated = true;
    }

    const createdSession = await Session.create({
      participants: [req.user._id, helperUserId],
      requesterId: req.user._id,
      helperId: helperUserId,
      postId,
      chatId: chat._id,
      creditsHeld: heldCreditsAmount,
      status: "active",
    });

    post.status = "in_progress";
    await post.save();

    const populatedSession = await serializeSession(createdSession._id);

    if (chatCreated) {
      joinUserSocketsToChatRoom(req.user._id, chat._id);
      joinUserSocketsToChatRoom(helperUserId, chat._id);
      emitToUser(req.user._id, "chat:created", chat);
      emitToUser(helperUserId, "chat:created", chat);
    }

    const invitePayload = {
      session: populatedSession,
      chat,
      postId: String(postId),
      fromUserId: String(req.user._id),
      fromUserName: req.user.name,
      helperUserId: String(helperUserId),
      creditsHeld: heldCreditsAmount,
    };

    emitToUser(helperUserId, "session_invite", invitePayload);
    emitToUser(req.user._id, "session_started", invitePayload);
    emitToUser(helperUserId, "session_started", invitePayload);

    return res.status(201).json({
      success: true,
      message: "Session started",
      data: {
        session: populatedSession,
        chat,
        requesterCredits: {
          totalCredits: requesterCreditState.totalCredits,
          heldCredits: requesterCreditState.heldCredits,
        },
      },
    });
  } catch (error) {
    if (creditsHeldByRequester && heldCreditsAmount > 0) {
      try {
        await refundHeldCredits({
          userId: req.user._id,
          creditsAmount: heldCreditsAmount,
        });
      } catch (refundError) {
        console.error("Failed to rollback held credits:", refundError.message);
      }
    }

    if (error?.code === "INSUFFICIENT_CREDITS") {
      return res.status(400).json({
        success: false,
        code: "INSUFFICIENT_CREDITS",
        message: error.message,
        data: {
          availableCredits: Number(error.availableCredits || 0),
          requiredCredits: Number(error.requiredCredits || 0),
          heldCredits: Number(error.heldCredits || 0),
        },
      });
    }

    return res.status(500).json({ success: false, message: error.message });
  }
};

const endSessionRequest = async (req, res) => {
  try {
    const { sessionId } = req.body || {};

    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: "Valid sessionId is required" });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (!isParticipant(session, req.user._id)) {
      return res.status(403).json({ success: false, message: "Not authorized for this session" });
    }

    if (!["active", "ending"].includes(session.status)) {
      return res.status(400).json({ success: false, message: "Only active sessions can be ended" });
    }

    const otherParticipantId = getOtherParticipantId(session, req.user._id);
    if (!otherParticipantId) {
      return res.status(400).json({ success: false, message: "Session peer not found" });
    }

    session.status = "ending";
    session.endRequestedBy = req.user._id;
    await session.save();

    const payload = {
      sessionId: String(session._id),
      chatId: String(session.chatId),
      fromUserId: String(req.user._id),
      fromUserName: req.user.name,
    };

    emitToUser(otherParticipantId, "end_session_request", payload);

    return res.status(200).json({
      success: true,
      message: "End session request sent",
      data: {
        session,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const respondEndSession = async (req, res) => {
  try {
    const { sessionId, action } = req.body || {};

    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: "Valid sessionId is required" });
    }

    if (!["accept", "reject", "cancel"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be accept, reject or cancel" });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (!isParticipant(session, req.user._id)) {
      return res.status(403).json({ success: false, message: "Not authorized for this session" });
    }

    const requesterId = String(session.requesterId);
    const helperId = String(session.helperId);
    const me = String(req.user._id);
    const peerUserId = String(getOtherParticipantId(session, req.user._id) || "");

    const ensurePostState = async (nextStatus) => {
      if (!session.postId) return;
      await Post.findByIdAndUpdate(session.postId, { status: nextStatus });
    };

    if (action === "reject") {
      if (session.status !== "ending") {
        return res.status(400).json({ success: false, message: "No end request is currently pending" });
      }
      if (!session.endRequestedBy) {
        return res.status(400).json({ success: false, message: "No end request to respond to" });
      }
      if (String(session.endRequestedBy) === me) {
        return res.status(400).json({ success: false, message: "You cannot reject your own end request" });
      }

      session.status = "active";
      session.endRequestedBy = null;
      await session.save();

      emitToUser(peerUserId, "session_ended", {
        sessionId: String(session._id),
        chatId: String(session.chatId),
        status: "active",
        reason: "End request rejected",
      });

      return res.status(200).json({
        success: true,
        message: "End request rejected. Session continues.",
        data: { session },
      });
    }

    if (action === "cancel") {
      if (session.status === "completed" || session.status === "cancelled") {
        return res.status(400).json({ success: false, message: "Session is already closed" });
      }

      if (me !== requesterId) {
        return res.status(403).json({ success: false, message: "Only the requester can cancel and refund credits" });
      }

      await refundHeldCredits({
        userId: requesterId,
        creditsAmount: session.creditsHeld,
      });

      session.status = "cancelled";
      session.endRequestedBy = null;
      session.endedAt = new Date();
      await session.save();
      await ensurePostState("open");

      const requesterCredits = await normalizeUserCreditFields(requesterId);

      const cancelPayload = {
        sessionId: String(session._id),
        chatId: String(session.chatId),
        requesterId,
        helperId,
        status: "cancelled",
        reason: "Session cancelled and credits refunded",
        requesterCredits: {
          totalCredits: requesterCredits?.totalCredits || 0,
          heldCredits: requesterCredits?.heldCredits || 0,
        },
      };

      emitToUser(requesterId, "session_ended", cancelPayload);
      emitToUser(helperId, "session_ended", {
        ...cancelPayload,
        reason: "Session cancelled",
      });

      return res.status(200).json({
        success: true,
        message: "Session cancelled and credits refunded",
        data: {
          session,
          requesterCredits: {
            totalCredits: requesterCredits?.totalCredits || 0,
            heldCredits: requesterCredits?.heldCredits || 0,
          },
        },
      });
    }

    if (session.status !== "ending") {
      return res.status(400).json({ success: false, message: "No end request is currently pending" });
    }

    if (!session.endRequestedBy) {
      return res.status(400).json({ success: false, message: "No end request to respond to" });
    }

    if (String(session.endRequestedBy) === me) {
      return res.status(400).json({ success: false, message: "You cannot accept your own end request" });
    }

    const settlement = await settleHeldCreditsToHelper({
      requesterId,
      helperId,
      creditsAmount: session.creditsHeld,
    });

    session.status = "completed";
    session.endRequestedBy = null;
    session.endedAt = new Date();
    await session.save();
    await ensurePostState("closed");

    try {
      await applyMentorshipStreakOnSessionCompleted(requesterId);
    } catch (streakErr) {
      console.error("mentorship streak update failed:", streakErr?.message || streakErr);
    }

    const completedPayload = {
      sessionId: String(session._id),
      chatId: String(session.chatId),
      requesterId,
      helperId,
      status: "completed",
      reason: "Session completed",
      creditsTransferred: session.creditsHeld,
      requesterCredits: {
        totalCredits: settlement.requester.totalCredits,
        heldCredits: settlement.requester.heldCredits,
      },
      helperCredits: {
        totalCredits: settlement.helper.totalCredits,
        heldCredits: settlement.helper.heldCredits,
      },
    };

    emitToUser(requesterId, "session_ended", completedPayload);
    emitToUser(helperId, "session_ended", completedPayload);

    return res.status(200).json({
      success: true,
      message: "Session completed and credits transferred",
      data: {
        session,
        requesterCredits: {
          totalCredits: settlement.requester.totalCredits,
          heldCredits: settlement.requester.heldCredits,
        },
        helperCredits: {
          totalCredits: settlement.helper.totalCredits,
          heldCredits: settlement.helper.heldCredits,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getActiveSessionByChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!chatId || !mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ success: false, message: "Valid chatId is required" });
    }

    const session = await Session.findOne({
      chatId,
      participants: req.user._id,
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .populate("participants", "name email department skills")
      .populate("requesterId", "name email")
      .populate("helperId", "name email")
      .populate("postId", "subject topic status creditsOffered");

    return res.status(200).json({
      success: true,
      data: {
        session,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMyPendingEndRequests = async (req, res) => {
  try {
    const sessions = await Session.find({
      status: "ending",
      participants: req.user._id,
      endRequestedBy: { $exists: true, $ne: req.user._id },
    })
      .sort({ updatedAt: -1 })
      .populate("endRequestedBy", "name email")
      .populate("postId", "subject topic")
      .populate("chatId", "_id")
      .select("_id postId chatId endRequestedBy requesterId helperId creditsHeld status updatedAt")
      .lean();

    const items = sessions.map((session) => {
      const fromUser = session.endRequestedBy || {};
      return {
        id: String(session._id),
        sessionId: String(session._id),
        chatId: String(session.chatId?._id || session.chatId || ""),
        fromUserId: String(fromUser._id || session.endRequestedBy || ""),
        fromUserName: fromUser.name || "The other user",
        fromUserEmail: fromUser.email || "",
        postId: String(session.postId?._id || session.postId || ""),
        postSubject: session.postId?.subject || "Session",
        postTopic: session.postId?.topic || "",
        creditsHeld: Number(session.creditsHeld || 0),
        status: session.status,
        updatedAt: session.updatedAt,
      };
    });

    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  startSession,
  endSessionRequest,
  respondEndSession,
  getActiveSessionByChat,
  getMyPendingEndRequests,
};
