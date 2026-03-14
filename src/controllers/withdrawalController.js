// ./src/controllers/withdrawalController.js
const {
  Booking,
  SubPitch,
  Venue,
  WithdrawalRequest,
} = require("../models");
const mongoose = require("mongoose");

/**
 * Hàm nội bộ (helper) để tính toán số dư
 * @param {string} ownerId - ID của chủ sân
 * @returns {Promise<{totalRevenue: number, totalWithdrawn: number, availableBalance: number}>}
 */
const _calculateBalance = async (ownerId) => {
  const ownerObjId = new mongoose.Types.ObjectId(ownerId);

  // 1. Tính tổng doanh thu từ các booking "completed"
  const revenueResult = await Booking.aggregate([
    { $match: { status: "completed" } },
    {
      $lookup: {
        from: "sub_pitches",
        localField: "subPitchId",
        foreignField: "_id",
        as: "subPitchInfo",
      },
    },
    { $unwind: "$subPitchInfo" },
    {
      $lookup: {
        from: "venues",
        localField: "subPitchInfo.venueId",
        foreignField: "_id",
        as: "venueInfo",
      },
    },
    { $unwind: "$venueInfo" },
    { $match: { "venueInfo.ownerId": ownerObjId } },
    { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
  ]);

  const totalRevenue = revenueResult[0]?.totalRevenue || 0;

  // 2. Tính tổng tiền đã rút hoặc đang chờ xử lý
  const withdrawalResult = await WithdrawalRequest.aggregate([
    {
      $match: {
        ownerId: ownerObjId,
        status: { $in: ["pending", "processing", "success"] },
      },
    },
    { $group: { _id: null, totalWithdrawn: { $sum: "$amount" } } },
  ]);

  const totalWithdrawn = withdrawalResult[0]?.totalWithdrawn || 0;
  const availableBalance = totalRevenue - totalWithdrawn;

  return { totalRevenue, totalWithdrawn, availableBalance };
};

// [GET] /api/withdrawals/owner/balance
exports.getOwnerBalance = async (req, res) => {
  try {
    // === THAY ĐỔI TẠI ĐÂY ===
    const ownerId = req.user.sub; // Lấy ID từ token payload (do checkAuth gán vào)
    // ========================
    const balance = await _calculateBalance(ownerId);
    return res.json(balance);
  } catch (err) {
    console.error("getOwnerBalance error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// [POST] /api/withdrawals/owner/request
exports.requestWithdrawal = async (req, res) => {
  try {
    // === THAY ĐỔI TẠI ĐÂY ===
    const ownerId = req.user.sub; // Lấy ID từ token payload
    // ========================
    const { amount, bankInfo } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Số tiền không hợp lệ." });
    }
    if (
      !bankInfo ||
      !bankInfo.accountName ||
      !bankInfo.accountNumber ||
      !bankInfo.bankName
    ) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin tài khoản ngân hàng." });
    }

    const { availableBalance } = await _calculateBalance(ownerId);
    if (amount > availableBalance) {
      return res
        .status(400)
        .json({ message: "Số tiền yêu cầu vượt quá số dư khả dụng." });
    }

    const newRequest = await WithdrawalRequest.create({
      ownerId,
      amount,
      bankInfo: {
        accountName: bankInfo.accountName,
        accountNumber: bankInfo.accountNumber,
        bankName: bankInfo.bankName,
        qrCodeImageUrl: bankInfo.qrCodeImageUrl || null,
      },
      status: "pending",
      currency: "VND",
      requestedAt: new Date(),
    });

    return res
      .status(201)
      .json({ message: "Gửi yêu cầu rút tiền thành công.", data: newRequest });
  } catch (err) {
    console.error("requestWithdrawal error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// [GET] /api/withdrawals/owner/history
exports.getOwnerWithdrawals = async (req, res) => {
  try {
    // === THAY ĐỔI TẠI ĐÂY ===
    const ownerId = req.user.sub; // Lấy ID từ token payload
    // ========================
    const history = await WithdrawalRequest.find({ ownerId }).sort({
      requestedAt: -1,
    });
    return res.json(history);
  } catch (err) {
    console.error("getOwnerWithdrawals error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// --- Admin Functions ---

// [GET] /api/withdrawals/admin/list
exports.getAdminWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const requests = await WithdrawalRequest.find(filter)
      .populate("ownerId", "name email phone")
      .sort({ requestedAt: 1 });

    return res.json(requests);
  } catch (err)
 {
    console.error("getAdminWithdrawals error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// [POST] /api/withdrawals/admin/approve/:id
exports.approveWithdrawal = async (req, res) => {
  try {
    // === THAY ĐỔI TẠI ĐÂY ===
    const adminId = req.user.sub; // Lấy ID từ token payload
    // ========================
    const { id } = req.params;

    const request = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "success",
          processedAt: new Date(),
          processedBy: adminId,
        },
      },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({
        message: "Không tìm thấy yêu cầu hoặc yêu cầu đã được xử lý.",
      });
    }

    return res.json({ message: "Duyệt yêu cầu thành công.", data: request });
  } catch (err) {
    console.error("approveWithdrawal error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// [POST] /api/withdrawals/admin/reject/:id
exports.rejectWithdrawal = async (req, res) => {
  try {
    // === THAY ĐỔI TẠI ĐÂY ===
    const adminId = req.user.sub; // Lấy ID từ token payload
    // ========================
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Cần cung cấp lý do từ chối." });
    }

    const request = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason,
          processedAt: new Date(),
          processedBy: adminId,
        },
      },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({
        message: "Không tìm thấy yêu cầu hoặc yêu cầu đã được xử lý.",
      });
    }

    return res.json({ message: "Từ chối yêu cầu thành công.", data: request });
  } catch (err) {
    console.error("rejectWithdrawal error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};