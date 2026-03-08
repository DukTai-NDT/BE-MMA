// controllers/ownerBookingController.js
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const SubPitch = require("../models/SubPitch");
const Venue = require("../models/Venue");

exports.listOwnerBookings = async (req, res) => {
  try {
    const { from, to, status, paymentOption } = req.query;
    const ownerId = req.user.sub;

    console.log(">>> Owner ID:", ownerId);

    // 1️⃣ Lấy tất cả Venue của owner hiện tại
    const venues = await Venue.find({ ownerId }).select("_id name").lean();
    const venueIds = venues.map((v) => v._id);

    console.log(">>> Venues of owner:", venueIds);

    // Nếu owner chưa có sân lớn
    if (venueIds.length === 0) {
      console.log(">>> Owner chưa có venue nào");
      return res.json([]);
    }

    // 2️⃣ Lấy tất cả SubPitch thuộc các Venue đó
    const subPitches = await SubPitch.find({ venueId: { $in: venueIds } })
      .select("_id name venueId")
      .lean();
    const subPitchIds = subPitches.map((s) => s._id);

    console.log(">>> SubPitch IDs:", subPitchIds);

    // Nếu chưa có sân con
    if (subPitchIds.length === 0) {
      console.log(">>> Không có subPitch nào thuộc owner này");
      return res.json([]);
    }

    // 3️⃣ Lọc Booking theo danh sách subPitchId
    const filter = { subPitchId: { $in: subPitchIds } };
    if (status) filter.status = status;
    if (paymentOption) filter.paymentOption = paymentOption;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    console.log(">>> Booking filter:", filter);

    // 4️⃣ Truy vấn Booking, populate sân con và người đặt
    const bookings = await Booking.find(filter)
      .populate({
        path: "subPitchId",
        select: "name venueId",
        populate: { path: "venueId", select: "name ownerId" }, // 🔥 lấy cả venue để kiểm tra
      })
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    console.log(">>> Found bookings:", bookings.length);

    res.json(bookings);
  } catch (err) {
    console.error("Owner bookings fetch error:", err);
    res.status(500).json({ message: err.message });
  }
};
