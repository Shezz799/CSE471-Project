const mongoose = require("mongoose");

const coursePromotionSchema = new mongoose.Schema(
  {
    courseName: { type: String, required: true, trim: true, maxlength: 200 },
    instructorName: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, minlength: 20, maxlength: 20000 },
    priceBdt: { type: Number, required: true, min: 0, default: 0 },
    priceCredits: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoursePromotion", coursePromotionSchema);
