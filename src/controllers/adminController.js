const mongoose = require("mongoose");
const { Booking, Payment, User, SubPitch } = require("../models");

/**
 * Lấy ngày bắt đầu và kết thúc (mặc định 30 ngày qua)
 * @param {object} query - req.query
 * @returns {object} { from, to }
 */
const getSafeDateRange = (query) => {
  // Mặc định 30 ngày qua
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultTo.getDate() - 30);

  let from = query.from ? new Date(query.from) : defaultFrom;
  let to = query.to ? new Date(query.to) : defaultTo;

  if (isNaN(from.getTime())) from = defaultFrom;
  if (isNaN(to.getTime())) to = defaultTo; // Đảm bảo 'to' là cuối ngày

  to.setHours(23, 59, 59, 999);

  return { from, to };
};

/**
 * UC-ADM-DASH-01: Lấy thống kê tổng quan cho Admin
 * GET /admin/dashboard?from=&to=
 */
exports.getDashboard = async (req, res) => {
  try {
    const { from, to } = getSafeDateRange(req.query);
    // 1. Thống kê doanh thu (theo ngày)
    const revenueChart = await Booking.aggregate([
      {
        $match: {
          status: "completed", // Lọc các booking đã hoàn thành
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          // SỬA Ở ĐÂY: Sử dụng đúng tên trường 'totalAmount'
          dailyRevenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          revenue: "$dailyRevenue",
          _id: 0,
        },
      },
    ]);

    // Đoạn code này giữ nguyên, nó sẽ tự động tính tổng từ kết quả bên trên
    const totalRevenue = revenueChart.reduce(
      (acc, curr) => acc + curr.revenue,
      0,
    ); // 2. Thống kê Lịch đặt (TẤT CẢ TRẠNG THÁI) - THAY ĐỔI

    const bookingStats = await Booking.aggregate([
      {
        $match: {
          // Không lọc theo subPitchId (vì là admin)
          status: {
            $in: ["confirmed", "completed", "pending_payment", "cancelled"],
          },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]); // Tính toán 2 số liệu: Tổng thành công (cho card cũ) và Tổng (cho card mới)

    let totalSuccessfulBookings = 0;
    let totalBookings = 0;
    bookingStats.forEach((stat) => {
      totalBookings += stat.count;
      if (stat._id === "confirmed" || stat._id === "completed") {
        totalSuccessfulBookings += stat.count;
      }
    }); // 3. Số lượng người dùng mới

    const newCustomers = await User.countDocuments({
      roles: "customer",
      createdAt: { $gte: from, $lte: to },
    });
    const newOwners = await User.countDocuments({
      roles: "owner",
      createdAt: { $gte: from, $lte: to },
    }); // 4. Các sân bóng "hot" (được đặt nhiều nhất)

    const hotPitches = await Booking.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "completed"] },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: "$subPitchId",
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { bookingCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "sub_pitches",
          localField: "_id",
          foreignField: "_id",
          as: "subPitchInfo",
        },
      },
      {
        $unwind: {
          path: "$subPitchInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          subPitchId: "$_id",
          subPitchName: "$subPitchInfo.name",
          venueId: "$subPitchInfo.venueId",
          bookingCount: 1,
          _id: 0,
        },
      },
    ]); // Trả về kết quả

    res.json({
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      platformKpis: {
        totalRevenue,
        totalSuccessfulBookings, // Giữ lại cho card "Lượt đặt T.Công"
        totalBookings, // Thêm mới (tổng 4 trạng thái)
        bookingStatusCounts: bookingStats, // Thêm mới (chi tiết)
        newUsers: {
          customers: newCustomers,
          owners: newOwners,
        },
      },
      revenueChartData: revenueChart,
      hotPitches,
    });
  } catch (err) {
    console.error("getAdminDashboard error:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};
