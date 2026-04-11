const express = require("express");
const { submitAppeal } = require("../controllers/adminController");

const router = express.Router();

router.post("/appeal", submitAppeal);

module.exports = router;
