const mongoose = require("mongoose");
const CoursePromotion = require("../models/CoursePromotion");
const CoursePromotionOrder = require("../models/CoursePromotionOrder");
const CourseEnrollment = require("../models/CourseEnrollment");
const PromotionInbox = require("../models/PromotionInbox");
const User = require("../models/User");
const CreditLedger = require("../models/CreditLedger");
const { normalizeUserCreditFields } = require("./creditController");
const { isBkashConfigured, isBkashDemoMode, grantToken, createPayment, executePayment } = require("../services/bkashCheckoutService");
const { emitToUser, getOnlineSocketCountForUser } = require("../socket/socketServer");

const clientUrlBase = () => (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

const safeInvoice = () => {
  const rand = Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(0, 10);
  return `ccp${Date.now()}${rand}`.slice(0, 240);
};

const payerRefFromUser = (user) => {
  const raw = (user?.email || String(user?._id || "student")).replace(/[^0-9a-z]/gi, "");
  return raw.slice(0, 50) || "student";
};

const asNumber = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.listActivePromotionsCatalog = async (req, res) => {
  try {
    const raw = String(req.query.q || "").trim();
    const filter = { isActive: true };
    if (raw) {
      const terms = raw.split(/\s+/).filter(Boolean).slice(0, 10);
      if (terms.length) {
        filter.$and = terms.map((term) => ({
          $or: [
            { courseName: new RegExp(escapeRegex(term), "i") },
            { instructorName: new RegExp(escapeRegex(term), "i") },
            { content: new RegExp(escapeRegex(term), "i") },
          ],
        }));
      }
    }

    const rows = await CoursePromotion.find(filter)
      .sort({ createdAt: -1 })
      .select("courseName instructorName content priceBdt priceCredits createdAt")
      .limit(80)
      .lean();

    const data = rows.map((r) => {
      const c = r.content || "";
      const excerpt = c.length > 220 ? `${c.slice(0, 220)}…` : c;
      return {
        _id: r._id,
        courseName: r.courseName,
        instructorName: r.instructorName,
        excerpt,
        priceBdt: r.priceBdt,
        priceCredits: r.priceCredits,
        createdAt: r.createdAt,
      };
    });

    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

const parsePromotionPrices = (body) => {
  const priceBdt = Number(body.priceBdt);
  const rawCredits = Number(body.priceCredits);
  if (!Number.isFinite(rawCredits) || rawCredits < 0 || Math.floor(rawCredits) !== rawCredits) {
    return { error: "Price in credits must be a non-negative integer" };
  }
  const priceCredits = rawCredits;
  if (!Number.isFinite(priceBdt) || priceBdt < 0) {
    return { error: "Price in BDT must be zero or positive" };
  }
  if (priceBdt < 1 && priceCredits < 1) {
    return { error: "Set at least one payment option: ৳1+ in BDT and/or 1+ credits" };
  }
  return { priceBdt, priceCredits };
};

exports.createPromotion = async (req, res) => {
  try {
    const courseName = typeof req.body.courseName === "string" ? req.body.courseName.trim() : "";
    const instructorName = typeof req.body.instructorName === "string" ? req.body.instructorName.trim() : "";
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    const parsed = parsePromotionPrices(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    const { priceBdt, priceCredits } = parsed;

    if (!courseName || !instructorName) {
      return res.status(400).json({ success: false, message: "Course name and instructor name are required" });
    }
    if (content.length < 20) {
      return res.status(400).json({ success: false, message: "Course content must be at least 20 characters" });
    }

    const doc = await CoursePromotion.create({
      courseName,
      instructorName,
      content,
      priceBdt,
      priceCredits,
      createdBy: req.user._id,
    });

    const link = `/courses/promo/${doc._id}`;
    const promoIdStr = String(doc._id);
    const users = await User.find({ accountStatus: "active" }).select("_id").lean();

    const inboxRows = users.map((u) => ({ user: u._id, promotionId: doc._id, read: false }));
    let inboxInserted = 0;
    if (inboxRows.length) {
      try {
        const inserted = await PromotionInbox.insertMany(inboxRows, { ordered: false });
        inboxInserted = Array.isArray(inserted) ? inserted.length : 0;
      } catch (e) {
        const dupOnly =
          e?.code === 11000 ||
          (Array.isArray(e?.writeErrors) && e.writeErrors.length && e.writeErrors.every((we) => we?.err?.code === 11000));
        if (e?.insertedDocs && Array.isArray(e.insertedDocs)) {
          inboxInserted = e.insertedDocs.length;
        } else if (typeof e?.insertedCount === "number") {
          inboxInserted = e.insertedCount;
        }
        if (!dupOnly) {
          console.error("PromotionInbox insertMany:", e?.message || e);
        }
      }
    }

    let liveSocketTargets = 0;
    users.forEach((u) => {
      const uid = String(u._id);
      liveSocketTargets += getOnlineSocketCountForUser(uid);
      emitToUser(uid, "promotion:new", {
        promotionId: promoIdStr,
        title: `New course: ${courseName}`,
        message: `Instructor: ${instructorName}. Tap to view details and purchase options.`,
        link,
      });
    });

    console.log(
      `[course-promotion] created id=${promoIdStr} inboxRows=${inboxInserted}/${users.length} liveSockets=${liveSocketTargets}`
    );

    return res.status(201).json({
      success: true,
      data: doc,
      meta: {
        activeUsersTargeted: users.length,
        promotionInboxRowsWritten: inboxInserted,
        liveSocketConnections: liveSocketTargets,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyPromotionInbox = async (req, res) => {
  try {
    // Include read rows so the Notifications page still lists courses you already opened
    // (only unread hid them before, which made the section look empty).
    const rows = await PromotionInbox.find({ user: req.user._id })
      .populate("promotionId")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const data = rows
      .filter((r) => r.promotionId && r.promotionId.isActive)
      .map((r) => {
        const p = r.promotionId;
        return {
          promotionId: String(p._id),
          title: `New course: ${p.courseName}`,
          message: `Instructor: ${p.instructorName}. Tap to view details and purchase options.`,
          link: `/courses/promo/${p._id}`,
          read: Boolean(r.read),
        };
      });

    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.markPromotionInboxRead = async (req, res) => {
  try {
    const { promotionId } = req.params;
    if (!mongoose.isValidObjectId(promotionId)) {
      return res.status(400).json({ success: false, message: "Invalid promotion id" });
    }
    await PromotionInbox.updateOne({ user: req.user._id, promotionId }, { $set: { read: true } });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.updatePromotionAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const parsed = parsePromotionPrices(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    const doc = await CoursePromotion.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: { priceBdt: parsed.priceBdt, priceCredits: parsed.priceCredits } },
      { new: true }
    );
    if (!doc) {
      return res.status(404).json({ success: false, message: "Promotion not found or no longer active" });
    }
    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.deletePromotionAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const doc = await CoursePromotion.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!doc) {
      return res.status(404).json({ success: false, message: "Promotion not found or already removed" });
    }
    await PromotionInbox.deleteMany({ promotionId: id });
    return res.json({ success: true, message: "Promotion removed" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.listPromotionsAdmin = async (req, res) => {
  try {
    const rows = await CoursePromotion.find().sort({ createdAt: -1 }).populate("createdBy", "name email").lean();
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.getPromotionPublic = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const doc = await CoursePromotion.findById(id).populate("createdBy", "name").lean();
    if (!doc || !doc.isActive) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.getMyEnrollment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const row = await CourseEnrollment.findOne({ promotionId: id, user: req.user._id }).lean();
    return res.json({ success: true, data: row });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.buyWithCredits = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const promo = await CoursePromotion.findById(id);
    if (!promo || !promo.isActive) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    const cost = Number(promo.priceCredits);
    if (!Number.isInteger(cost) || cost <= 0) {
      return res.status(400).json({ success: false, message: "This course is not available for credit purchase" });
    }

    const existing = await CourseEnrollment.findOne({ promotionId: id, user: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: "You already purchased this course" });
    }

    await normalizeUserCreditFields(req.user._id);
    const updated = await User.findOneAndUpdate(
      { _id: req.user._id, totalCredits: { $gte: cost } },
      { $inc: { totalCredits: -cost, credits: -cost } },
      { new: true }
    ).select("totalCredits heldCredits credits");

    if (!updated) {
      return res.status(400).json({ success: false, message: "Insufficient credits" });
    }

    await CourseEnrollment.create({
      user: req.user._id,
      promotionId: id,
      paidWith: "credits",
      creditsSpent: cost,
      amountBdt: 0,
    });

    await CreditLedger.create({
      user: req.user._id,
      type: "course_promotion_purchase",
      amount: -cost,
      balanceAfter: asNumber(updated.totalCredits, 0),
      metadata: { promotionId: String(id), courseName: promo.courseName },
    });

    emitToUser(String(req.user._id), "wallet:update", {
      title: "Course purchase",
      message: `You enrolled in “${promo.courseName}” for ${cost} credits.`,
      link: `/courses/promo/${id}`,
    });

    return res.json({
      success: true,
      message: "Enrolled successfully",
      data: { wallet: { totalCredits: asNumber(updated.totalCredits, 0), heldCredits: asNumber(updated.heldCredits, 0) } },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.startBkashCoursePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const promo = await CoursePromotion.findById(id);
    if (!promo || !promo.isActive) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const enrolled = await CourseEnrollment.findOne({ promotionId: id, user: req.user._id });
    if (enrolled) {
      return res.status(400).json({ success: false, message: "You already purchased this course" });
    }

    const amountBdt = Number(promo.priceBdt);
    if (!Number.isFinite(amountBdt) || amountBdt < 1) {
      return res.status(400).json({ success: false, message: "Invalid course price" });
    }

    if (isBkashDemoMode()) {
      const invoiceNumber = safeInvoice();
      const order = await CoursePromotionOrder.create({
        user: req.user._id,
        promotionId: promo._id,
        amountBdt,
        invoiceNumber,
        status: "pending",
        provider: "bkash",
        isDemoCheckout: true,
        bkashCreateResponse: { localCheckout: true },
      });
      return res.json({
        success: true,
        data: {
          demoMode: true,
          orderId: order._id,
          promotionId: String(promo._id),
          invoiceNumber,
          amountBdt,
        },
      });
    }

    if (!isBkashConfigured()) {
      return res.status(503).json({
        success: false,
        message: "bKash is not configured for this server, or use BKASH_DEMO_MODE=true for local checkout.",
      });
    }
    const callbackOrigin = (process.env.BKASH_CALLBACK_ORIGIN || "").trim();
    if (!callbackOrigin) {
      return res.status(503).json({ success: false, message: "BKASH_CALLBACK_ORIGIN is required for bKash checkout" });
    }

    const invoiceNumber = safeInvoice();
    const order = await CoursePromotionOrder.create({
      user: req.user._id,
      promotionId: promo._id,
      amountBdt,
      invoiceNumber,
      status: "pending",
      provider: "bkash",
    });

    const idToken = await grantToken();
    const createRes = await createPayment(idToken, {
      amount: amountBdt,
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

    return res.json({
      success: true,
      data: { bkashURL, paymentID, invoiceNumber, orderId: order._id, amountBdt, promotionId: String(promo._id) },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

const completeCourseOrderAfterBkash = async (order, exec, paymentIDForLedger) => {
  const amountPaid = String(exec.amount || "");
  if (amountPaid && Number(amountPaid) !== Number(order.amountBdt)) {
    order.status = "failed";
    order.lastError = `Amount mismatch: expected ${order.amountBdt}, got ${amountPaid}`;
    order.bkashExecuteResponse = exec;
    await order.save();
    throw new Error("amount_mismatch");
  }

  const locked = await CoursePromotionOrder.findOneAndUpdate(
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
    return { completed: false };
  }

  const userId = order.user?._id || order.user;
  const promoId = order.promotionId?._id || order.promotionId;

  try {
    await CourseEnrollment.create({
      user: userId,
      promotionId: promoId,
      paidWith: "bkash",
      creditsSpent: 0,
      amountBdt: order.amountBdt,
    });
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  emitToUser(String(userId), "wallet:update", {
    title: "Course purchase complete",
    message: "Your bKash payment was recorded. You are enrolled in the course.",
    link: `/courses/promo/${promoId}`,
  });

  return { completed: true };
};

exports.getBkashDemoCourseOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const order = await CoursePromotionOrder.findOne({
      _id: orderId,
      user: req.user._id,
      isDemoCheckout: true,
    })
      .populate("promotionId", "courseName priceBdt")
      .lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Checkout order not found" });
    }
    return res.json({
      success: true,
      data: {
        orderId: order._id,
        status: order.status,
        amountBdt: order.amountBdt,
        invoiceNumber: order.invoiceNumber,
        promotionId: order.promotionId?._id || order.promotionId,
        courseName: order.promotionId?.courseName,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.completeBkashDemoCoursePurchase = async (req, res) => {
  try {
    const orderId = typeof req.body.orderId === "string" ? req.body.orderId.trim() : "";
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const order = await CoursePromotionOrder.findOne({
      _id: orderId,
      user: req.user._id,
      isDemoCheckout: true,
      status: "pending",
    }).populate("promotionId");

    if (!order) {
      return res.status(404).json({ success: false, message: "Pending checkout order not found" });
    }

    const enrolled = await CourseEnrollment.findOne({ promotionId: order.promotionId, user: req.user._id });
    if (enrolled) {
      return res.status(400).json({ success: false, message: "Already enrolled" });
    }

    const fakePaymentId = `DEMO_COURSE_${order._id}`;
    const exec = {
      statusCode: "0000",
      statusMessage: "Successful",
      transactionStatus: "Completed",
      amount: String(order.amountBdt),
      trxID: `LOCAL-COURSE-${Date.now()}`,
      merchantInvoiceNumber: order.invoiceNumber,
      paymentID: fakePaymentId,
    };

    try {
      await completeCourseOrderAfterBkash(order, exec, fakePaymentId);
    } catch (e) {
      if (e.message === "amount_mismatch") {
        return res.status(400).json({ success: false, message: "Amount validation failed" });
      }
      throw e;
    }

    return res.json({ success: true, message: "Payment completed — you are enrolled." });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * Returns true if this paymentID was a course order and the response was fully handled (redirect sent).
 */
exports.tryProcessCourseBkashCallback = async ({ paymentID, status, redirect }) => {
  const order = await CoursePromotionOrder.findOne({ bkashPaymentID: paymentID }).populate("user").populate("promotionId");
  if (!order) {
    return false;
  }

  const promoId = String(order.promotionId?._id || order.promotionId);
  const basePath = `/courses/promo/${promoId}`;

  if (order.isDemoCheckout) {
    redirect(`${basePath}?purchase=error&reason=demo_use_course_checkout`);
    return true;
  }

  if (order.status === "completed") {
    redirect(`${basePath}?purchase=success`);
    return true;
  }

  if (status === "failure" || status === "failed") {
    order.status = "failed";
    order.lastError = "bKash callback status=failure";
    await order.save();
    redirect(`${basePath}?purchase=failed`);
    return true;
  }
  if (status === "cancel" || status === "cancelled") {
    order.status = "cancelled";
    order.lastError = "User cancelled at bKash";
    await order.save();
    redirect(`${basePath}?purchase=cancelled`);
    return true;
  }

  const idToken = await grantToken();
  const exec = await executePayment(idToken, paymentID);

  const ok =
    exec.statusCode === "0000" && String(exec.transactionStatus || "").toLowerCase() === "completed";

  if (!ok) {
    order.status = "failed";
    order.lastError = exec.statusMessage || exec.errorMessage || JSON.stringify(exec);
    order.bkashExecuteResponse = exec;
    await order.save();
    redirect(`${basePath}?purchase=failed`);
    return true;
  }

  try {
    await completeCourseOrderAfterBkash(order, exec, paymentID);
  } catch (e) {
    if (e.message === "amount_mismatch") {
      redirect(`${basePath}?purchase=error&reason=amount_mismatch`);
      return true;
    }
    await CoursePromotionOrder.updateMany(
      { bkashPaymentID: paymentID, status: "pending" },
      { $set: { status: "failed", lastError: e.message?.slice(0, 2000) || "execute_error" } }
    );
    redirect(`${basePath}?purchase=error&reason=execute_failed`);
    return true;
  }

  redirect(`${basePath}?purchase=success`);
  return true;
};

exports.completeCourseOrderAfterBkash = completeCourseOrderAfterBkash;
