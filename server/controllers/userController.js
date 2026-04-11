const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { getFullReviewStatsForUser } = require("../services/reviewStats");
const { isDashboardAdminUser } = require("../utils/adminAccess");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ALLOWED_SKILLS = ["python", "java", "c", "c++", "c#", "react"];

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const isAllowedDomain = (email) => {
  return typeof email === "string" && email.endsWith("@g.bracu.ac.bd");
};

const verifyGoogleToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};

const buildUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    skills: user.skills || [],
    department: user.department,
    phone: user.phone,
    linkedinUrl: user.linkedinUrl,
    githubUrl: user.githubUrl,
    portfolioUrl: user.portfolioUrl,
    profileCompleted: user.profileCompleted || false,
    role: user.role || "user",
    credits: user.credits != null ? user.credits : 5,
    accountStatus: user.accountStatus || "active",
    isDashboardAdmin: isDashboardAdminUser(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

exports.register = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken is required" });
    }

    const payload = await verifyGoogleToken(idToken);
    const email = payload.email;
    const name = payload.name || payload.given_name || "User";

    if (!payload.email_verified || !isAllowedDomain(email)) {
      return res.status(403).json({ success: false, message: "Unauthorized domain" });
    }

    const existingUser = await User.findOne({ email }).select("-password");
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      profileCompleted: false,
    });

    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      message: "User registered",
      data: {
        user: buildUserResponse(user),
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken is required" });
    }

    const payload = await verifyGoogleToken(idToken);
    const email = payload.email;

    if (!payload.email_verified || !isAllowedDomain(email)) {
      return res.status(403).json({ success: false, message: "Unauthorized domain" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const acct = user.accountStatus || "active";
    if (acct === "suspended") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message: "Your account is suspended. Check your university email for instructions.",
      });
    }
    if (acct === "banned") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BANNED",
        message: "Your account is banned. Check your university email for instructions.",
      });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: buildUserResponse(user),
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.profile = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Profile fetched",
    data: {
      user: buildUserResponse(req.user),
    },
  });
};

exports.getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const found = await User.findById(userId)
      .select("name email department bio skills profileCompleted")
      .lean();
    if (!found) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const reviewStats = await getFullReviewStatsForUser(userId);
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: found._id,
          name: found.name,
          email: found.email,
          department: found.department,
          bio: found.bio,
          skills: found.skills || [],
          profileCompleted: found.profileCompleted || false,
        },
        reviewStats,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.lookupByEmail = async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Query parameter email is required" });
    }
    const found = await User.findOne({ email }).select("_id name email");
    if (!found) {
      return res.status(404).json({ success: false, message: "No user with that email" });
    }
    if (found._id.equals(req.user._id)) {
      return res.status(400).json({ success: false, message: "That is your own email" });
    }
    return res.status(200).json({
      success: true,
      data: { id: found._id, name: found.name, email: found.email },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { bio, skills, department, phone, linkedinUrl, githubUrl, portfolioUrl } = req.body;

    if (!bio || !department || !phone || !linkedinUrl || !githubUrl || !portfolioUrl) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one skill" });
    }

    const normalizedSkills = skills.map((skill) => String(skill).toLowerCase());
    const invalidSkill = normalizedSkills.find((skill) => !ALLOWED_SKILLS.includes(skill));
    if (invalidSkill) {
      return res.status(400).json({ success: false, message: "Invalid skill selection" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        bio,
        skills: normalizedSkills,
        department,
        phone,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        profileCompleted: true,
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: {
        user: buildUserResponse(user),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
