const mongoose = require("mongoose");
const SubPitch = require("../models/SubPitch");
const SlotReservation = require("../models/SlotReservation");
const Booking = require("../models/Booking");

const getOwnerSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid subPitchId" });

    if (!date)
      return res.status(400).json({ message: "Missing ?date=YYYY-MM-DD" });

    //  Lấy thông tin sub_pitch
    const subPitch = await SubPitch.findById(id).lean();
    if (!subPitch)
      return res.status(404).json({ message: "Sub-pitch not found" });

    //  Lấy booking theo ngày & sân
    const bookings = await Booking.find({
      subPitchId: id,
      date,
    })
      .populate("userId", "name phone email")
      .lean();

    // Nếu bạn muốn kiểm tra có thật sự có dữ liệu
    console.log("🟢 Found bookings:", bookings.length);

    //  Lấy danh sách hold (tạm giữ)
    const holds = await SlotReservation.find({
      subPitchId: id,
      date,
      status: "hold",
    }).lean();

    console.log("🟡 Holds:", holds.length);

    //  Ghép thông tin vào từng block
    const slots = subPitch.bookableBlocks.map((block) => {
      // Lấy các booking khớp startTime và endTime
      const blockBookings = bookings.filter(
        (b) =>
          b.startTime.trim() === block.start.trim() &&
          b.endTime.trim() === block.end.trim()
      );

      // Lấy các hold (chưa cần phân chia theo thời gian vì hold tính theo date)
      const blockHolds = holds.filter(
        (h) => h.date === date && h.subPitchId.toString() === id
      );

      return {
        start: block.start,
        end: block.end,
        label: block.label,
        bookedCount: blockBookings.length,
        holdCount: blockHolds.length,
        bookings: blockBookings.map((b) => ({
          bookingId: b._id,
          customer: b.userId?.name,
          phone: b.userId?.phone,
          email: b.userId?.email,
          status: b.status,
          payment: b.paymentOption,
          amount: b.totalAmount,
          currency: b.currency,
        })),
      };
    });

    res.json({
      subPitchId: id,
      date,
      slots,
    });
  } catch (err) {
    console.error("❌ getOwnerSlots error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getOwnerSlots };
