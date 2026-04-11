const mongoose = require("mongoose");

const COMPLAINT_CATEGORIES = [
  "user_behavior",
  "harassment",
  "spam",
  "inappropriate_content",
  "platform_bug",
  "other",
];

const COMPLAINT_STATUSES = ["open", "in_progress", "resolved", "dismissed"];

const complaintSchema = new mongoose.Schema(
  {
    complainant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subjectUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    category: {
      type: String,
      required: true,
      enum: COMPLAINT_CATEGORIES,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: "open",
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
module.exports.COMPLAINT_CATEGORIES = COMPLAINT_CATEGORIES;
module.exports.COMPLAINT_STATUSES = COMPLAINT_STATUSES;
