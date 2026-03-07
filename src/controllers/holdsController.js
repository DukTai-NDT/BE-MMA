const mongoose = require("mongoose");
const SlotReservation = require("../models/SlotReservation");
const SubPitch = require("../models/SubPitch"); //  cần để lấy thông tin block & giá

//  Tạo Hold (giữ slot tạm thời 10 phút)
exports.createHold = async (req, res) => {
  try {
    const { subPitchId, date, slotIndex } = req.body;

    //  Giả định: userId lấy từ token (nếu chưa có auth middleware → fake tạm)
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: Missing userId from token" });
    }


    //  Validate input
    if (!subPitchId || !date || slotIndex === undefined) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    //  Kiểm tra slot đã được giữ hoặc đặt chưa
    const existed = await SlotReservation.findOne({
      subPitchId,
      date,
      slotIndex,
      status: { $in: ["hold", "booked"] },
    });
    if (existed) {
      return res
        .status(400)
        .json({ message: "❌ Slot đã được giữ hoặc đặt, vui lòng chọn slot khác" });
    }

    //  Lấy thông tin SubPitch
    const subPitch = await SubPitch.findById(subPitchId);
    if (!subPitch) {
      return res.status(404).json({ message: "Không tìm thấy subPitch" });
    }

    //  Lấy block tương ứng theo index
    const selectedBlock = subPitch.bookableBlocks?.[slotIndex];
    if (!selectedBlock) {
      return res.status(400).json({ message: "Không tìm thấy slotIndex hợp lệ" });
    }

    //  Lấy giá từ blockPrices (key: "HH:MM-HH:MM")
    const blockKey = `${selectedBlock.start}-${selectedBlock.end}`;
    const price = subPitch.blockPrices?.get(blockKey) || 0;

    //  TTL: 10 phút kể từ bây giờ
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    //  Tạo mới SlotReservation (hold)
    const hold = await SlotReservation.create({
      subPitchId,
      date,
      slotIndex,
      userId,
      status: "hold",
      start: selectedBlock.start,
      end: selectedBlock.end,
      price,
      paymentResult: "pending",
      expiresAt,
    });

    console.log("✅ Đã tạo hold:", hold._id);

    return res.status(201).json({
      message: "✅ Giữ chỗ thành công (hiệu lực 10 phút)",
      hold,
    });
  } catch (err) {
    console.error("❌ createHold error:", err);
    return res.status(500).json({ message: err.message });
  }
};

//  Hủy hold thủ công (nếu cần)
exports.deleteHold = async (req, res) => {
  try {
    const deleted = await SlotReservation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy hold" });
    }
    return res.json({ message: "🗑️ Đã hủy giữ chỗ", hold: deleted });
  } catch (err) {
    console.error("❌ deleteHold error:", err);
    return res.status(500).json({ message: err.message });
  }
};
