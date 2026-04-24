const mongoose = require("mongoose");

const CREDIT_LEDGER_TYPES = [
  "purchase",
  "gift_redemption",
  "dispute_credit_adjustment",
  "mentorship_streak_bonus",
  "course_promotion_purchase",
];

const creditLedgerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: CREDIT_LEDGER_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditLedger", creditLedgerSchema);
module.exports.CREDIT_LEDGER_TYPES = CREDIT_LEDGER_TYPES;
