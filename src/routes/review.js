// src/routes/review.js
const express = require("express");
const router = express.Router();
const { submitReview, getReviewsByVenue } = require("../controllers/reviewController");
const { checkAuth } = require("../middleware/auth"); // JWT middleware

router.post("/submit", checkAuth, submitReview);
// router.get("/venue/:venueId", getReviewsByVenue);

module.exports = router;