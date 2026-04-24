const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    criteria: {
      topicKnowledge: { type: Number, min: 1, max: 5, required: true },
      teachingClarity: { type: Number, min: 1, max: 5, required: true },
      communication: { type: Number, min: 1, max: 5, required: true },
      patience: { type: Number, min: 1, max: 5, required: true },
      professionalism: { type: Number, min: 1, max: 5, required: true },
      helpfulness: { type: Number, min: 1, max: 5, required: true },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { timestamps: true }
);

reviewSchema.index({ reviewer: 1, reviewee: 1, post: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
