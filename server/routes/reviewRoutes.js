const express = require("express");
const auth = require("../middleware/auth");
const {
  createReview,
  listMyGiven,
  listMyReceived,
  getStatsForUser,
  listForUser,
} = require("../controllers/reviewController");

const router = express.Router();

router.post("/", auth, createReview);
router.get("/me/given", auth, listMyGiven);
router.get("/me/received", auth, listMyReceived);
router.get("/stats/:userId", getStatsForUser);
router.get("/user/:userId", listForUser);

module.exports = router;
