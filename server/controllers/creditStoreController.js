const mongoose = require("mongoose");
const User = require("../models/User");
const CreditLedger = require("../models/CreditLedger");
const CreditPurchaseOrder = require("../models/CreditPurchaseOrder");
const PlatformIncome = require("../models/PlatformIncome");
const { emitToUser } = require("../socket/socketServer");
const { normalizeUserCreditFields } = require("./creditController");
const {
  isBkashConfigured,
  isBkashDemoMode,
  parseEnvBool,
  grantToken,
  createPayment,
  executePayment,
} = require("../services/bkashCheckoutService");

const CREDIT_PACKAGES = [
  { id: "mini_10", label: "Mini Pack", credits: 10, priceBdt: 30 },
  { id: "student_25", label: "Student Pack", credits: 25, priceBdt: 60 },
  { id: "pro_60", label: "Pro Pack", credits: 60, priceBdt: 150 },
];

const REDEEMABLE_GIFTS = [
  {
    id: "premium_gpt_1d",
    label: "ChatGPT Plus (access hub)",
    durationDays: 1,
    costCredits: 22,
    accessKey: "chatgpt",
    externalUrl: "https://chat.openai.com",
  },
  {
    id: "premium_gpt_7d",
    label: "ChatGPT Plus (access hub)",
    durationDays: 7,
    costCredits: 119,
    accessKey: "chatgpt",
    externalUrl: "https://chat.openai.com",
  },
  {
    id: "turnitin_3d",
    label: "Turnitin (access hub)",
    durationDays: 3,
    costCredits: 45,
    accessKey: "turnitin",
    externalUrl: "https://www.turnitin.com",
  },
  {
    id: "canva_7d",
    label: "Canva Pro (access hub)",
    durationDays: 7,
    costCredits: 95,
    accessKey: "canva",
    externalUrl: "https://www.canva.com",
  },
];

const PAYMENT_METHODS = ["bkash", "nagad", "rocket", "card"];

const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clientUrlBase = () => (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

const safeInvoice = () => {
  const rand = Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(0, 10);
  return `cc${Date.now()}${rand}`.slice(0, 240);
};

const payerRefFromUser = (user) => {
  const raw = (user?.email || String(user?._id || "student")).replace(/[^0-9a-z]/gi, "");
  return raw.slice(0, 50) || "student";
};

const packLabel = (packageId) => CREDIT_PACKAGES.find((p) => p.id === packageId)?.label || packageId;

const giftAccessPath = (gift) =>
  `/access/${gift.accessKey}?days=${gift.durationDays}&gift=${encodeURIComponent(gift.id)}`;

const recordCreditSaleIncome = async ({ amountBdt, creditsSold, packageId, buyerUserId, source, orderId }) => {
  await PlatformIncome.create({
    amountBdt,
    creditsSold,
    packageId,
    packageLabel: packLabel(packageId),
    buyerUser: buyerUserId,
    source,
    orderId: orderId || null,
  });
};

const emitBuyerWallet = (userId, { title, message, link }) => {
  emitToUser(String(userId), "wallet:update", { title, message, link: link || "/credits" });
};

const emitAdminsIncome = async ({ amountBdt, creditsSold }) => {
  const agg = await PlatformIncome.aggregate([{ $group: { _id: null, total: { $sum: "$amountBdt" } } }]);
  const totalBdt = Math.round((agg[0]?.total || 0) * 100) / 100;
  const admins = await User.find({ role: "admin" }).select("_id").lean();
  const msg = `৳${amountBdt} · ${creditsSold} credits sold · all-time total ৳${totalBdt}`;
  admins.forEach((a) => {
    emitToUser(String(a._id), "platform:income", {
      title: "Credit sale",
      message: msg,
      link: "/admin",
    });
  });
};

/**
 * After bKash Execute Payment succeeds (or demo equivalent), credit wallet once.
 * @param {import("mongoose").Document} order — must have .user with _id (populate ok)
 * @param {object} exec — bKash-shaped execute response
 * @param {string} paymentIDForLedger
 * @returns {{ credited: boolean }}
 */
const creditWalletForCompletedOrder = async (order, exec, paymentIDForLedger) => {
  const amountPaid = String(exec.amount || "");
  if (amountPaid && Number(amountPaid) !== Number(order.amountBdt)) {
    order.status = "failed";
    order.lastError = `Amount mismatch: expected ${order.amountBdt}, got ${amountPaid}`;
    order.bkashExecuteResponse = exec;
    await order.save();
    throw new Error("amount_mismatch");
  }

  const locked = await CreditPurchaseOrder.findOneAndUpdate(
    { _id: order._id, status: "pending" },
    {
      $set: {
        status: "completed",
        bkashTrxID: exec.trxID || "",
        bkashExecuteResponse: exec,
      },
    },
    { new: true }
  );

  if (!locked) {
    return { credited: false };
  }

  const userId = order.user?._id || order.user;
  await normalizeUserCreditFields(userId);
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { totalCredits: order.credits, credits: order.credits } },
    { new: true }
  ).select("totalCredits heldCredits credits");

  await CreditLedger.create({
    user: userId,
    type: "purchase",
    amount: order.credits,
    balanceAfter: asNumber(updatedUser?.totalCredits, 0),
    metadata: {
      packageId: order.packageId,
      priceBdt: order.amountBdt,
      paymentMethod: "bkash",
      bkashTrxID: exec.trxID || "",
      bkashPaymentID: paymentIDForLedger,
      merchantInvoiceNumber: order.invoiceNumber,
      bkashLocalCheckout: Boolean(order.isDemoCheckout),
    },
  });

  const incomeSource = order.isDemoCheckout ? "local_bkash_checkout" : "bkash";
  await recordCreditSaleIncome({
    amountBdt: order.amountBdt,
    creditsSold: order.credits,
    packageId: order.packageId,
    buyerUserId: userId,
    source: incomeSource,
    orderId: order._id,
  });

  emitBuyerWallet(userId, {
    title: "Credits added",
    message: `+${order.credits} credits (৳${order.amountBdt}) — ${packLabel(order.packageId)}.`,
    link: "/credits",
  });
  await emitAdminsIncome({ amountBdt: order.amountBdt, creditsSold: order.credits });

  return { credited: true };
};

