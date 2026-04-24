const express = require("express");
const auth = require("../middleware/auth");
const {
  getStoreData,
  purchaseCredits,
  startBkashPurchase,
  getBkashDemoOrder,
  completeBkashDemoPurchase,
  redeemGift,
  getMyCreditLedger,
} = require("../controllers/creditStoreController");

const router = express.Router();

router.use(auth);
router.get("/store", getStoreData);
router.get("/ledger/me", getMyCreditLedger);
router.get("/purchase/bkash/demo/:orderId", getBkashDemoOrder);
router.post("/purchase/bkash/demo/complete", completeBkashDemoPurchase);
router.post("/purchase/bkash/start", startBkashPurchase);
router.post("/purchase", purchaseCredits);
router.post("/redeem", redeemGift);

module.exports = router;
