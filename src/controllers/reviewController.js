// src/controllers/reviewController.js
const Review = require("../models/Review.js");
const SubPitch = require("../models/SubPitch.js");
const Venue = require("../models/Venue.js");
const mongoose = require("mongoose");
// const { sendReviewHiddenEmail } = require('../services/emailService.js'); // <-- ĐÃ XÓA
const Booking = require("../models/Booking");

// === HÀM HỖ TRỢ KIỂM TRA QUYỀN SỞ HỮU (Lấy từ subPitchController) ===
const checkSubPitchOwnership = async (subPitchId, ownerId) => {
  if (!mongoose.Types.ObjectId.isValid(subPitchId)) return null;

  const subPitch = await SubPitch.findById(subPitchId);
  if (!subPitch) return null;

  if (!mongoose.Types.ObjectId.isValid(subPitch.venueId)) return null;
  const venue = await Venue.findOne({
    _id: subPitch.venueId,
    ownerId: ownerId,
  }); // Sửa lỗi logic nhỏ: _id

  return venue ? subPitch : null;
};
// =================================================================

// @desc    Lấy danh sách review của 1 sub-pitch
// @route   GET /owner/sub-pitches/:id/reviews
const listReviewsForSubPitch = async (req, res) => {
  try {
    const { id } = req.params; // id của sub-pitch
    const ownerId = req.user._id;

    // 1. Kiểm tra owner có sở hữu sub-pitch này không
    const isOwner = await checkSubPitchOwnership(id, ownerId);
    if (!isOwner) {
      return res
        .status(403)
        .json({ message: "Forbidden: You do not own this sub-pitch" });
    }

    // 2. Lấy reviews, đồng thời populate thông tin người viết (chỉ lấy tên và email)
    const reviews = await Review.find({ subPitchId: id }).populate(
      "userId",
      "name email"
    );

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Ẩn một review
// @route   PATCH /owner/reviews/:id/hide
const hideReview = async (req, res) => {
  try {
    const { id } = req.params; // id của review
    const ownerId = req.user._id;

    // 1. Tìm review
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // 2. Kiểm tra owner có sở hữu sub-pitch (cha) của review này không
    const isOwner = await checkSubPitchOwnership(review.subPitchId, ownerId);
    if (!isOwner) {
      return res
        .status(403)
        .json({
          message:
            "Forbidden: You do not own the sub-pitch this review belongs to",
        });
    }

    // 3. Cập nhật (ẩn) review
    review.isHidden = true;
    await review.save();

    // 4. Gửi email (ĐÃ XÓA)
    // sendReviewHiddenEmail(review.userId, review); // <-- ĐÃ XÓA

    res.json(review); // Trả về review đã được cập nhật
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user.sub;

    // === 1. Kiểm tra booking hợp lệ + đã hoàn thành ===
    const booking = await Booking.findOne({
      _id: bookingId,
      userId,
      status: { $regex: /^completed$/i },
    }).populate("subPitchId", "_id"); // chỉ cần subPitchId._id

    if (!booking) {
      return res.status(403).json({
        error:
          "Không thể đánh giá: Booking không tồn tại, không thuộc về bạn hoặc chưa hoàn thành",
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Điểm đánh giá phải từ 1 đến 5" });
    }

    const subPitchId = booking.subPitchId._id;

    // === 2. Kiểm tra đã review chưa (per user + booking) ===
    const existing = await Review.findOne({ bookingId, userId });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Bạn đã đánh giá cho booking này rồi!" });
    }

    // === 3. TẠO REVIEW MỚI (chỉ lưu) ===
    const review = new Review({
      bookingId,
      subPitchId,
      userId,
      rating: Number(rating),
      comment: (comment || "").toString().trim(),
    });

    await review.save();

    // === 4. TRẢ KẾT QUẢ ĐƠN GIẢN ===
    return res.status(201).json({
      success: true,
      message: "Cảm ơn bạn đã đánh giá!",
      data: {
        reviewId: review._id.toString(),
        rating: review.rating,
        comment: review.comment,
      },
    });
  } catch (error) {
    console.error("Submit review error:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

module.exports = {
  listReviewsForSubPitch,
  hideReview,
  submitReview,
};
