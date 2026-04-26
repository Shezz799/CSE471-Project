const Post = require("../models/Post");
const Session = require("../models/Session");
const { attachRatingSummariesToPosts } = require("../services/reviewStats");
const { triggerNotification } = require("../services/pusherService");
const { emitToUser } = require("../socket/socketServer");

const ACTIVE_SESSION_STATUSES = ["pending", "active", "ending"];

// GET /api/posts - list all posts (skill share feed)
const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "name email")
      .populate("offers", "name email department skills")
      .lean();
    await attachRatingSummariesToPosts(posts);
    return res.status(200).json({ success: true, data: posts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/posts - create a post (auth required; Prithila's form will use this)
const createPost = async (req, res) => {
  try {
    const { subject, topic, description, demo, creditsOffered } = req.body;
    if (!subject || !topic || !description || !demo) {
      return res.status(400).json({
        success: false,
        message: "Subject, topic, description and demo are required",
      });
    }
    const post = await Post.create({
      author: req.user._id,
      subject,
      topic,
      description,
      demo,
      creditsOffered: creditsOffered ? Number(creditsOffered) : 0,
    });
    const populated = await Post.findById(post._id)
      .populate("author", "name email")
      .populate("offers", "name email department skills")
      .lean();
    await attachRatingSummariesToPosts([populated]);

    // Send a global notification
    triggerNotification("global", "post:created", {
      postId: post._id,
      subject: post.subject,
      topic: post.topic,
      authorName: req.user.name || "Someone",
      authorId: req.user._id.toString(),
    });

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/posts/:id - single post
const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "name email")
      .populate("offers", "name email department skills")
      .lean();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    await attachRatingSummariesToPosts([post]);
    return res.status(200).json({ success: true, data: post });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/posts/:id - only author or admin can delete
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const isAuthor = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: "Only the author or an admin can delete this post" });
    }
    await Post.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Post deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/posts/:id/offer - offer help on a post
const offerHelp = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    if (post.status !== "open") {
      return res.status(400).json({ success: false, message: "This post is no longer open for help" });
    }
    if (post.author.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot offer help on your own post" });
    }
    
    const alreadyOffered = post.offers.some(
      (offerId) => offerId.toString() === req.user._id.toString()
    );
    if (alreadyOffered) {
      return res.status(400).json({ success: false, message: "You have already offered help for this post" });
    }

    post.offers.push(req.user._id);
    await post.save();

    const populated = await Post.findById(post._id)
      .populate("author", "name email")
      .populate("offers", "name email department skills")
      .lean();
    await attachRatingSummariesToPosts([populated]);

    // Send Realtime Notification using Pusher to the author of the post
    triggerNotification(`user-${post.author.toString()}`, "help:offered", {
      postId: post._id,
      postSubject: post.subject,
      offerName: req.user.name || "Someone",
      message: `Offered to help with: ${post.subject}`,
    });

    emitToUser(post.author.toString(), "offer_notification", {
      postId: String(post._id),
      postSubject: post.subject,
      helperUserId: String(req.user._id),
      helperName: req.user.name || "Someone",
      creditsOffered: Number(post.creditsOffered || 0),
      message: `${req.user.name || "Someone"} offered to help with: ${post.subject}`,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/posts/:id/offers/:offerUserId/reject - post owner rejects an offer
const rejectOffer = async (req, res) => {
  try {
    const { id: postId, offerUserId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Only the post owner can reject an offer" });
    }

    const nextOffers = post.offers.filter((offerId) => String(offerId) !== String(offerUserId));
    if (nextOffers.length === post.offers.length) {
      return res.status(404).json({ success: false, message: "Offer not found for this post" });
    }

    post.offers = nextOffers;
    await post.save();

    const populated = await Post.findById(post._id)
      .populate("author", "name email")
      .populate("offers", "name email department skills")
      .lean();
    await attachRatingSummariesToPosts([populated]);

    emitToUser(String(offerUserId), "offer_rejected", {
      postId: String(post._id),
      postSubject: post.subject,
      reason: "The post owner rejected your offer",
    });

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/posts/my-offer-notifications - actionable offer notifications for post owner
const getMyOfferNotifications = async (req, res) => {
  try {
    const posts = await Post.find({
      author: req.user._id,
      status: "open",
      offers: { $exists: true, $ne: [] },
    })
      .sort({ updatedAt: -1 })
      .populate("offers", "name email department skills")
      .select("subject topic creditsOffered offers updatedAt")
      .lean();

    if (!posts.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const postIds = posts.map((post) => post._id);
    const sessions = await Session.find({
      requesterId: req.user._id,
      postId: { $in: postIds },
      status: { $in: ACTIVE_SESSION_STATUSES },
    })
      .select("postId helperId status")
      .lean();

    const activePairSet = new Set(
      sessions.map((session) => `${String(session.postId)}:${String(session.helperId)}`)
    );

    const notifications = [];

    posts.forEach((post) => {
      const helpers = Array.isArray(post.offers) ? post.offers : [];

      helpers.forEach((helper) => {
        const helperId = String(helper?._id || helper || "");
        if (!helperId) return;

        const pairKey = `${String(post._id)}:${helperId}`;
        if (activePairSet.has(pairKey)) {
          return;
        }

        notifications.push({
          id: `${String(post._id)}:${helperId}`,
          postId: String(post._id),
          postSubject: post.subject || "Untitled post",
          postTopic: post.topic || "",
          helperUserId: helperId,
          helperName: helper?.name || "Unknown helper",
          helperEmail: helper?.email || "",
          helperDepartment: helper?.department || "",
          suggestedCredits: Number(post.creditsOffered || 0),
          createdAt: post.updatedAt,
        });
      });
    });

    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPosts,
  createPost,
  getPostById,
  deletePost,
  offerHelp,
  rejectOffer,
  getMyOfferNotifications,
};
