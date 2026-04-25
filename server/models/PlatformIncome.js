const mongoose = require("mongoose");

/** One row per completed credit pack sale (BDT revenue for admin reporting). */
const platformIncomeSchema = new mongoose.Schema(
  {
    amountBdt: { type: Number, required: true, min: 0 },
    creditsSold: { type: Number, required: true, min: 1 },
    packageId: { type: String, default: "" },
    packageLabel: { type: String, default: "" },
    buyerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    source: {
      type: String,
      enum: ["bkash", "local_bkash_checkout", "simulate"],
      required: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "CreditPurchaseOrder", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformIncome", platformIncomeSchema);
