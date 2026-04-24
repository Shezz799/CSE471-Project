const express = require("express");
const auth = require("../middleware/auth");
const { requireDashboardAdmin } = require("../middleware/admin");
const {
  createComplaint,
  listMine,
  listAll,
  getOne,
  updateComplaint,
} = require("../controllers/complaintController");

const router = express.Router();

router.post("/", auth, createComplaint);
router.get("/mine", auth, listMine);
router.get("/", auth, requireDashboardAdmin, listAll);
router.get("/:id", auth, requireDashboardAdmin, getOne);
router.patch("/:id", auth, requireDashboardAdmin, updateComplaint);

module.exports = router;
