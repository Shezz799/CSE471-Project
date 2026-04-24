const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Complaint = require("../models/Complaint");
const Review = require("../models/Review");
const PlatformIncome = require("../models/PlatformIncome");
const { sendMail } = require("../utils/mail");
const { getFullReviewStatsForUser } = require("../services/reviewStats");

const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

function genAppealToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function assignAppealToken(userDoc) {
  const token = genAppealToken();
  userDoc.moderationAppealToken = token;
  userDoc.moderationAppealExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  userDoc.appealPending = false;
  userDoc.appealMessage = "";
  await userDoc.save();
  return token;
}

async function sendModerationEmail(userId, { subject, intro }) {
  const u = await User.findById(userId).select("+moderationAppealToken +moderationAppealExpiresAt");
  if (!u) return;
  const token =
    u.moderationAppealToken && u.moderationAppealExpiresAt && u.moderationAppealExpiresAt > new Date()
      ? u.moderationAppealToken
      : await assignAppealToken(u);
  const appealUrl = `${CLIENT_URL}/appeal?token=${encodeURIComponent(token)}`;
  const reason = (u.moderationReason || "").trim();
  const text = [
    `Hello ${u.name},`,
    "",
    intro,
    reason ? `\nReason recorded by the team:\n${reason}\n` : "",
    `If you believe this is a mistake, you can request a review using this link (valid about 14 days):`,
    appealUrl,
    "",
    `— ${process.env.APP_NAME || "Skill Sharing"} platform`,
  ].join("\n");
  await sendMail({ to: u.email, subject, text });
}

