const express = require("express");
const auth = require("../middleware/auth");
const {
  createReview,
  listMyGiven,
  listMyReceived,
  getStatsForUser,
  listForUser,
  deleteMyReview,
} = require("../controllers/reviewController");

const router = express.Router();

router.post("/", auth, createReview);
router.get("/me/given", auth, listMyGiven);
router.get("/me/received", auth, listMyReceived);
router.get("/stats/:userId", auth, getStatsForUser);
router.get("/user/:userId", auth, listForUser);
router.delete("/:reviewId", auth, deleteMyReview);

module.exports = router;
