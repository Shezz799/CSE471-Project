const mongoose = require("mongoose");
const Review = require("../models/Review");
const User = require("../models/User");
const Post = require("../models/Post");
const { getFullReviewStatsForUser } = require("../services/reviewStats");
const { emitToUser } = require("../socket/socketServer");

const normalizeRating = (r) => {
  const n = Number(r);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
};

const RATING_CRITERIA_KEYS = [
  "topicKnowledge",
  "teachingClarity",
  "communication",
  "patience",
  "professionalism",
  "helpfulness",
];

const normalizeCriteriaRatings = (criteriaInput, fallbackRating = null) => {
  const source = criteriaInput && typeof criteriaInput === "object" ? criteriaInput : {};
  const normalized = {};
  for (const key of RATING_CRITERIA_KEYS) {
    const raw = source[key] != null ? source[key] : fallbackRating;
    const next = normalizeRating(raw);
    if (next == null) return null;
    normalized[key] = next;
  }
  return normalized;
};

const averageCriteria = (criteria) => {
  const values = RATING_CRITERIA_KEYS.map((key) => Number(criteria[key]));
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.round(avg * 100) / 100;
};

exports.createReview = async (req, res) => {
  try {
    const { revieweeId, postId, rating, comment, criteria } = req.body;
    const fallbackRating = normalizeRating(rating);
    const normalizedCriteria = normalizeCriteriaRatings(criteria, fallbackRating);
    if (normalizedCriteria == null) {
      return res.status(400).json({
        success: false,
        message: "All rating topics must be numbers from 1 to 5",
      });
    }
    const rid = averageCriteria(normalizedCriteria);
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
      criteria: normalizedCriteria,
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
        criteria: normalizedCriteria,
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

exports.deleteMyReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!mongoose.isValidObjectId(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review id" });
    }
    const removed = await Review.findOneAndDelete({
      _id: reviewId,
      reviewer: req.user._id,
    });
    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you cannot delete it",
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
