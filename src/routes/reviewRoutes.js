// src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();

const { hideReview } = require('../controllers/reviewController.js');

// Import middleware (phiên bản giả lập)
const { protect, isOwner } = require('../middleware/authMiddleware.js');

// Áp dụng middleware
router.use(protect, isOwner);

// PATCH /owner/reviews/:id/hide
router.route('/:id/hide')
  .patch(hideReview);

module.exports = router;