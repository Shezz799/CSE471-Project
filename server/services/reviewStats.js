const mongoose = require("mongoose");
const Review = require("../models/Review");
const Post = require("../models/Post");

async function getReviewSummariesForUserIds(userIds) {
  const unique = [...new Set(userIds)].filter((id) => mongoose.isValidObjectId(id));
  if (!unique.length) return new Map();
  const oids = unique.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await Review.aggregate([
    { $match: { reviewee: { $in: oids } } },
    {
      $group: {
        _id: "$reviewee",
        reviewCount: { $sum: 1 },
        averageRating: { $avg: "$rating" },
      },
    },
  ]);
  const map = new Map();
  for (const r of rows) {
    map.set(r._id.toString(), {
      reviewCount: r.reviewCount,
      averageRating: Math.round(r.averageRating * 100) / 100,
    });
  }
  return map;
}

function attachOfferRatingSummaries(posts, summaryMap) {
  if (!Array.isArray(posts)) return;
  for (const post of posts) {
    const offers = post.offers;
    if (!Array.isArray(offers)) continue;
    for (const offer of offers) {
      const id = offer._id != null ? offer._id.toString() : String(offer);
      const s = summaryMap.get(id);
      if (s && s.reviewCount > 0) {
        offer.ratingSummary = { averageRating: s.averageRating };
      }
    }
  }
}

async function attachRatingSummariesToPosts(posts) {
  const ids = [];
  for (const p of posts || []) {
    for (const o of p.offers || []) {
      const id = o._id != null ? o._id.toString() : String(o);
      if (mongoose.isValidObjectId(id)) ids.push(id);
    }
  }
  const map = await getReviewSummariesForUserIds(ids);
  attachOfferRatingSummaries(posts, map);
}

async function getFullReviewStatsForUser(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const [agg, distAgg, helpsOfferedCount] = await Promise.all([
    Review.aggregate([
      { $match: { reviewee: oid } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          avgTopicKnowledge: { $avg: "$criteria.topicKnowledge" },
          avgTeachingClarity: { $avg: "$criteria.teachingClarity" },
          avgCommunication: { $avg: "$criteria.communication" },
          avgPatience: { $avg: "$criteria.patience" },
          avgProfessionalism: { $avg: "$criteria.professionalism" },
          avgHelpfulness: { $avg: "$criteria.helpfulness" },
        },
      },
    ]),
    Review.aggregate([
      { $match: { reviewee: oid } },
      { $project: { starBucket: { $round: ["$rating", 0] } } },
      { $group: { _id: "$starBucket", n: { $sum: 1 } } },
    ]),
    Post.countDocuments({ offers: userId }),
  ]);
  const row = agg[0];
  const reviewCount = row ? row.count : 0;
  const averageRating =
    row?.averageRating != null ? Math.round(row.averageRating * 100) / 100 : null;
  const distribution = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  for (const d of distAgg) {
    const key = String(d._id);
    if (Object.prototype.hasOwnProperty.call(distribution, key)) {
      distribution[key] = d.n;
    }
  }
  const topicAverages = row
    ? {
        topicKnowledge: Math.round((row.avgTopicKnowledge || 0) * 100) / 100,
        teachingClarity: Math.round((row.avgTeachingClarity || 0) * 100) / 100,
        communication: Math.round((row.avgCommunication || 0) * 100) / 100,
        patience: Math.round((row.avgPatience || 0) * 100) / 100,
        professionalism: Math.round((row.avgProfessionalism || 0) * 100) / 100,
        helpfulness: Math.round((row.avgHelpfulness || 0) * 100) / 100,
      }
    : null;

  return {
    reviewCount,
    averageRating,
    topicAverages,
    distribution,
    helpsOfferedCount,
  };
}

module.exports = {
  getReviewSummariesForUserIds,
  attachOfferRatingSummaries,
  attachRatingSummariesToPosts,
  getFullReviewStatsForUser,
};
