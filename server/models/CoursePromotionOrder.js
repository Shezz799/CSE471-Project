const mongoose = require("mongoose");

const ORDER_STATUSES = ["pending", "completed", "failed", "cancelled"];

const coursePromotionOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoursePromotion",
      required: true,
      index: true,
    },
    amountBdt: { type: Number, required: true, min: 1 },
    invoiceNumber: { type: String, required: true, unique: true, maxlength: 255, trim: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    provider: { type: String, default: "bkash" },
    isDemoCheckout: { type: Boolean, default: false },
    bkashPaymentID: { type: String, default: "", index: true },
    bkashTrxID: { type: String, default: "" },
    bkashCreateResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    bkashExecuteResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    lastError: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoursePromotionOrder", coursePromotionOrderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
