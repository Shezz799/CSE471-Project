const User = require("../models/User");
const CreditLedger = require("../models/CreditLedger");
const { normalizeUserCreditFields } = require("../controllers/creditController");
const { emitToUser } = require("../socket/socketServer");

const STREAK_BONUS_CREDITS = 2;
const STREAK_MIN_DAYS_FOR_BONUS = 3;

const dayKeyUtc = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
};

const addOneUtcDay = (ymd) => {
  const [y, m, dd] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

/**
 * Call when a help session completes (requester = mentee). Awards +2 credits once per UTC day
 * when the mentee's consecutive-day streak exceeds 3.
 */
exports.applyMentorshipStreakOnSessionCompleted = async (requesterId) => {
  const uid = String(requesterId);
  const today = dayKeyUtc(new Date());

  const user = await User.findById(uid).select(
    "mentorshipStreakCount mentorshipStreakActivityDay mentorshipStreakBonusDay totalCredits credits name"
  );
  if (!user) return;

  let streak = Number(user.mentorshipStreakCount || 0);
  const lastAct = (user.mentorshipStreakActivityDay || "").trim();
  const lastBonus = (user.mentorshipStreakBonusDay || "").trim();

  const grantBonus = async (streakLength) => {
    await normalizeUserCreditFields(uid);
    const updated = await User.findByIdAndUpdate(
      uid,
      {
        $inc: { totalCredits: STREAK_BONUS_CREDITS, credits: STREAK_BONUS_CREDITS },
        $set: { mentorshipStreakBonusDay: today },
      },
      { new: true }
    ).select("totalCredits");
    await CreditLedger.create({
      user: uid,
      type: "mentorship_streak_bonus",
      amount: STREAK_BONUS_CREDITS,
      balanceAfter: Number(updated?.totalCredits || 0),
      metadata: {
        streakLength: streakLength,
        day: today,
        reason: "Mentorship streak (more than 3 consecutive days with a completed session)",
      },
    });
    emitToUser(uid, "wallet:update", {
      title: "Mentorship streak reward",
      message: `+${STREAK_BONUS_CREDITS} credits for keeping a ${streakLength}-day mentorship streak (sessions as a learner).`,
      link: "/dashboard",
    });
  };

  if (lastAct === today) {
    if (streak > STREAK_MIN_DAYS_FOR_BONUS && lastBonus !== today) {
      await grantBonus(streak);
    }
    return;
  }

  if (!lastAct) {
    streak = 1;
  } else if (addOneUtcDay(lastAct) === today) {
    streak += 1;
  } else {
    streak = 1;
  }

  await User.updateOne(
    { _id: uid },
    { $set: { mentorshipStreakActivityDay: today, mentorshipStreakCount: streak } }
  );

  if (streak > STREAK_MIN_DAYS_FOR_BONUS && lastBonus !== today) {
    await grantBonus(streak);
  }
};
