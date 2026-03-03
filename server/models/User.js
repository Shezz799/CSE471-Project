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
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);