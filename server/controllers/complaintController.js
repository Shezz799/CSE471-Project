const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Post = require("../models/Post");
const { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES } = require("../models/Complaint");

exports.createComplaint = async (req, res) => {
  try {
    const { category, description, subjectUserEmail, relatedPostId } = req.body;

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

    const doc = await Complaint.create({
      complainant: req.user._id,
      subjectUser,
      post: postRef,
      category,
      description: desc,
    });

    const populated = await Complaint.findById(doc._id)
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .lean();

    return res.status(201).json({ success: true, data: populated });
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
      .lean();
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listAll = async (req, res) => {
  try {
    const statusFilter = req.query.status;
    const query = {};
    if (statusFilter && COMPLAINT_STATUSES.includes(statusFilter)) {
      query.status = statusFilter;
    }
    const list = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .lean();
    return res.status(200).json({ success: true, data: list });
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
    const { status, adminNotes } = req.body;

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
      } else if (status === "open" || status === "in_progress") {
        complaint.resolvedAt = null;
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

    await complaint.save();

    const populated = await Complaint.findById(complaint._id)
      .populate("complainant", "name email")
      .populate("subjectUser", "name email")
      .populate("post", "subject topic")
      .lean();

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
