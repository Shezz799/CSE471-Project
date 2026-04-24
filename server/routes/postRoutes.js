const express = require("express");
const {
	getPosts,
	createPost,
	getPostById,
	deletePost,
	offerHelp,
	rejectOffer,
	getMyOfferNotifications,
} = require("../controllers/postController");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", getPosts);
router.get("/my-offer-notifications", auth, getMyOfferNotifications);
router.get("/:id", getPostById);
router.post("/", auth, createPost);
router.post("/:id/offer", auth, offerHelp);
router.post("/:id/offers/:offerUserId/reject", auth, rejectOffer);
router.delete("/:id", auth, deletePost);

module.exports = router;
