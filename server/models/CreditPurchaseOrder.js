const mongoose = require("mongoose");

const ORDER_STATUSES = ["pending", "completed", "failed", "cancelled"];

const creditPurchaseOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packageId: { type: String, required: true },
    credits: { type: Number, required: true, min: 1 },
    amountBdt: { type: Number, required: true, min: 1 },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      maxlength: 255,
      trim: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },
    provider: {
      type: String,
      default: "bkash",
    },
    /** Local checkout (BKASH_DEMO_MODE): no call to bKash servers */
    isDemoCheckout: {
      type: Boolean,
      default: false,
    },
    /** bKash paymentID from Create Payment response */
    bkashPaymentID: {
      type: String,
      default: "",
      index: true,
    },
    bkashTrxID: {
      type: String,
      default: "",
    },
    bkashCreateResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    bkashExecuteResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    lastError: {
      type: String,
      default: "",
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditPurchaseOrder", creditPurchaseOrderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
