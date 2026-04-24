const User = require("../models/User");
const Session = require("../models/Session");

const ACTIVE_SESSION_STATUSES = ["pending", "active", "ending"];

const toSafeNumber = (value, fallback = 0) => {
  const next = Number(value);
  if (Number.isNaN(next)) return fallback;
  return next;
};

const normalizeUserCreditFields = async (userId) => {
  const user = await User.findById(userId).select("totalCredits heldCredits credits");
  if (!user) return null;

  const legacyCredits = toSafeNumber(user.credits, 0);
  const currentTotalCredits = user.totalCredits == null ? null : toSafeNumber(user.totalCredits, 0);
  const currentHeldCredits = user.heldCredits == null ? null : toSafeNumber(user.heldCredits, 0);

  let normalizedTotalCredits = currentTotalCredits == null ? legacyCredits : currentTotalCredits;
  let normalizedHeldCredits = currentHeldCredits == null ? 0 : currentHeldCredits;

  // Safe one-way migration path: if legacy credits were manually increased and no credits are held,
  // adopt that value as wallet total credits.
  if (legacyCredits > normalizedTotalCredits && normalizedHeldCredits === 0) {
    normalizedTotalCredits = legacyCredits;
  }

  const setFields = {};
  if (currentTotalCredits == null || currentTotalCredits !== normalizedTotalCredits) {
    setFields.totalCredits = normalizedTotalCredits;
  }
  if (currentHeldCredits == null || currentHeldCredits !== normalizedHeldCredits) {
    setFields.heldCredits = normalizedHeldCredits;
  }
  if (legacyCredits !== normalizedTotalCredits) {
    setFields.credits = normalizedTotalCredits;
  }

  if (!Object.keys(setFields).length) return user;

  await User.updateOne({ _id: userId }, { $set: setFields });
  return User.findById(userId).select("totalCredits heldCredits credits");
};

const holdCreditsForSession = async ({ userId, creditsAmount }) => {
  const normalizedAmount = toSafeNumber(creditsAmount, 0);
  if (normalizedAmount <= 0) {
    throw new Error("creditsAmount must be greater than zero");
  }

  await normalizeUserCreditFields(userId);

  let requester = await User.findById(userId)
    .select("_id totalCredits heldCredits credits name email")
    .lean();

  if (!requester) {
    throw new Error("User not found");
  }

  let availableCredits = toSafeNumber(requester.totalCredits, 0);
  let heldCredits = toSafeNumber(requester.heldCredits, 0);

  if (heldCredits > 0) {
    const activeHeldResult = await Session.aggregate([
      {
        $match: {
          requesterId: userId,
          status: { $in: ACTIVE_SESSION_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          totalHeld: { $sum: "$creditsHeld" },
        },
      },
    ]);

    const activeHeld = toSafeNumber(activeHeldResult?.[0]?.totalHeld, 0);
    const orphanHeld = heldCredits - activeHeld;

    // Recover credits that are marked as held but are not tied to any active session.
    if (orphanHeld > 0) {
      await User.updateOne(
        { _id: userId },
        {
          $inc: {
            totalCredits: orphanHeld,
            heldCredits: -orphanHeld,
          },
        }
      );

      requester = await User.findById(userId)
        .select("_id totalCredits heldCredits credits name email")
        .lean();
      availableCredits = toSafeNumber(requester?.totalCredits, 0);
    }
  }

  const holdAmount = normalizedAmount;

  if (availableCredits < holdAmount) {
    const insufficientError = new Error(
      `Insufficient credits to start this session (available: ${availableCredits}, required: ${holdAmount}, held: ${toSafeNumber(requester?.heldCredits, 0)})`
    );
    insufficientError.code = "INSUFFICIENT_CREDITS";
    insufficientError.availableCredits = availableCredits;
    insufficientError.requiredCredits = holdAmount;
    insufficientError.heldCredits = toSafeNumber(requester?.heldCredits, 0);
    throw insufficientError;
  }

  let nextRequester = requester;
  if (holdAmount > 0) {
    nextRequester = await User.findOneAndUpdate(
      {
        _id: userId,
        totalCredits: { $gte: holdAmount },
      },
      {
        $inc: {
          totalCredits: -holdAmount,
          heldCredits: holdAmount,
        },
      },
      { new: true }
    ).select("_id totalCredits heldCredits credits name email");

    if (!nextRequester) {
      const freshRequester = await User.findById(userId).select("_id totalCredits heldCredits credits name email");
      const fallbackInsufficient = new Error(
        `Insufficient credits to start this session (available: ${toSafeNumber(freshRequester?.totalCredits, 0)}, required: ${holdAmount}, held: ${toSafeNumber(freshRequester?.heldCredits, 0)})`
      );
      fallbackInsufficient.code = "INSUFFICIENT_CREDITS";
      fallbackInsufficient.availableCredits = toSafeNumber(freshRequester?.totalCredits, 0);
      fallbackInsufficient.requiredCredits = holdAmount;
      fallbackInsufficient.heldCredits = toSafeNumber(freshRequester?.heldCredits, 0);
      throw fallbackInsufficient;
    }
  }

  return {
    requester: nextRequester,
    heldAmount: holdAmount,
  };
};

const refundHeldCredits = async ({ userId, creditsAmount }) => {
  const normalizedAmount = toSafeNumber(creditsAmount, 0);
  if (normalizedAmount <= 0) {
    return null;
  }

  await normalizeUserCreditFields(userId);

  const requester = await User.findOneAndUpdate(
    {
      _id: userId,
      heldCredits: { $gte: normalizedAmount },
    },
    {
      $inc: {
        heldCredits: -normalizedAmount,
        totalCredits: normalizedAmount,
      },
    },
    { new: true }
  ).select("_id totalCredits heldCredits credits name email");

  if (!requester) {
    throw new Error("Unable to refund held credits");
  }

  return requester;
};

const settleHeldCreditsToHelper = async ({ requesterId, helperId, creditsAmount }) => {
  const normalizedAmount = toSafeNumber(creditsAmount, 0);
  if (normalizedAmount <= 0) {
    throw new Error("creditsAmount must be greater than zero");
  }

  await Promise.all([
    normalizeUserCreditFields(requesterId),
    normalizeUserCreditFields(helperId),
  ]);

  const requester = await User.findOneAndUpdate(
    {
      _id: requesterId,
      heldCredits: { $gte: normalizedAmount },
    },
    {
      $inc: {
        heldCredits: -normalizedAmount,
      },
    },
    { new: true }
  ).select("_id totalCredits heldCredits credits name email");

  if (!requester) {
    throw new Error("Unable to settle held credits for requester");
  }

  const helper = await User.findByIdAndUpdate(
    helperId,
    {
      $inc: {
        totalCredits: normalizedAmount,
      },
    },
    { new: true }
  ).select("_id totalCredits heldCredits credits name email");

  if (!helper) {
    await User.findByIdAndUpdate(requesterId, {
      $inc: {
        heldCredits: normalizedAmount,
      },
    });
    throw new Error("Unable to transfer credits to helper");
  }

  return { requester, helper };
};

const getMyCredits = async (req, res) => {
  try {
    const user = await normalizeUserCreditFields(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalCredits: toSafeNumber(user.totalCredits, 0),
        heldCredits: toSafeNumber(user.heldCredits, 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  holdCreditsForSession,
  refundHeldCredits,
  settleHeldCreditsToHelper,
  normalizeUserCreditFields,
  getMyCredits,
};