exports.getStats = async (req, res) => {
  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      openComplaints,
      suspendedUsers,
      bannedUsers,
      appealsPending,
      revenueAgg,
      revenue30Agg,
      creditPurchaseCount,
    ] = await Promise.all([
      Complaint.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      User.countDocuments({ accountStatus: "suspended" }),
      User.countDocuments({ accountStatus: "banned" }),
      User.countDocuments({ appealPending: true }),
      PlatformIncome.aggregate([{ $group: { _id: null, total: { $sum: "$amountBdt" } } }]),
      PlatformIncome.aggregate([
        { $match: { createdAt: { $gte: since30d } } },
        { $group: { _id: null, total: { $sum: "$amountBdt" } } },
      ]),
      PlatformIncome.countDocuments(),
    ]);
    const platformCreditRevenueBdt = Math.round((revenueAgg[0]?.total || 0) * 100) / 100;
    const platformCreditRevenueLast30dBdt = Math.round((revenue30Agg[0]?.total || 0) * 100) / 100;
    return res.json({
      success: true,
      data: {
        openComplaints,
        suspendedUsers,
        bannedUsers,
        appealsPending,
        platformCreditRevenueBdt,
        platformCreditRevenueLast30dBdt,
        platformCreditPurchaseCount: creditPurchaseCount,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) {
      return res.status(400).json({ success: false, message: "Enter at least 2 characters" });
    }
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }],
    })
      .select("name email accountStatus department")
      .limit(30)
      .lean();
    return res.json({
      success: true,
      data: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        accountStatus: u.accountStatus || "active",
        department: u.department,
      })),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.getUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const u = await User.findById(id).select("-password").lean();
    if (!u) return res.status(404).json({ success: false, message: "User not found" });
    const reviewStats = await getFullReviewStatsForUser(id);
    return res.json({
      success: true,
      data: {
        user: {
          id: u._id,
          name: u.name,
          email: u.email,
          department: u.department,
          bio: u.bio,
          accountStatus: u.accountStatus || "active",
          appealPending: u.appealPending,
          moderationReason: u.moderationReason || "",
          lastModerationAt: u.lastModerationAt,
        },
        reviewStats,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.listSuspended = async (req, res) => {
  try {
    const list = await User.find({ accountStatus: "suspended" })
      .select("name email moderationReason appealPending appealMessage lastModerationAt")
      .sort({ lastModerationAt: -1 })
      .lean();
    return res.json({ success: true, data: list });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.listBanned = async (req, res) => {
  try {
    const list = await User.find({ accountStatus: "banned" })
      .select("name email moderationReason appealPending appealMessage lastModerationAt")
      .sort({ lastModerationAt: -1 })
      .lean();
    return res.json({ success: true, data: list });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot suspend yourself" });
    }
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 2000) : "";
    const user = await User.findById(id).select("+moderationAppealToken +moderationAppealExpiresAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.accountStatus = "suspended";
    user.lastModerationAt = new Date();
    user.moderationReason = reason;
    await assignAppealToken(user);
    await sendModerationEmail(user._id, {
      subject: "Your account has been suspended",
      intro:
        "An administrator has suspended your account after reviewing a report. You cannot use the platform until the suspension is lifted.",
    });
    return res.json({
      success: true,
      message: "User suspended and notified by email",
      data: { id: user._id, accountStatus: user.accountStatus },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.banUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot ban yourself" });
    }
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 2000) : "";
    const user = await User.findById(id).select("+moderationAppealToken +moderationAppealExpiresAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.accountStatus = "banned";
    user.lastModerationAt = new Date();
    user.moderationReason = reason;
    await assignAppealToken(user);
    await sendModerationEmail(user._id, {
      subject: "Your account has been banned",
      intro:
        "An administrator has banned your account. You cannot sign in. Policy: if your ban is lifted later, you may need to register again depending on admin action; contact the course team if unsure.",
    });
    return res.json({
      success: true,
      message: "User banned and notified by email",
      data: { id: user._id, accountStatus: user.accountStatus },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.unsuspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const user = await User.findById(id).select("+moderationAppealToken +moderationAppealExpiresAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.accountStatus !== "suspended") {
      return res.status(400).json({ success: false, message: "User is not suspended" });
    }
    user.accountStatus = "active";
    user.appealPending = false;
    user.moderationAppealToken = null;
    user.moderationAppealExpiresAt = null;
    user.moderationReason = "";
    await user.save();
    await sendMail({
      to: user.email,
      subject: "Your suspension has been lifted",
      text: [
        `Hello ${user.name},`,
        "",
        "Your account suspension has been lifted. You can sign in again with the same account; your data is unchanged.",
        "",
        `— ${process.env.APP_NAME || "Skill Sharing"} platform`,
      ].join("\n"),
    });
    return res.json({ success: true, message: "User unsuspended and emailed" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

/** Unban: restore access (same account). For "must register again", admins can use release email after this. */
exports.unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const user = await User.findById(id).select("+moderationAppealToken +moderationAppealExpiresAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.accountStatus !== "banned") {
      return res.status(400).json({ success: false, message: "User is not banned" });
    }
    user.accountStatus = "active";
    user.appealPending = false;
    user.moderationAppealToken = null;
    user.moderationAppealExpiresAt = null;
    user.moderationReason = "";
    await user.save();
    await sendMail({
      to: user.email,
      subject: "Your ban has been lifted",
      text: [
        `Hello ${user.name},`,
        "",
        "An administrator has lifted the ban on your account. You can sign in again with the same Google account.",
        "",
        `— ${process.env.APP_NAME || "Skill Sharing"} platform`,
      ].join("\n"),
    });
    return res.json({ success: true, message: "User unbanned and emailed" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * Free the user's email so they can register again (destructive: anonymize profile, keep id for refs).
 */
exports.releaseBannedEmail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Invalid target" });
    }
    const user = await User.findById(id).select("+moderationAppealToken +moderationAppealExpiresAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const oldEmail = user.email;
    const archived = `archived_${user._id}_${Date.now()}@released.invalid`;
    user.email = archived;
    user.name = "Released account";
    user.accountStatus = "active";
    user.bio = "";
    user.skills = [];
    user.phone = "";
    user.linkedinUrl = "";
    user.githubUrl = "";
    user.portfolioUrl = "";
    user.appealPending = false;
    user.moderationAppealToken = null;
    user.moderationAppealExpiresAt = null;
    user.moderationReason = "";
    await user.save();
    await sendMail({
      to: oldEmail,
      subject: "Your account email has been released",
      text: [
        "Hello,",
        "",
        "An administrator has released your email address from the banned account. You may create a new account by signing in with Google again.",
        "",
        `— ${process.env.APP_NAME || "Skill Sharing"} platform`,
      ].join("\n"),
    });
    return res.json({ success: true, message: "Email released; user anonymized. Old address notified." });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.listLowRated = async (req, res) => {
  try {
    const maxAvg = Number(req.query.below) || 2;
    const minReviews = Math.max(1, Number(req.query.minReviews) || 2);
    const rows = await Review.aggregate([
      {
        $group: {
          _id: "$reviewee",
          reviewCount: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
      {
        $match: {
          reviewCount: { $gte: minReviews },
          averageRating: { $lt: maxAvg },
        },
      },
      { $sort: { averageRating: 1 } },
      { $limit: 80 },
    ]);
    const ids = rows.map((r) => r._id);
    const users = await User.find({ _id: { $in: ids } })
      .select("name email department accountStatus")
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    const data = rows
      .map((r) => {
        const u = byId.get(r._id.toString());
        if (!u) return null;
        return {
          id: u._id,
          name: u.name,
          email: u.email,
          department: u.department,
          accountStatus: u.accountStatus || "active",
          reviewCount: r.reviewCount,
          averageRating: Math.round(r.averageRating * 100) / 100,
        };
      })
      .filter(Boolean);
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.sendCoachingEmail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const custom =
      typeof req.body.message === "string" ? req.body.message.trim().slice(0, 3000) : "";
    const body = [
      `Hello ${user.name},`,
      "",
      custom ||
        "We noticed your mentor ratings are below expectations. Please be more responsive and helpful when you offer help — clear communication and follow-through improve the experience for everyone.",
      "",
      `— ${process.env.APP_NAME || "Skill Sharing"} administrators`,
    ].join("\n");
    await sendMail({
      to: user.email,
      subject: "Please improve your helpfulness on the platform",
      text: body,
    });
    return res.json({ success: true, message: "Email sent" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.submitAppeal = async (req, res) => {
  try {
    const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
    const message = typeof req.body.message === "string" ? req.body.message.trim().slice(0, 4000) : "";
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }
    const user = await User.findOne({ moderationAppealToken: token }).select(
      "+moderationAppealToken +moderationAppealExpiresAt"
    );
    if (!user || !user.moderationAppealExpiresAt || user.moderationAppealExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired link" });
    }
    if (user.accountStatus === "active") {
      return res.json({ success: true, message: "Your account is already active. No action is needed." });
    }
    user.appealPending = true;
    user.appealMessage = message;
    await user.save();
    return res.json({
      success: true,
      message: "Your request was submitted. An administrator will review it.",
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
