const express = require("express");
const auth = require("../middleware/auth");
const { sendInvite, respondInvite, getMyInvites } = require("../controllers/inviteController");

const router = express.Router();

router.get("/", auth, getMyInvites);
router.post("/send", auth, sendInvite);
router.post("/respond", auth, respondInvite);

module.exports = router;
