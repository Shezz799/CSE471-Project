const Post = require("../models/Post");

// GET /api/posts - list all posts (skill share feed)
const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "name email")
      .populate("offers", "name email department skills")
      .lean();
    return res.status(200).json({ success: true, data: posts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/posts - create a post (auth required; Prithila's form will use this)
const createPost = async (req, res) => {
  try {
    const { subject, topic, description, creditsOffered } = req.body;
    if (!subject || !topic || !description) {
      return res.status(400).json({
        success: false,
        message: "Subject, topic and description are required",
      });
    }
    const post = await Post.create({
      author: req.user._id,
      subject,
      topic,
      description,
      creditsOffered: creditsOffered ? Number(creditsOffered) : 0,
    });
    const populated = await Post.findById(post._id)
      .populate("author", "name email")
      .populate("offers", "name email department skills")
      .lean();
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

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getPosts, createPost, getPostById, deletePost, offerHelp };
