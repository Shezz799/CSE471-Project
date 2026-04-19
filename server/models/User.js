const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  bio: {
    type: String,
    trim: true,
  },
  skills: {
    type: [String],
    default: [],
  },
  department: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  linkedinUrl: {
    type: String,
    trim: true,
  },
  githubUrl: {
    type: String,
    trim: true,
  },
  portfolioUrl: {
    type: String,
    trim: true,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  accountStatus: {
    type: String,
    enum: ["active", "suspended", "banned"],
    default: "active",
  },
  lastModerationAt: {
    type: Date,
    default: null,
  },
  moderationReason: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: "",
  },
  moderationAppealToken: {
    type: String,
    default: null,
    select: false,
  },
  moderationAppealExpiresAt: {
    type: Date,
    default: null,
    select: false,
  },
  appealPending: {
    type: Boolean,
    default: false,
  },
  appealMessage: {
    type: String,
    trim: true,
    maxlength: 4000,
    default: "",
  },
  totalCredits: {
    type: Number,
    default: 5,
    min: 0,
  },
  heldCredits: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Legacy field preserved for backward compatibility with existing clients.
  credits: {
    type: Number,
    default: 5,
    min: 0,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);