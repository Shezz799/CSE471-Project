const mongoose = require("mongoose");
const Review = require("../models/Review");
const User = require("../models/User");
const Post = require("../models/Post");
const { getFullReviewStatsForUser } = require("../services/reviewStats");
const { emitToUser } = require("../socket/socketServer");

const normalizeRating = (r) => {
  const n = Number(r);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
};

exports.createReview = async (req, res) => {
  try {
    const { revieweeId, postId, rating, comment } = req.body;
    const rid = normalizeRating(rating);
    if (rid == null) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number from 1 to 5",
      });
    }
    if (!revieweeId || !mongoose.isValidObjectId(revieweeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid mentor (reviewee) id is required",
      });
    }
    if (req.user._id.toString() === revieweeId) {
      return res.status(400).json({ success: false, message: "You cannot review yourself" });
    }

    const reviewee = await User.findById(revieweeId);
    if (!reviewee) {
      return res.status(404).json({ success: false, message: "Mentor not found" });
    }

    if (!postId || !mongoose.isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message:
          "Link this review to your help request where they offered help. Ratings are only allowed after someone has offered help on your post.",
      });
    }
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Related help request not found" });
    }
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only link a review to your own help request",
      });
    }
    const offerIds = (post.offers || []).map((id) => id.toString());
    if (!offerIds.includes(revieweeId)) {
      return res.status(400).json({
        success: false,
        message: "You can only review someone who offered help on that help request",
      });
    }
    const postRef = post._id;

    const commentStr = typeof comment === "string" ? comment.trim() : "";
    if (commentStr.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment must be at most 2000 characters",
      });
    }

    const doc = await Review.create({
      reviewer: req.user._id,
      reviewee: revieweeId,
      post: postRef,
      rating: rid,
      comment: commentStr,
    });

    const populated = await Review.findById(doc._id)
      .populate("reviewer", "name")
      .populate("reviewee", "name")
      .populate("post", "subject topic")
      .lean();

    try {
      emitToUser(String(revieweeId), "review:received", {
        reviewId: String(doc._id),
        rating: rid,
        comment: commentStr || "",
        reviewerName: populated.reviewer?.name || "Someone",
        post: populated.post
          ? {
              subject: populated.post.subject || "",
              topic: populated.post.topic || "",
            }
          : null,
      });
    } catch (notifyErr) {
      console.error("review:received emit failed", notifyErr.message);
    }

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a review for this mentor on this help request.",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listMyGiven = async (req, res) => {
  try {
    const list = await Review.find({ reviewer: req.user._id })
      .sort({ createdAt: -1 })
      .populate("reviewee", "name email")
      .populate("post", "subject topic")
      .lean();
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listMyReceived = async (req, res) => {
  try {
    const list = await Review.find({ reviewee: req.user._id })
      .sort({ createdAt: -1 })
      .populate("reviewer", "name email")
      .populate("post", "subject topic")
      .lean();
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStatsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const data = await getFullReviewStatsForUser(userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const stars = Number(req.query.stars);
    const filter = { reviewee: userId };
    if (Number.isInteger(stars) && stars >= 1 && stars <= 5) {
      filter.rating = stars;
    }
    const list = await Review.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("reviewer", "name")
      .populate("post", "subject topic")
      .lean();
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
