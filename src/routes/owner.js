const express = require("express");
const router = express.Router();
const ownerController = require("../controllers/ownerController");
const ownerBookingController = require("../controllers/ownerBookingController");
const { checkAuth, checkRole } = require("../middleware/auth");

// Áp dụng middleware checkAuth và checkRole(['owner']) cho tất cả routes trong file này
router.use(checkAuth, checkRole(["owner"]));

// GET /api/owner/dashboard?from=&to=
router.get("/dashboard", ownerController.getDashboard);
router.get("/bookings", ownerBookingController.listOwnerBookings);
module.exports = router;