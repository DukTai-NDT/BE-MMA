const Booking = require("../models/Booking");

exports.listBookings = async (req, res) => {
    try {
        const { from, to, status, subPitchId, userId } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (subPitchId) filter.subPitchId = subPitchId;
        if (userId) filter.userId = userId;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const bookings = await Booking.find(filter)
            .populate("subPitchId", "name") // ✅ chỉ populate đúng trường có trong schema
            .populate("userId", "name email") // ✅ lấy tên + email người dùng
            .sort({ createdAt: -1 });

        res.json(bookings);
    } catch (err) {
        console.error("Booking fetch error:", err.message);
        res.status(500).json({ message: err.message });
    }
};
