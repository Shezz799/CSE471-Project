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
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolutionSummary: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    disputeOutcome: {
      type: String,
      enum: ["", "complainant_upheld", "subject_upheld", "partial"],
      default: "",
    },
    /** Optional screenshots / Drive links / chat logs (https URLs only), max 5 */
    evidenceLinks: {
      type: [String],
      default: [],
      validate: {
        validator(arr) {
          return !arr || arr.length <= 5;
        },
        message: "At most 5 evidence links are allowed",
      },
    },
    /** One appeal after status resolved or dismissed; reopens ticket for admins */
    appealMessage: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    appealedAt: {
      type: Date,
      default: null,
    },
    /** True after the complainant uses their single allowed appeal */
    appealExhausted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
module.exports.COMPLAINT_CATEGORIES = COMPLAINT_CATEGORIES;
module.exports.COMPLAINT_STATUSES = COMPLAINT_STATUSES;
module.exports.COMPLAINT_PIPELINE_STAGES = COMPLAINT_PIPELINE_STAGES;
