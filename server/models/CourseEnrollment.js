const mongoose = require("mongoose");

const courseEnrollmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoursePromotion",
      required: true,
      index: true,
    },
    paidWith: { type: String, enum: ["credits", "bkash"], required: true },
    creditsSpent: { type: Number, default: 0, min: 0 },
    amountBdt: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

courseEnrollmentSchema.index({ user: 1, promotionId: 1 }, { unique: true });

module.exports = mongoose.model("CourseEnrollment", courseEnrollmentSchema);
