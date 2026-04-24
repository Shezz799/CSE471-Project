const express = require("express");
const auth = require("../middleware/auth");
const { requireDashboardAdmin } = require("../middleware/admin");
const {
  createComplaint,
  listMine,
  getMineOne,
  submitAppeal,
  listAll,
  getOne,
  updateComplaint,
  resolveComplaint,
} = require("../controllers/complaintController");

const router = express.Router();

router.post("/", auth, createComplaint);
router.get("/mine", auth, listMine);
router.get("/mine/:id", auth, getMineOne);
router.post("/mine/:id/appeal", auth, submitAppeal);
router.get("/", auth, requireDashboardAdmin, listAll);
router.get("/:id", auth, requireDashboardAdmin, getOne);
router.patch("/:id", auth, requireDashboardAdmin, updateComplaint);
router.post("/:id/resolve", auth, requireDashboardAdmin, resolveComplaint);

module.exports = router;
