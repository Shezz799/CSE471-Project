const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
