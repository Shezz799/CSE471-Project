const express = require("express");
const {
  register,
  login,
  profile,
  updateProfile,
  lookupByEmail,
  getPublicProfile,
  getUserAnalytics,
} = require("../controllers/userController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", auth, profile);
router.get("/public/:userId", auth, getPublicProfile);
router.get("/lookup-by-email", auth, lookupByEmail);
router.put("/profile", auth, updateProfile);
router.get("/analytics", auth, getUserAnalytics);

module.exports = router;