exports.getStoreData = async (req, res) => {
  try {
    const user = await normalizeUserCreditFields(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({
      success: true,
      data: {
        wallet: {
          totalCredits: asNumber(user.totalCredits, 0),
          heldCredits: asNumber(user.heldCredits, 0),
        },
        packages: CREDIT_PACKAGES,
        gifts: REDEEMABLE_GIFTS,
        payment: {
          bkash: {
            configured: isBkashConfigured(),
            callbackOriginSet: Boolean(process.env.BKASH_CALLBACK_ORIGIN?.trim()),
          },
          bkashDemoModeEnabled: isBkashDemoMode(),
          simulatePurchaseAllowed: parseEnvBool(process.env.ALLOW_CREDIT_PURCHASE_SIMULATE),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Dev-only instant credits (no external payment). Disabled unless ALLOW_CREDIT_PURCHASE_SIMULATE=true.
 */
exports.purchaseCredits = async (req, res) => {
  try {
    if (!parseEnvBool(process.env.ALLOW_CREDIT_PURCHASE_SIMULATE)) {
      return res.status(400).json({
        success: false,
        message:
          "Instant simulated purchase is disabled. Configure bKash env vars and use “Pay with bKash”, or set ALLOW_CREDIT_PURCHASE_SIMULATE=true for local testing only.",
      });
    }

    const packageId = typeof req.body.packageId === "string" ? req.body.packageId.trim() : "";
    const paymentMethod = typeof req.body.paymentMethod === "string" ? req.body.paymentMethod.trim() : "";
    const transactionRef =
      typeof req.body.transactionRef === "string" ? req.body.transactionRef.trim().slice(0, 120) : "";

    const pack = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pack) {
      return res.status(400).json({ success: false, message: "Invalid credit package" });
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }

    await normalizeUserCreditFields(req.user._id);
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { totalCredits: pack.credits, credits: pack.credits } },
      { new: true }
    ).select("totalCredits heldCredits credits name email");

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await CreditLedger.create({
      user: req.user._id,
      type: "purchase",
      amount: pack.credits,
      balanceAfter: asNumber(updatedUser.totalCredits, 0),
      metadata: {
        packageId: pack.id,
        packageLabel: pack.label,
        priceBdt: pack.priceBdt,
        paymentMethod,
        transactionRef: transactionRef || "simulate",
        simulated: true,
      },
    });

    await recordCreditSaleIncome({
      amountBdt: pack.priceBdt,
      creditsSold: pack.credits,
      packageId: pack.id,
      buyerUserId: req.user._id,
      source: "simulate",
      orderId: null,
    });

    emitBuyerWallet(req.user._id, {
      title: "Credits added",
      message: `+${pack.credits} credits (৳${pack.priceBdt}) — ${pack.label}.`,
      link: "/credits",
    });
    await emitAdminsIncome({ amountBdt: pack.priceBdt, creditsSold: pack.credits });

    return res.status(200).json({
      success: true,
      message: `Purchased ${pack.credits} credits successfully (simulated)`,
      data: {
        wallet: {
          totalCredits: asNumber(updatedUser.totalCredits, 0),
          heldCredits: asNumber(updatedUser.heldCredits, 0),
        },
        purchasedPackage: pack,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Start real bKash tokenized checkout: returns bkashURL to open in the browser.
 */
exports.startBkashPurchase = async (req, res) => {
  try {
    const packageId = typeof req.body.packageId === "string" ? req.body.packageId.trim() : "";
    const pack = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pack) {
      return res.status(400).json({ success: false, message: "Invalid credit package" });
    }

    if (isBkashDemoMode()) {
      const invoiceNumber = safeInvoice();
      const order = await CreditPurchaseOrder.create({
        user: req.user._id,
        packageId: pack.id,
        credits: pack.credits,
        amountBdt: pack.priceBdt,
        invoiceNumber,
        status: "pending",
        provider: "bkash",
        isDemoCheckout: true,
        bkashCreateResponse: { localCheckout: true },
      });
      return res.status(200).json({
        success: true,
        data: {
          demoMode: true,
          orderId: order._id,
          invoiceNumber,
          amountBdt: pack.priceBdt,
          credits: pack.credits,
          packageId: pack.id,
        },
      });
    }

    if (!isBkashConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "bKash is not configured. Set BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD, and BKASH_TOKENIZE_BASE_URL on the server — or set BKASH_DEMO_MODE=true for local checkout without calling bKash.",
      });
    }
    const callbackOrigin = (process.env.BKASH_CALLBACK_ORIGIN || "").trim();
    if (!callbackOrigin) {
      return res.status(503).json({
        success: false,
        message:
          "Set BKASH_CALLBACK_ORIGIN to the public origin of this API (no path), e.g. https://your-subdomain.ngrok-free.app — bKash redirects the user to /callback on that host. Or use BKASH_DEMO_MODE=true for local checkout.",
      });
    }

    const invoiceNumber = safeInvoice();
    const order = await CreditPurchaseOrder.create({
      user: req.user._id,
      packageId: pack.id,
      credits: pack.credits,
      amountBdt: pack.priceBdt,
      invoiceNumber,
      status: "pending",
      provider: "bkash",
    });

    const idToken = await grantToken();
    const createRes = await createPayment(idToken, {
      amount: pack.priceBdt,
      invoice: invoiceNumber,
      payerReference: payerRefFromUser(req.user),
      callbackOrigin,
    });

    const paymentID = createRes.paymentID;
    const bkashURL = createRes.bkashURL;
    if (!paymentID || !bkashURL) {
      order.status = "failed";
      order.lastError = "Create payment response missing paymentID or bkashURL";
      await order.save();
      return res.status(502).json({ success: false, message: order.lastError });
    }

    order.bkashPaymentID = paymentID;
    order.bkashCreateResponse = createRes;
    await order.save();

    return res.status(200).json({
      success: true,
      data: {
        bkashURL,
        paymentID,
        invoiceNumber,
        orderId: order._id,
        amountBdt: pack.priceBdt,
        credits: pack.credits,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Browser redirect from bKash (GET /callback?paymentID=...&status=success|failure|cancel&...).
 * Mounted at app root — see server/app.js.
 */
exports.bkashCallbackGet = async (req, res) => {
  const base = clientUrlBase();
  const paymentID = String(req.query.paymentID || req.query.paymentId || "").trim();
  const status = String(req.query.status || "").toLowerCase();

  const redirect = (path) => {
    res.redirect(302, `${base}${path}`);
  };

  try {
    if (!paymentID) {
      return redirect("/credits?purchase=error&reason=missing_payment_id");
    }

    const order = await CreditPurchaseOrder.findOne({ bkashPaymentID: paymentID }).populate("user");
    if (!order) {
      return redirect("/credits?purchase=error&reason=unknown_order");
    }

    if (order.isDemoCheckout) {
      return redirect("/credits?purchase=error&reason=demo_use_credit_center");
    }

    if (order.status === "completed") {
      return redirect("/credits?purchase=success");
    }

    if (status === "failure" || status === "failed") {
      order.status = "failed";
      order.lastError = "bKash callback status=failure";
      await order.save();
      return redirect("/credits?purchase=failed");
    }
    if (status === "cancel" || status === "cancelled") {
      order.status = "cancelled";
      order.lastError = "User cancelled at bKash";
      await order.save();
      return redirect("/credits?purchase=cancelled");
    }

    const idToken = await grantToken();
    const exec = await executePayment(idToken, paymentID);

    const ok =
      exec.statusCode === "0000" &&
      String(exec.transactionStatus || "").toLowerCase() === "completed";

    if (!ok) {
      order.status = "failed";
      order.lastError = exec.statusMessage || exec.errorMessage || JSON.stringify(exec);
      order.bkashExecuteResponse = exec;
      await order.save();
      return redirect("/credits?purchase=failed");
    }

    try {
      await creditWalletForCompletedOrder(order, exec, paymentID);
    } catch (e) {
      if (e.message === "amount_mismatch") {
        return redirect("/credits?purchase=error&reason=amount_mismatch");
      }
      throw e;
    }

    return redirect("/credits?purchase=success");
  } catch (error) {
    if (paymentID) {
      await CreditPurchaseOrder.updateMany(
        { bkashPaymentID: paymentID, status: "pending" },
        { $set: { status: "failed", lastError: error.message?.slice(0, 2000) || "execute_error" } }
      );
    }
    return redirect(`/credits?purchase=error&reason=${encodeURIComponent("execute_failed")}`);
  }
};

exports.getBkashDemoOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const order = await CreditPurchaseOrder.findOne({
      _id: orderId,
      user: req.user._id,
      isDemoCheckout: true,
    }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Checkout order not found" });
    }
    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        status: order.status,
        credits: order.credits,
        amountBdt: order.amountBdt,
        invoiceNumber: order.invoiceNumber,
        packageId: order.packageId,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeBkashDemoPurchase = async (req, res) => {
  try {
    const orderId = typeof req.body.orderId === "string" ? req.body.orderId.trim() : "";
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const order = await CreditPurchaseOrder.findOne({
      _id: orderId,
      user: req.user._id,
      isDemoCheckout: true,
      status: "pending",
    }).populate("user");

    if (!order) {
      return res.status(404).json({ success: false, message: "Pending checkout order not found" });
    }

    const fakePaymentId = `DEMO_${order._id}`;
    const exec = {
      statusCode: "0000",
      statusMessage: "Successful",
      transactionStatus: "Completed",
      amount: String(order.amountBdt),
      trxID: `LOCAL-${Date.now()}`,
      merchantInvoiceNumber: order.invoiceNumber,
      paymentID: fakePaymentId,
    };

    try {
      await creditWalletForCompletedOrder(order, exec, fakePaymentId);
    } catch (e) {
      if (e.message === "amount_mismatch") {
        return res.status(400).json({ success: false, message: "Amount validation failed" });
      }
      throw e;
    }

    const walletUser = await normalizeUserCreditFields(req.user._id);
    return res.status(200).json({
      success: true,
      message: "Payment completed — credits added to your wallet.",
      data: {
        wallet: {
          totalCredits: asNumber(walletUser?.totalCredits, 0),
          heldCredits: asNumber(walletUser?.heldCredits, 0),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.redeemGift = async (req, res) => {
  try {
    const giftId = typeof req.body.giftId === "string" ? req.body.giftId.trim() : "";
    const gift = REDEEMABLE_GIFTS.find((g) => g.id === giftId);
    if (!gift) {
      return res.status(400).json({ success: false, message: "Invalid gift option" });
    }

    await normalizeUserCreditFields(req.user._id);
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, totalCredits: { $gte: gift.costCredits } },
      { $inc: { totalCredits: -gift.costCredits, credits: -gift.costCredits } },
      { new: true }
    ).select("totalCredits heldCredits credits name email");

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message: "Insufficient credits for this redemption",
      });
    }

    const accessPath = giftAccessPath(gift);
    const accessUrl = `${clientUrlBase()}${accessPath}`;

    await CreditLedger.create({
      user: req.user._id,
      type: "gift_redemption",
      amount: -gift.costCredits,
      balanceAfter: asNumber(updatedUser.totalCredits, 0),
      metadata: {
        giftId: gift.id,
        giftLabel: gift.label,
        durationDays: gift.durationDays,
        accessKey: gift.accessKey,
        accessUrl,
        externalUrl: gift.externalUrl,
      },
    });

    emitBuyerWallet(req.user._id, {
      title: "Gift redeemed",
      message: `${gift.label} — open your access hub for the next ${gift.durationDays} day${gift.durationDays === 1 ? "" : "s"}.`,
      link: accessPath,
    });

    return res.status(200).json({
      success: true,
      message: `Redeemed ${gift.label} (${gift.durationDays} day${gift.durationDays === 1 ? "" : "s"})`,
      data: {
        wallet: {
          totalCredits: asNumber(updatedUser.totalCredits, 0),
          heldCredits: asNumber(updatedUser.heldCredits, 0),
        },
        redeemedGift: gift,
        accessUrl,
        accessPath,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyCreditLedger = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const rows = await CreditLedger.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean();
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
