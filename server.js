require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db.js");
const path = require("path");
const app = express();

// Middleware

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Setup - Cho phép tất cả domain
app.use(cors());
// MongoDB Connect
connectDB();
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "football_booking_app",
    time: new Date().toISOString(),
  });
});

// API Routes

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/venues", require("./src/routes/venues")); // venue + danh sách subpitches
app.use("/api", require("./src/routes/subPitches")); // subpitch slots + reviews
app.use("/api/holds", require("./src/routes/holds"));
app.use("/api", require("./src/routes/ownerSlots"));
app.use("/api/owner", require("./src/routes/owner"));
app.use("/api/admin", require("./src/routes/admin"));

app.use("/api/reviews", require("./src/routes/review"));

// THÊM ROUTE MỚI CHO VIỆC RÚT TIỀN
app.use("/api/withdrawals", require("./src/routes/withdrawal")); // <-- THÊM DÒNG NÀY

// Owner management routes (new) under /api/owner/*
const ownerVenueRoutes = require("./src/routes/venue.js");
const ownerSubPitchRoutes = require("./src/routes/subPitchRoutes.js");
const ownerReviewRoutes = require("./src/routes/reviewRoutes.js");
app.use("/api/owner/venues", ownerVenueRoutes);
app.use("/api/owner/sub-pitches", ownerSubPitchRoutes);
app.use("/api/owner/reviews", ownerReviewRoutes);
// Additional routes from teammate merge
app.use("/api/bookings", require("./src/routes/bookings"));
app.use("/api/vnpay", require("./src/routes/vnpay"));

app.use((err, req, res, next) => {
  console.error("🔥 Error caught by middleware:", err.message);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Start Server

const PORT = process.env.PORT || 9999;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
