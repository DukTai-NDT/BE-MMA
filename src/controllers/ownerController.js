const mongoose = require("mongoose");
const { Venue, SubPitch, Booking, Payment, Review } = require("../models");

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
  if (isNaN(to.getTime())) to = defaultTo;

  // Đảm bảo 'to' là cuối ngày
  to.setHours(23, 59, 59, 999);
  
  // Đảm bảo 'from' là đầu ngày để $gte hoạt động chính xác
  // với bookingDate (được chuyển thành 00:00:00)
  from.setHours(0, 0, 0, 0);

  return { from, to };
};

/**
 * UC-OWN-DASH-01: Lấy thống kê dashboard cho chủ sân (owner)
 * GET /owner/dashboard?from=&to=
 */
exports.getDashboard = async (req, res) => {
  try {
    const ownerId = req.user.sub; // Lấy từ middleware checkAuth
    const { from, to } = getSafeDateRange(req.query);

    // 1. Tìm tất cả các SubPitch ID thuộc về Owner này (Giữ nguyên)
    const venues = await Venue.find({ ownerId }).select("_id").lean();
    const venueIds = venues.map((v) => v._id);

    const subPitches = await SubPitch.find({ venueId: { $in: venueIds } })
      .select("_id")
      .lean();
    const subPitchIds = subPitches.map((sp) => sp._id);

    if (subPitchIds.length === 0) {
      // Trả về cấu trúc dữ liệu rỗng (Giữ nguyên)
      return res.json({
        dateRange: { from: from.toISOString(), to: to.toISOString() },
        kpis: {
          totalRevenue: 0,
          totalBookings: 0,
          bookingStatusCounts: [],
        },
        revenueChartData: [],
        recentReviews: [],
        message: "Chủ sân này chưa có sân con nào.",
      });
    }

    const revenueChart = await Booking.aggregate([
      // 1. Chuyển đổi 'date' string (YYYY-MM-DD) thành Date object
      {
        $addFields: {
          bookingDate: { $toDate: "$date" },
        },
      },
      // 2. Lọc (match)
      {
        $match: {
          // Lọc các booking thuộc sân con của owner
          subPitchId: { $in: subPitchIds },
          // Chỉ tính booking đã xác nhận hoặc hoàn thành
          status: { $in: ["confirmed", "completed"] },
          // Lọc theo ngày đặt sân (sử dụng biến Date mới)
          bookingDate: { $gte: from, $lte: to },
        },
      },
      // 3. Nhóm
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } },
          dailyRevenue: { $sum: "$totalAmount" }, // Tính tổng 'totalAmount'
        },
      },
      // 4. Sắp xếp
      { $sort: { _id: 1 } },
      // 5. Định dạng output
      {
        $project: {
          date: "$_id",
          revenue: "$dailyRevenue",
          _id: 0,
        },
      },
    ]);

    const totalRevenue = revenueChart.reduce(
      (acc, curr) => acc + curr.revenue,
      0
    );

    // B. Thống kê tỷ lệ lấp đầy (đếm số booking)
    const bookingStats = await Booking.aggregate([
      {
        $addFields: {
          bookingDate: { $toDate: "$date" }, // Chuyển đổi string -> date
        },
      },
      {
        $match: {
          subPitchId: { $in: subPitchIds },
          status: {
            $in: ["confirmed", "completed", "pending_payment", "cancelled"],
          },
          bookingDate: { $gte: from, $lte: to }, // Lọc theo ngày đặt sân
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalBookings = bookingStats.reduce(
      (acc, curr) => acc + curr.count,
      0
    );

    // C. Xem đánh giá và bình luận (20 đánh giá mới nhất)
    const reviews = await Review.find({
      subPitchId: { $in: subPitchIds },
    })
      .populate("userId", "name") // Lấy tên người đánh giá
      .populate("subPitchId", "name") // Lấy tên sân con
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Trả về kết quả (Giữ nguyên)
    res.json({
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      kpis: {
        totalRevenue,
        totalBookings,
        bookingStatusCounts: bookingStats,
      },
      revenueChartData: revenueChart,
      recentReviews: reviews,
    });
  } catch (err) {
    console.error("getOwnerDashboard error:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};