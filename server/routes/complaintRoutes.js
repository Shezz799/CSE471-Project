const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");
const {
  createComplaint,
  listMine,
  listAll,
  updateComplaint,
} = require("../controllers/complaintController");

const router = express.Router();

router.post("/", auth, createComplaint);
router.get("/mine", auth, listMine);
router.get("/", auth, requireAdmin, listAll);
router.patch("/:id", auth, requireAdmin, updateComplaint);

module.exports = router;
