const express = require("express");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { getMessagesByChat, createMessage } = require("../controllers/messageController");

const router = express.Router();

router.get("/:chatId", auth, getMessagesByChat);
router.post("/:chatId", auth, upload.single("file"), createMessage);

module.exports = router;
