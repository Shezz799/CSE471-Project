const express = require("express");
const auth = require("../middleware/auth");
const {
  startSession,
  endSessionRequest,
  respondEndSession,
  getActiveSessionByChat,
  getMyPendingEndRequests,
} = require("../controllers/sessionController");
const { getMyCredits } = require("../controllers/creditController");

const router = express.Router();

router.post("/start", auth, startSession);
router.post("/end-request", auth, endSessionRequest);
router.post("/respond-end", auth, respondEndSession);
router.get("/end-requests/me", auth, getMyPendingEndRequests);
router.get("/chat/:chatId/active", auth, getActiveSessionByChat);
router.get("/credits/me", auth, getMyCredits);

module.exports = router;
