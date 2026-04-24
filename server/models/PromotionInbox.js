const mongoose = require("mongoose");

/** One row per user per promotion — survives offline; cleared when promotion is retired. */
const promotionInboxSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoursePromotion",
      required: true,
      index: true,
    },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

promotionInboxSchema.index({ user: 1, promotionId: 1 }, { unique: true });

module.exports = mongoose.model("PromotionInbox", promotionInboxSchema);
