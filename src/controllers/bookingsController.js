// src/controllers/bookingsController.js
const Booking = require("../models/Booking");
const SubPitch = require("../models/SubPitch");
const SlotReservation = require("../models/SlotReservation");


//Helper: Convert "HH:MM" → số phút (để tính slotIndex)

function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}


//Tạo booking mới (trạng thái pending_payment)

const createBooking = async (req, res) => {
  try {
    const { subPitchId, date, startTime, endTime, paymentOption, slotIndex } =
      req.body;
    const userId = req.user?.sub;
    if (!userId) throw new Error("Unauthorized: missing user info");
    if (!subPitchId || !date || !startTime || !endTime || !paymentOption) {
      throw new Error("Missing required fields");
    }

    // 1️⃣ Kiểm tra sân con tồn tại
    const subPitch = await SubPitch.findById(subPitchId).lean();
    if (!subPitch) throw new Error("SubPitch not found");

    // 2️⃣ Tính slotIndex (nếu không được gửi từ FE)
    const finalSlotIndex = slotIndex ?? Math.floor(hhmmToMinutes(startTime) / 30);

    // 3️⃣ Tìm giá trong blockPrices
    const slotLabelColon = `${startTime}-${endTime}`; // "13:00-15:00"
    const slotLabelDash = `${startTime.split(":")[0]}-${endTime.split(":")[0]}`; // "13-15"

    const keys = Object.keys(subPitch.blockPrices || {});
    const matchedKey = keys.find(
      (k) =>
        k === slotLabelColon ||
        k === slotLabelDash ||
        k.replace(/\u003A/g, ":") === slotLabelColon
    );

    const price = matchedKey ? subPitch.blockPrices[matchedKey] : undefined;
    if (!price) {
      throw new Error(
        `No price found for slot ${slotLabelColon} (keys: ${keys.join(", ")})`
      );
    }

    // 4️⃣ Kiểm tra xung đột slot
    const conflict = await SlotReservation.findOne({
      subPitchId,
      date,
      slotIndex: finalSlotIndex,
      status: { $in: ["booked", "hold"] },
    });
    if (conflict) {
      throw new Error("⛔ Slot is already held or booked by another user");
    }

    // 5️⃣ Tạo SlotReservation (trạng thái hold ban đầu)
    const reservation = await SlotReservation.create({
      subPitchId,
      date,
      slotIndex: finalSlotIndex,
      startTime,
      endTime,
      userId,
      status: "hold",
      createdAt: new Date(),
    });

    // 6️⃣ Tạo Booking (pending_payment cho online)
    const booking = await Booking.create({
      userId,
      subPitchId,
      date,
      startTime,
      endTime,
      totalAmount: price,
      paymentOption,
      currency: "VND",
      status: paymentOption === "pay_on_site" ? "confirmed" : "pending_payment",
    });

    // 7️⃣ Gắn liên kết ngược (bookingId vào reservation)
    reservation.bookingId = booking._id;
    await reservation.save();

    // ✅ Thành công
    res.status(201).json({
      message: "✅ Booking created successfully",
      holdId: reservation._id,
      booking,
    });
  } catch (err) {
    console.error("❌ Error creating booking:", err);
    res.status(400).json({ message: err.message });
  }
};


const confirmBooking = async (req, res) => {
  try {
    const { holdId } = req.params;
    const currentUserId = req.user?.sub;
    if (!holdId) return res.status(400).json({ message: "Thiếu holdId" });
    if (!currentUserId) return res.status(401).json({ message: "Unauthorized user" });
    //  Tìm SlotReservation (thay vì Hold)
    const hold = await SlotReservation.findById(holdId);
    if (!hold) return res.status(404).json({ message: "Không tìm thấy SlotReservation" });

    // Nếu slot đã booked (VNPay return handler đã xử lý) → trả về success thay vì lỗi
    if (hold.status === "booked") {
      const existingBooking = hold.bookingId
        ? await Booking.findById(hold.bookingId)
        : null;
      return res.status(200).json({
        message: "✅ Thanh toán đã được xử lý trước đó",
        booking: existingBooking,
        alreadyProcessed: true,
      });
    }

    if (hold.status !== "hold") {
      return res.status(400).json({ message: "Slot đã hết hạn hoặc đã xử lý" });
    }

    //  Kiểm tra slot trùng
    const conflict = await SlotReservation.findOne({
      subPitchId: hold.subPitchId,
      date: hold.date,
      slotIndex: hold.slotIndex,
      status: "booked",
    });
    if (conflict) {
      return res
        .status(400)
        .json({ message: "Slot đã được đặt bởi người khác" });
    }

    //  Cập nhật SlotReservation thành booked
    hold.status = "booked";
    await hold.save();

    //  Tạo Booking chính thức
    const booking = await Booking.create({
      userId: hold.userId, // nếu FE chưa truyền userId
      subPitchId: hold.subPitchId,
      date: hold.date,
      startTime: hold.startTime || "",
      endTime: hold.endTime || "",
      status: "confirmed",
      paymentOption: "online",
      totalAmount: hold.amount || 0,
      currency: "VND",
      createdAt: new Date(),
    });

    hold.bookingId = booking._id;
    await hold.save();

    console.log(`✅ Booking confirmed for hold ${hold._id}`);
    res.status(200).json({
      message: "✅ Thanh toán & đặt sân thành công!",
      booking,
    });
  } catch (err) {
    console.error("❌ confirmBooking error:", err);
    res.status(500).json({
      message: "Lỗi xác nhận thanh toán",
      error: err.message,
    });
  }
};

// Danh sách booking của customer
const getBookingsByCustomer = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    // 🔍 Tìm tất cả booking của user (mới nhất trước)
    const bookings = await Booking.find({ userId })
      .populate({
        path: "subPitchId",
        select: "name venueId blockPrices",
        populate: {
          path: "venueId",
          select: "name address images",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ message: "Không có booking nào" });
    }

    // 🧾 Chuẩn hóa dữ liệu trả về
    const formatted = bookings.map((b) => ({
      bookingId: b._id,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      totalAmount: b.totalAmount,
      status: b.status,
      paymentOption: b.paymentOption,
      subPitch: b.subPitchId?.name || "N/A",
      pitch: b.subPitchId?.venueId?.name || "N/A",
      address: b.subPitchId?.venueId?.address || "N/A",
      images: b.subPitchId?.venueId?.images || [],
      createdAt: b.createdAt,
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("❌ getBookingsByCustomer error:", err);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách booking",
      error: err.message,
    });
  }
};



module.exports = {
  createBooking,
  confirmBooking,
  getBookingsByCustomer
};
