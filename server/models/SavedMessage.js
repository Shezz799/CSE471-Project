const mongoose = require("mongoose");

const savedMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    fileUrl: {
      type: String,
      trim: true,
      default: "",
    },
    fileType: {
      type: String,
      trim: true,
      default: "",
    },
    messageCreatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

savedMessageSchema.index({ savedBy: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model("SavedMessage", savedMessageSchema);
