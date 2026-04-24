const express = require("express");
const auth = require("../middleware/auth");
const { requireDashboardAdmin } = require("../middleware/admin");
const {
  getStats,
  searchUsers,
  getUserAdmin,
  listSuspended,
  listBanned,
  suspendUser,
  banUser,
  unsuspendUser,
  unbanUser,
  releaseBannedEmail,
  listLowRated,
  sendCoachingEmail,
} = require("../controllers/adminController");

const router = express.Router();

router.use(auth, requireDashboardAdmin);

router.get("/stats", getStats);
router.get("/users/search", searchUsers);
router.get("/users/suspended", listSuspended);
router.get("/users/banned", listBanned);
router.get("/users/low-rating", listLowRated);
router.get("/users/:id", getUserAdmin);
router.post("/users/:id/suspend", suspendUser);
router.post("/users/:id/ban", banUser);
router.post("/users/:id/unsuspend", unsuspendUser);
router.post("/users/:id/unban", unbanUser);
router.post("/users/:id/release-email", releaseBannedEmail);
router.post("/users/:id/coach-email", sendCoachingEmail);

module.exports = router;
