const mongoose = require("mongoose");
const Review = require("../models/Review");
const User = require("../models/User");
const Post = require("../models/Post");

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

    let postRef = null;
    if (postId) {
      if (!mongoose.isValidObjectId(postId)) {
        return res.status(400).json({ success: false, message: "Invalid post id" });
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
      postRef = post._id;
    }

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

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "You have already submitted this review for this mentor (for this help request, if you selected one)",
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
    const agg = await Review.aggregate([
      { $match: { reviewee: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);
    const row = agg[0];
    const avg = row?.averageRating != null ? Math.round(row.averageRating * 100) / 100 : null;
    return res.status(200).json({
      success: true,
      data: {
        reviewCount: row ? row.count : 0,
        averageRating: avg,
      },
    });
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
    const list = await Review.find({ reviewee: userId })
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
