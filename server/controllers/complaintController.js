const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Post = require("../models/Post");
const {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  COMPLAINT_PIPELINE_STAGES,
} = require("../models/Complaint");
const CreditLedger = require("../models/CreditLedger");
const { normalizeUserCreditFields } = require("./creditController");
const { sendMail } = require("../utils/mail");
const { triggerNotification } = require("../services/pusherService");
const { emitToUser } = require("../socket/socketServer");

const PIPELINE_USER_LABELS = {
  received: "Complaint received",
  under_review: "Under review",
  result: "Result / decision stage",
};

const DISPUTE_OUTCOME_LABELS = {
  complainant_upheld: "Ruling in favor of the complainant",
  subject_upheld: "Ruling in favor of the reported user",
  partial: "Mixed or partial outcome",
};

const stripInternalFromComplaint = (doc) => {
  if (!doc || typeof doc !== "object") return doc;
  const { adminNotes: _omit, ...rest } = doc;
  return rest;
};

const parseEvidenceLinks = (raw) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of arr) {
    const s = typeof item === "string" ? item.trim() : "";
    if (!s || s.length > 500) continue;
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      out.push(s);
    } catch {
      continue;
    }
    if (out.length >= 5) break;
  }
  return out;
};

exports.createComplaint = async (req, res) => {
  try {
    const { category, description, subjectUserEmail, relatedPostId, evidenceLinks } = req.body;

    if (!category || !COMPLAINT_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "A valid category is required" });
    }

    const desc =
      typeof description === "string"
        ? description.trim()
        : "";
    if (desc.length < 20) {
      return res.status(400).json({
        success: false,
        message: "Description must be at least 20 characters so we can understand the issue",
      });
    }
    if (desc.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Description must be at most 5000 characters",
      });
    }

    let subjectUser = null;
    if (subjectUserEmail != null && String(subjectUserEmail).trim() !== "") {
      const email = String(subjectUserEmail).trim().toLowerCase();
      const accused = await User.findOne({ email });
      if (!accused) {
        return res.status(404).json({
          success: false,
          message: "No user found with that email",
        });
      }
      if (accused._id.equals(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: "You cannot file a complaint with yourself as the subject",
        });
      }
      subjectUser = accused._id;
    }

    let postRef = null;
    if (relatedPostId != null && String(relatedPostId).trim() !== "") {
      if (!mongoose.isValidObjectId(relatedPostId)) {
        return res.status(400).json({ success: false, message: "Invalid related post id" });
      }
      const post = await Post.findById(relatedPostId);
      if (!post) {
        return res.status(404).json({ success: false, message: "Related post not found" });
      }
      const isAuthor = post.author.toString() === req.user._id.toString();
      const isAdmin = req.user.role === "admin";
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "You can only attach a post you authored (unless you are an admin)",
        });
      }
      postRef = post._id;
    }

    const links = parseEvidenceLinks(evidenceLinks);

    const doc = await Complaint.create({
      complainant: req.user._id,
      subjectUser,
      post: postRef,
      category,
      description: desc,
      evidenceLinks: links,
    });

    const populated = await Complaint.findById(doc._id)
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .lean();

    // Send notification to admins
    triggerNotification("admin-channel", "complaint:created", {
      complaintId: doc._id,
      category: doc.category,
      complainantName: req.user.name || "Someone",
    });

    return res.status(201).json({ success: true, data: stripInternalFromComplaint(populated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listMine = async (req, res) => {
  try {
    const list = await Complaint.find({ complainant: req.user._id })
      .sort({ createdAt: -1 })
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .populate("resolvedBy", "name email")
      .lean();
    return res.status(200).json({ success: true, data: list.map((row) => stripInternalFromComplaint(row)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMineOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint id" });
    }
    const doc = await Complaint.findOne({ _id: id, complainant: req.user._id })
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .populate("resolvedBy", "name email")
      .lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    return res.status(200).json({ success: true, data: stripInternalFromComplaint(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint id" });
    }
    const msg = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (msg.length < 20) {
      return res.status(400).json({
        success: false,
        message: "Appeal must be at least 20 characters so the team can understand your concern",
      });
    }
    if (msg.length > 2000) {
      return res.status(400).json({ success: false, message: "Appeal must be at most 2000 characters" });
    }

    const complaint = await Complaint.findOne({ _id: id, complainant: req.user._id });
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    if (!["resolved", "dismissed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: "Appeals are only available after the ticket has been closed (resolved or dismissed).",
      });
    }
    if (complaint.appealExhausted) {
      return res.status(400).json({
        success: false,
        message: "You have already used your one appeal for this ticket.",
      });
    }

    complaint.appealMessage = msg;
    complaint.appealedAt = new Date();
    complaint.appealExhausted = true;
    complaint.status = "in_progress";
    complaint.pipelineStage = "under_review";
    complaint.resolvedAt = null;
    complaint.resolvedBy = null;
    await complaint.save();

    triggerNotification("admin-channel", "complaint:appeal", {
      complaintId: complaint._id,
      complainantName: req.user.name || "Someone",
    });

    const populated = await Complaint.findById(complaint._id)
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .populate("resolvedBy", "name email")
      .lean();

    return res.status(200).json({ success: true, data: stripInternalFromComplaint(populated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listAll = async (req, res) => {
  try {
    const statusFilter = req.query.status;
    const pipelineFilter = req.query.pipelineStage;
    const query = {};
    if (statusFilter && COMPLAINT_STATUSES.includes(statusFilter)) {
      query.status = statusFilter;
    }
    if (pipelineFilter && COMPLAINT_PIPELINE_STAGES.includes(pipelineFilter)) {
      if (pipelineFilter === "received") {
        query.$or = [{ pipelineStage: "received" }, { pipelineStage: { $exists: false } }];
      } else {
        query.pipelineStage = pipelineFilter;
      }
    }
    const list = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .populate("resolvedBy", "name email")
      .lean();
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint id" });
    }
    const doc = await Complaint.findById(id)
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .populate("resolvedBy", "name email")
      .lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint id" });
    }
    const {
      status,
      adminNotes,
      pipelineStage,
      complainantMessage,
      notifyComplainant,
      resolutionSummary,
      disputeOutcome,
    } = req.body;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    if (status != null) {
      if (!COMPLAINT_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      complaint.status = status;
      if (status === "resolved" || status === "dismissed") {
        complaint.resolvedAt = new Date();
        complaint.resolvedBy = req.user._id;
      } else if (status === "open" || status === "in_progress") {
        complaint.resolvedAt = null;
        complaint.resolvedBy = null;
      }
    }

    if (adminNotes != null) {
      const notes = typeof adminNotes === "string" ? adminNotes.trim() : "";
      if (notes.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Admin notes must be at most 2000 characters",
        });
      }
      complaint.adminNotes = notes;
    }

    if (pipelineStage != null) {
      if (!COMPLAINT_PIPELINE_STAGES.includes(pipelineStage)) {
        return res.status(400).json({ success: false, message: "Invalid pipeline stage" });
      }
      complaint.pipelineStage = pipelineStage;
    }

    if (complainantMessage != null) {
      const msg = typeof complainantMessage === "string" ? complainantMessage.trim() : "";
      if (msg.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Complainant message must be at most 2000 characters",
        });
      }
      complaint.complainantMessage = msg;
    }

    if (resolutionSummary != null) {
      const summary = typeof resolutionSummary === "string" ? resolutionSummary.trim() : "";
      if (summary.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Resolution summary must be at most 2000 characters",
        });
      }
      complaint.resolutionSummary = summary;
    }

    if (disputeOutcome != null) {
      const allowedOutcomes = ["", "complainant_upheld", "subject_upheld", "partial"];
      if (!allowedOutcomes.includes(disputeOutcome)) {
        return res.status(400).json({ success: false, message: "Invalid dispute outcome" });
      }
      complaint.disputeOutcome = disputeOutcome;
    }

    await complaint.save();

    const populated = await Complaint.findById(complaint._id)
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .populate("resolvedBy", "name email")
      .lean();

    const bodyKeys = Object.keys(req.body || {});
    const shouldNotifySocket = bodyKeys.some((k) =>
      [
        "status",
        "pipelineStage",
        "complainantMessage",
        "resolutionSummary",
        "disputeOutcome",
        "notifyComplainant",
      ].includes(k)
    );
    if (shouldNotifySocket && populated.complainant?._id) {
      const stageLabel =
        PIPELINE_USER_LABELS[populated.pipelineStage] || populated.pipelineStage || "Received";
      emitToUser(String(populated.complainant._id), "complaint:update", {
        title: "Complaint status update",
        message: `Your ticket is now “${populated.status}” · ${stageLabel}.`,
        link: `/complaints/ticket/${id}`,
      });
    }

    if (notifyComplainant === true && populated.complainant?.email) {
      const lines = [
        `Hello ${populated.complainant.name || ""},`,
        "",
        "There is an update on your complaint submitted to the platform team.",
        "",
        `Current status: ${populated.status}`,
        `Stage: ${PIPELINE_USER_LABELS[populated.pipelineStage] || populated.pipelineStage || "Complaint received"}`,
      ];
      if (populated.disputeOutcome && DISPUTE_OUTCOME_LABELS[populated.disputeOutcome]) {
        lines.push("", `Recorded outcome: ${DISPUTE_OUTCOME_LABELS[populated.disputeOutcome]}`);
      }
      if (populated.resolutionSummary) {
        lines.push("", "Summary for you:", populated.resolutionSummary);
      }
      if (populated.complainantMessage) {
        lines.push("", "Message from the team:", populated.complainantMessage);
      }
      lines.push("", "— Platform administrators");
      await sendMail({
        to: populated.complainant.email,
        subject: "Update on your complaint",
        text: lines.join("\n"),
      });
    }

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint id" });
    }

    const resolutionSummary =
      typeof req.body.resolutionSummary === "string" ? req.body.resolutionSummary.trim() : "";
    const disputeOutcome = typeof req.body.disputeOutcome === "string" ? req.body.disputeOutcome : "";
    const complainantMessage =
      typeof req.body.complainantMessage === "string" ? req.body.complainantMessage.trim() : "";
    const notifyComplainant = req.body.notifyComplainant === true;
    const compensationCredits = Number(req.body.compensationCredits) || 0;

    if (!resolutionSummary) {
      return res.status(400).json({ success: false, message: "Resolution summary is required" });
    }
    if (resolutionSummary.length > 2000) {
      return res.status(400).json({ success: false, message: "Resolution summary is too long" });
    }
    if (!["complainant_upheld", "subject_upheld", "partial"].includes(disputeOutcome)) {
      return res.status(400).json({ success: false, message: "Valid dispute outcome is required" });
    }
    if (!Number.isInteger(compensationCredits) || compensationCredits < 0 || compensationCredits > 200) {
      return res
        .status(400)
        .json({ success: false, message: "Compensation credits must be an integer between 0 and 200" });
    }

    const complaint = await Complaint.findById(id).populate("complainant", "name email");
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    complaint.status = "resolved";
    complaint.pipelineStage = "result";
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = req.user._id;
    complaint.resolutionSummary = resolutionSummary;
    complaint.disputeOutcome = disputeOutcome;
    complaint.complainantMessage = complainantMessage.slice(0, 2000);

    await complaint.save();

    if (compensationCredits > 0 && complaint.complainant?._id) {
      await normalizeUserCreditFields(complaint.complainant._id);
      const compensated = await User.findByIdAndUpdate(
        complaint.complainant._id,
        { $inc: { totalCredits: compensationCredits, credits: compensationCredits } },
        { new: true }
      ).select("totalCredits");
      await CreditLedger.create({
        user: complaint.complainant._id,
        type: "dispute_credit_adjustment",
        amount: compensationCredits,
        balanceAfter: Number(compensated?.totalCredits || 0),
        metadata: {
          complaintId: String(complaint._id),
          reason: "Complaint resolution compensation",
          resolvedBy: String(req.user._id),
        },
      });
    }

    if (complaint.complainant?._id) {
      emitToUser(String(complaint.complainant._id), "complaint:update", {
        title: "Complaint resolved",
        message: `Outcome recorded. Open your ticket for the full summary.`,
        link: `/complaints/ticket/${complaint._id}`,
      });
    }

    if (notifyComplainant === true && complaint.complainant?.email) {
      const outcomeLine =
        DISPUTE_OUTCOME_LABELS[disputeOutcome] || disputeOutcome.replace(/_/g, " ");
      const lines = [
        `Hello ${complaint.complainant.name || ""},`,
        "",
        "Your dispute was reviewed by the admin team.",
        "",
        `Outcome: ${outcomeLine}`,
        "",
        "What we decided (for your records):",
        resolutionSummary,
      ];
      if (compensationCredits > 0) {
        lines.push("", `Compensation added to your wallet: ${compensationCredits} credits`);
      }
      if (complainantMessage) {
        lines.push("", "Message from the admin team:", complainantMessage);
      }
      lines.push("", "— Platform administrators");
      await sendMail({
        to: complaint.complainant.email,
        subject: "Your dispute has been resolved",
        text: lines.join("\n"),
      });
    }

    const populated = await Complaint.findById(complaint._id)
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .populate("resolvedBy", "name email")
      .lean();

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
