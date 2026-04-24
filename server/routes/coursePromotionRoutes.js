const express = require("express");
const auth = require("../middleware/auth");
const { requireDashboardAdmin } = require("../middleware/admin");
const {
  createPromotion,
  listPromotionsAdmin,
  updatePromotionAdmin,
  deletePromotionAdmin,
  listActivePromotionsCatalog,
  getMyPromotionInbox,
  markPromotionInboxRead,
  getPromotionPublic,
  getMyEnrollment,
  buyWithCredits,
  startBkashCoursePurchase,
  getBkashDemoCourseOrder,
  completeBkashDemoCoursePurchase,
} = require("../controllers/coursePromotionController");

const router = express.Router();

router.get("/purchase/bkash/demo/:orderId", auth, getBkashDemoCourseOrder);
router.post("/purchase/bkash/demo/complete", auth, completeBkashDemoCoursePurchase);

router.get("/catalog", listActivePromotionsCatalog);

router.get("/inbox/me", auth, getMyPromotionInbox);
router.post("/inbox/:promotionId/read", auth, markPromotionInboxRead);

router.post("/admin/promotions", auth, requireDashboardAdmin, createPromotion);
router.get("/admin/promotions", auth, requireDashboardAdmin, listPromotionsAdmin);
router.patch("/admin/promotions/:id", auth, requireDashboardAdmin, updatePromotionAdmin);
router.delete("/admin/promotions/:id", auth, requireDashboardAdmin, deletePromotionAdmin);

router.get("/:id/enrollment", auth, getMyEnrollment);
router.post("/:id/purchase/credits", auth, buyWithCredits);
router.post("/:id/purchase/bkash/start", auth, startBkashCoursePurchase);

router.get("/:id", getPromotionPublic);

module.exports = router;
