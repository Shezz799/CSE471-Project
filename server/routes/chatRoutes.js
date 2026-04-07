const express = require("express");
const auth = require("../middleware/auth");
const { getChats, getChatUsers } = require("../controllers/chatController");

const router = express.Router();

router.get("/", auth, getChats);
router.get("/users", auth, getChatUsers);

module.exports = router;
