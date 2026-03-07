// src/routes/venueRoutes.js
const express = require('express');
const router = express.Router();

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    // Tên thư mục trên Cloudinary mà bạn muốn lưu file vào
    folder: 'mma_project_uploads', 
    
    // Cho phép các định dạng ảnh này
    allowedFormats: ['jpeg', 'png', 'jpg', 'heic'],
    
    // (Tùy chọn) Tự động tối ưu hóa ảnh khi upload
    transformation: [{ width: 1024, height: 1024, crop: 'limit' }]
  },
});

const upload = multer({ storage: storage });
// --- Import Venue Controller (Đã có) ---
const {
  getMyVenues,
  createVenue,
  updateVenue,
  updateVenueStatus,
} = require('../controllers/venueController.js');

// --- Import SubPitch Controller (MỚI) ---
const {
  getSubPitchesByVenue,
  createSubPitch,
} = require('../controllers/subPitchController.js');

// Import middleware (Đã có)
const { protect, isOwner } = require('../middleware/authMiddleware.js');

// Áp dụng middleware (Đã có)
router.use(protect, isOwner);

// === CÁC ROUTE VENUE (ĐÃ CÓ) ===
router.route('/')
  .get(getMyVenues)
  .post(upload.array('images', 10), createVenue);

router.route('/:id')
  .put(upload.array('images', 10), updateVenue);

router.route('/:id/status')
  .patch(updateVenueStatus);

// =============================================
// === CÁC ROUTE SUB-PITCH LỒNG NHAU (MỚI) ===
// =============================================

// GET /owner/venues/:venueId/sub-pitches
// POST /owner/venues/:venueId/sub-pitches
router.route('/:venueId/sub-pitches')
  .get(getSubPitchesByVenue)
  .post(createSubPitch);

module.exports = router;