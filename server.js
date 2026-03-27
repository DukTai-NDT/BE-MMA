require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db.js");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Health check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "football_booking_app",
    time: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// API Routes
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/venues", require("./src/routes/venues"));
app.use("/api", require("./src/routes/subPitches"));
app.use("/api/holds", require("./src/routes/holds"));
app.use("/api", require("./src/routes/ownerSlots"));
app.use("/api/owner", require("./src/routes/owner"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api/reviews", require("./src/routes/review"));
app.use("/api/withdrawals", require("./src/routes/withdrawal"));
app.use("/api/bookings", require("./src/routes/bookings"));
app.use("/api/vnpay", require("./src/routes/vnpay"));

const ownerVenueRoutes = require("./src/routes/venue.js");
const ownerSubPitchRoutes = require("./src/routes/subPitchRoutes.js");
const ownerReviewRoutes = require("./src/routes/reviewRoutes.js");

app.use("/api/owner/venues", ownerVenueRoutes);
app.use("/api/owner/sub-pitches", ownerSubPitchRoutes);
app.use("/api/owner/reviews", ownerReviewRoutes);

// Error middleware
app.use((err, req, res, next) => {
  console.error("🔥 Error caught by middleware:", err.message);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Start Server
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Startup failed:", error.message);
    process.exit(1);
  }
};

startServer();