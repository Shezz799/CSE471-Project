const express = require("express");
const {
  register,
  login,
  profile,
  updateProfile,
  lookupByEmail,
  getPublicProfile,
} = require("../controllers/userController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", auth, profile);
router.get("/public/:userId", auth, getPublicProfile);
router.get("/lookup-by-email", auth, lookupByEmail);
router.put("/profile", auth, updateProfile);

module.exports = router;
