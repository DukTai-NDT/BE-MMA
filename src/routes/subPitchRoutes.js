// src/routes/subPitchRoutes.js
const express = require('express');
const router = express.Router();

const {
  updateSubPitch,
  deleteSubPitch,
} = require('../controllers/subPitchController.js');

// --- THÊM IMPORT NÀY ---
const { listReviewsForSubPitch } = require('../controllers/reviewController.js');

// Import middleware (phiên bản giả lập)
const { protect, isOwner } = require('../middleware/authMiddleware.js');

router.use(protect, isOwner);

// === CÁC ROUTE ĐÃ CÓ ===
// PUT /owner/sub-pitches/:id
// DELETE /owner/sub-pitches/:id
router.route('/:id')
  .put(updateSubPitch)
  .delete(deleteSubPitch);

// ===================================
// === THÊM ROUTE MỚI NÀY ===
// GET /owner/sub-pitches/:id/reviews
// ===================================
router.route('/:id/reviews')
  .get(listReviewsForSubPitch);

module.exports = router;