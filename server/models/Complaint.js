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

/** Admin pipeline labels: received → under review → result */
const COMPLAINT_PIPELINE_STAGES = ["received", "under_review", "result"];

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
    pipelineStage: {
      type: String,
      enum: COMPLAINT_PIPELINE_STAGES,
      default: "received",
    },
    complainantMessage: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
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
module.exports.COMPLAINT_PIPELINE_STAGES = COMPLAINT_PIPELINE_STAGES;
