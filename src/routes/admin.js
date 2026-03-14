const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const userCtrl = require("../controllers/adminUserController");
const venueCtrl = require("../controllers/adminVenueController");
const bookingCtrl = require("../controllers/adminBookingController");
const { checkAuth, checkRole } = require("../middleware/auth");

// Áp dụng middleware checkAuth và checkRole(['admin']) cho tất cả routes trong file này
router.use(checkAuth, checkRole(["admin"]));

// GET /api/admin/dashboard?from=&to=
router.get("/dashboard", adminController.getDashboard);

// --- USERS ---
router.get("/users", userCtrl.listUsers);
router.patch("/users/:id/status", userCtrl.updateStatus);
router.patch("/users/:id/roles", userCtrl.updateRole);

// --- VENUES ---
router.get("/venues", venueCtrl.listVenues);
router.patch("/venues/:id/status", venueCtrl.updateStatus);
router.patch("/venues/:id/approve", venueCtrl.approveVenue);

// --- BOOKINGS ---
router.get("/bookings", bookingCtrl.listBookings);

module.exports = router;
