const express = require("express");
const {
  register,
  login,
  profile,
  updateProfile,
  lookupByEmail,
} = require("../controllers/userController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", auth, profile);
router.get("/lookup-by-email", auth, lookupByEmail);
router.put("/profile", auth, updateProfile);

module.exports = router;
