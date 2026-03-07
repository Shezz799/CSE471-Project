const express = require("express");
const { getPosts, createPost, getPostById, deletePost, offerHelp } = require("../controllers/postController");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", getPosts);
router.get("/:id", getPostById);
router.post("/", auth, createPost);
router.post("/:id/offer", auth, offerHelp);
router.delete("/:id", auth, deletePost);

module.exports = router;
